import type { Envelope, SessionStatus } from "@superset/chat/protocol";
import { isDurableEnvelope } from "@superset/chat/protocol";
import type { HarnessAdapter } from "../../harness";
import type { ChatJournal } from "../../journal";
import { LiveSession } from "../liveSession";

export type HarnessFactoryOptions = {
	sessionId: string;
	scopeId: string;
	harness: string;
	cwd: string;
	modeId?: string;
	modelId?: string;
	resume?: { harnessSessionId: string };
};

export type HarnessFactory = (options: HarnessFactoryOptions) => HarnessAdapter;

export type HarnessRegistry = Map<string, HarnessFactory>;

export type SessionChange = {
	sessionId: string;
	scopeId: string;
	status: SessionStatus;
	live: boolean;
};

export type LiveSessionRegistryOptions = {
	journal: ChatJournal;
	publish: (envelope: Envelope) => void;
	harnesses: HarnessRegistry;
	onSessionChanged?: (change: SessionChange) => void;
	mintId?: () => string;
	now?: () => number;
};

export class LiveSessionRegistry {
	private readonly live = new Map<string, LiveSession>();
	private readonly reported = new Map<string, SessionChange>();

	constructor(private readonly options: LiveSessionRegistryOptions) {}

	supports(harness: string): boolean {
		return this.options.harnesses.has(harness);
	}

	create(options: HarnessFactoryOptions): LiveSession {
		const factory = this.options.harnesses.get(options.harness);
		if (!factory) throw new Error(`unknown harness ${options.harness}`);
		if (this.live.has(options.sessionId)) {
			throw new Error(`chat session ${options.sessionId} is already running`);
		}

		const session = new LiveSession({
			sessionId: options.sessionId,
			scopeId: options.scopeId,
			harness: options.harness,
			journal: this.options.journal,
			publish: (envelope) => {
				this.options.publish(envelope);
				if (
					!this.live.has(options.sessionId) ||
					!isDurableEnvelope(envelope) ||
					envelope.event.type !== "session"
				) {
					return;
				}
				this.report({
					sessionId: options.sessionId,
					scopeId: options.scopeId,
					status: envelope.event.session.status,
					live: true,
				});
			},
			adapter: factory(options),
			mintId: this.options.mintId,
			now: this.options.now,
		});
		this.live.set(options.sessionId, session);
		try {
			session.start({
				cwd: options.cwd,
				modeId: options.modeId,
				modelId: options.modelId,
				resume: options.resume,
			});
		} catch (error) {
			this.live.delete(options.sessionId);
			this.reported.delete(options.sessionId);
			void session.dispose().catch(() => undefined);
			throw error;
		}
		return session;
	}

	get(sessionId: string): LiveSession | null {
		return this.live.get(sessionId) ?? null;
	}

	require(sessionId: string): LiveSession {
		const session = this.live.get(sessionId);
		if (!session) throw new Error(`chat session ${sessionId} is not running`);
		return session;
	}

	async dispose(sessionId: string): Promise<void> {
		const session = this.live.get(sessionId);
		if (!session) return;
		this.live.delete(sessionId);
		try {
			await session.dispose();
		} finally {
			const last = this.reported.get(sessionId);
			this.reported.delete(sessionId);
			if (last) this.options.onSessionChanged?.({ ...last, live: false });
		}
	}

	async disposeAll(): Promise<void> {
		const sessions = [...this.live.values()];
		this.live.clear();
		this.reported.clear();
		const results = await Promise.allSettled(
			sessions.map((session) => session.dispose()),
		);
		const failure = results.find((result) => result.status === "rejected");
		if (failure?.status === "rejected") throw failure.reason;
	}

	private report(change: SessionChange): void {
		if (this.reported.get(change.sessionId)?.status === change.status) return;
		this.reported.set(change.sessionId, change);
		this.options.onSessionChanged?.(change);
	}
}
