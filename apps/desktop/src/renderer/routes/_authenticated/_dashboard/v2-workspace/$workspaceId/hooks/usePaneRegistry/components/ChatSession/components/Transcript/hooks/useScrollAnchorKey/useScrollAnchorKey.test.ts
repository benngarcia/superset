import { afterAll, afterEach, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { OutboxEntry } from "@superset/chat/core";
import type { TranscriptRow } from "../../utils/transcriptRows";

const alreadyRegistered = GlobalRegistrator.isRegistered;
if (!alreadyRegistered) GlobalRegistrator.register();
(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const { cleanup, renderHook } = await import("@testing-library/react");
const { useScrollAnchorKey } = await import("./useScrollAnchorKey");

afterEach(cleanup);
afterAll(async () => {
	if (!alreadyRegistered) await GlobalRegistrator.unregister();
});

function userRow(key: string): TranscriptRow {
	return {
		kind: "item",
		key,
		groupStart: true,
		item: {
			id: `item-${key}`,
			kind: "user_message",
			clientId: key,
			startedAtMs: 1,
			content: [],
		},
	};
}

function outboxEntry(clientId: string): OutboxEntry {
	return { clientId, content: [], state: "sending" } as unknown as OutboxEntry;
}

function outboxRow(clientId: string): TranscriptRow {
	return {
		kind: "outbox",
		key: clientId,
		groupStart: true,
		entry: outboxEntry(clientId),
	};
}

test("anchors the latest message sent here, not one from another client", () => {
	const { result, rerender } = renderHook(
		({ rows, outbox }) => useScrollAnchorKey(rows, outbox),
		{ initialProps: { rows: [userRow("old")], outbox: [] as OutboxEntry[] } },
	);
	expect(result.current).toBeNull();

	rerender({
		rows: [userRow("old"), outboxRow("mine")],
		outbox: [outboxEntry("mine")],
	});
	expect(result.current).toBe("mine");

	rerender({
		rows: [userRow("old"), userRow("mine"), userRow("theirs")],
		outbox: [],
	});
	expect(result.current).toBe("mine");
});
