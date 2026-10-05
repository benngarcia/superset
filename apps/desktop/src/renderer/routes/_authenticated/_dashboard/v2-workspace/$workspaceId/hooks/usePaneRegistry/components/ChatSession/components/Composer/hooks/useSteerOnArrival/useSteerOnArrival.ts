import type { UserMessage } from "@superset/chat/protocol";
import { useCallback, useEffect, useRef } from "react";

export function useSteerOnArrival({
	prompts,
	actionable,
	runningTurnId,
	onSteer,
}: {
	prompts: UserMessage[];
	actionable: boolean;
	runningTurnId: string | null;
	onSteer: (id: string) => void;
}) {
	const pendingRef = useRef<{ clientId: string; turnId: string } | null>(null);
	const stateRef = useRef({ actionable, runningTurnId });
	stateRef.current = { actionable, runningTurnId };

	useEffect(() => {
		const pending = pendingRef.current;
		if (!pending) return;
		if (runningTurnId !== pending.turnId) {
			pendingRef.current = null;
			return;
		}
		const prompt = prompts.find(
			(candidate) => candidate.clientId === pending.clientId,
		);
		if (!prompt) return;
		pendingRef.current = null;
		onSteer(prompt.id);
	}, [prompts, runningTurnId, onSteer]);

	return useCallback((clientId: string) => {
		const { actionable, runningTurnId } = stateRef.current;
		if (!actionable || !runningTurnId) return;
		if (pendingRef.current?.turnId === runningTurnId) return;
		pendingRef.current = { clientId, turnId: runningTurnId };
	}, []);
}
