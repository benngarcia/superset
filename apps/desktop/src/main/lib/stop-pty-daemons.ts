import { rmSync } from "node:fs";
import {
	listPtyDaemonManifests,
	type PtyDaemonManifest,
	removePtyDaemonManifest,
} from "@superset/host-service/daemon-manifest";
import {
	type DaemonProbeResult,
	probeDaemonHello,
} from "@superset/host-service/daemon-probe";
import {
	isPositiveInteger,
	signalProcessTreeAndGroups,
} from "@superset/pty-daemon/process-tree";
import { isProcessAlive, readManifest } from "./host-service-manifest";

/** The coordinator SIGKILLs a host-service 5 s after SIGTERM. */
const HOST_SERVICE_EXIT_TIMEOUT_MS = 6_000;
/** The daemon drains its PTY kills for up to 2 s before it exits. */
const DAEMON_EXIT_TIMEOUT_MS = 3_000;
const PROBE_TIMEOUT_MS = 1_000;
const POLL_INTERVAL_MS = 50;

export interface StopPtyDaemonsDeps {
	listManifests: () => PtyDaemonManifest[];
	isHostServiceRunning: (organizationId: string) => boolean;
	probe: (socketPath: string) => Promise<DaemonProbeResult | null>;
	isAlive: (pid: number) => boolean;
	signalTree: (pid: number, signal: NodeJS.Signals) => void;
	removeManifest: (manifest: PtyDaemonManifest) => void;
	sleep: (ms: number) => Promise<void>;
	hostServiceExitTimeoutMs: number;
	daemonExitTimeoutMs: number;
}

const defaultDeps: StopPtyDaemonsDeps = {
	listManifests: listPtyDaemonManifests,
	isHostServiceRunning: (organizationId) => {
		const manifest = readManifest(organizationId);
		return manifest !== null && isProcessAlive(manifest.pid);
	},
	probe: (socketPath) => probeDaemonHello(socketPath, PROBE_TIMEOUT_MS),
	isAlive: isProcessAlive,
	signalTree: (pid, signal) => {
		signalProcessTreeAndGroups(pid, signal);
	},
	removeManifest: (manifest) => {
		removePtyDaemonManifest(manifest.organizationId);
		rmSync(manifest.socketPath, { force: true });
	},
	sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	hostServiceExitTimeoutMs: HOST_SERVICE_EXIT_TIMEOUT_MS,
	daemonExitTimeoutMs: DAEMON_EXIT_TIMEOUT_MS,
};

/**
 * Kills every pty-daemon and the terminals it owns. Waits for the stopped
 * host-services to exit first: a live host-service respawns a daemon that
 * dies. A daemon whose host-service is still running belongs to another app
 * instance and is left alone.
 */
export async function stopPtyDaemons(
	stoppedHostServicePids: number[],
	overrides: Partial<StopPtyDaemonsDeps> = {},
): Promise<void> {
	const deps = { ...defaultDeps, ...overrides };

	await waitForExit(
		stoppedHostServicePids,
		deps.hostServiceExitTimeoutMs,
		deps,
	);

	await Promise.all(
		deps.listManifests().map(async (manifest) => {
			if (deps.isHostServiceRunning(manifest.organizationId)) return;
			// The manifest pid can be recycled; only the socket proves which
			// process is the daemon.
			const probe = await deps.probe(manifest.socketPath);
			if (!probe) return;
			const pid = isPositiveInteger(probe.daemonPid)
				? probe.daemonPid
				: manifest.pid;

			deps.signalTree(pid, "SIGTERM");
			if (!(await waitForExit([pid], deps.daemonExitTimeoutMs, deps))) {
				deps.signalTree(pid, "SIGKILL");
			}
			deps.removeManifest(manifest);
		}),
	);
}

async function waitForExit(
	pids: number[],
	timeoutMs: number,
	deps: StopPtyDaemonsDeps,
): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (pids.some(deps.isAlive)) {
		if (Date.now() >= deadline) return false;
		await deps.sleep(POLL_INTERVAL_MS);
	}
	return true;
}
