import { readBookkeeping, type TurnGroup } from "@superset/chat/core";
import type { UserMessage } from "@superset/chat/protocol";
import { userMessageText } from "../userMessageText";

export function promptHistory(
	groups: TurnGroup[],
	harness: string | undefined,
): string[] {
	const history: string[] = [];
	for (const group of groups) {
		for (const entry of group.entries) {
			if (entry.kind !== "item" || entry.item.kind !== "user_message") continue;
			const text = userMessageText(entry.item as UserMessage).trim();
			if (!text || readBookkeeping(harness, text)) continue;
			if (text !== history.at(-1)) history.push(text);
		}
	}
	return history;
}
