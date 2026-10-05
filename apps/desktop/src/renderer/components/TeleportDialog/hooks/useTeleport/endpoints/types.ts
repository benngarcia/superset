import type {
	TeleportRefusal,
	WorkingTreeSummary,
} from "@superset/shared/teleport";

/**
 * A move is a source and a destination, and nothing in between cares what
 * either one is. A source is any host-service with a checkout: a machine,
 * or a sandbox behind its gate. A destination is anything that can produce
 * a checkout to arrive in: a worktree on a host, or a new sandbox. The
 * transport between them is always the same, a hidden ref on origin, so
 * every pairing is the one code path with two small plugs.
 */

export interface SourceState {
	branch: string;
	worktreePath: string;
	workingTree: WorkingTreeSummary;
	/** Origin's url, the identity a destination's checkout is matched on. */
	remoteUrl: string | null;
}

/** What a destination says about a branch before anything moves. */
export interface DestinationState {
	tip: string | null;
	checkedOutAt: string | null;
	/** Every ref tip the destination has, the prerequisites a bundle could assume. */
	tips: string[];
}

/** One live agent pane and the text it is handed on arrival. */
export interface HandoffEntry {
	terminalId: string;
	agent: string;
	prompt: string;
}

/** What a capture is of: the commit it sits on and the content over it. */
export interface CaptureIdentity {
	head: string;
	workingTree: string;
}

export interface PublishedCapture extends CaptureIdentity {
	ref: string;
	/** True when the tree matched the one asked about and nothing was pushed. */
	unchanged: boolean;
}

export interface TeleportSourceEndpoint {
	readonly workspaceId: string;
	state(): Promise<SourceState>;
	refusalFor(
		branch: string,
		destination: DestinationState,
	): Promise<TeleportRefusal | null>;
	/** Every live agent pane with its transcript, as it stands now. */
	handoff(): Promise<HandoffEntry[]>;
	/** Capture and put the ref on origin; skip the push when nothing changed since `unless`. */
	publish(unless?: CaptureIdentity): Promise<PublishedCapture>;
	/** End every live agent session; the work has left. */
	stopAgents(): Promise<void>;
	/** Drop the capture here and on origin. */
	discard(): Promise<void>;
}

/** A destination checkout that exists and can be driven. */
export interface ReadyDestination {
	workspaceId: string;
	/** Fetch the ref from origin and put the work back, on `branch`. */
	arrive(ref: string, branch: string): Promise<void>;
	/** Whatever the destination needs before an agent preset id resolves. */
	seedAgents(): Promise<void>;
	launchAgent(agent: string, prompt: string): Promise<void>;
}

export interface TeleportDestinationEndpoint {
	/** Produces the checkout; begun early, awaited once the capture is on origin. */
	prepare(): Promise<ReadyDestination>;
}
