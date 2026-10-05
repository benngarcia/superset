import type { HostServiceClient } from "renderer/lib/host-service-client";

const POLL_MS = 1_000;

export const sleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Run a command in a fresh terminal on a host and wait for the line it
 * prints when it is done. This is how a host that predates the teleport
 * procedures still takes part: `terminal.launchSession` and
 * `terminal.transcript` are old, and plain git does the rest.
 */
export async function runMarkedCommand(
	host: HostServiceClient,
	workspaceId: string,
	command: string,
	marker: RegExp,
	timeoutMs: number,
	failure: string,
): Promise<RegExpMatchArray> {
	const { terminalId } = await host.terminal.launchSession.mutate({
		workspaceId,
		initialCommand: command,
	});
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const transcript = await host.terminal.transcript
			.query({ workspaceId, terminalId })
			.catch(() => null);
		const match = transcript?.text?.match(marker);
		if (match) return match;
		await sleep(POLL_MS);
	}
	throw new Error(failure);
}
