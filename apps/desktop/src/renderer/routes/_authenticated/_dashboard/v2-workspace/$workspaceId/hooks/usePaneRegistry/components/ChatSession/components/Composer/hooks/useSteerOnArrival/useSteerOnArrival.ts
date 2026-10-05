import type { UserMessage } from "@superset/chat/protocol";
import { useCallback, useEffect, useRef } from "react";

export function useSteerOnArrival({
	prompts,
	actionable,
	streaming,
	onSteer,
}: {
	prompts: UserMessage[];
	actionable: boolean;
	streaming: boolean;
	onSteer: (id: string) => void;
}) {
	const pendingRef = useRef<string | null>(null);
	const canSteerRef = useRef(false);
	canSteerRef.current = actionable && streaming;

	useEffect(() => {
		const clientId = pendingRef.current;
		if (!clientId) return;
		if (!streaming) {
			pendingRef.current = null;
			return;
		}
		const prompt = prompts.find((candidate) => candidate.clientId === clientId);
		if (!prompt) return;
		pendingRef.current = null;
		onSteer(prompt.id);
	}, [prompts, streaming, onSteer]);

	return useCallback((clientId: string) => {
		if (canSteerRef.current) pendingRef.current = clientId;
	}, []);
}
