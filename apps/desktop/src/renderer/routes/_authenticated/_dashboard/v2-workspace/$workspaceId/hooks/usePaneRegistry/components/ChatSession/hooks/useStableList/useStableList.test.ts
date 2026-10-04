import { afterAll, afterEach, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

const alreadyRegistered = GlobalRegistrator.isRegistered;
if (!alreadyRegistered) GlobalRegistrator.register();
const { cleanup, renderHook } = await import("@testing-library/react");
const { useStableList } = await import("./useStableList");

afterEach(cleanup);
afterAll(async () => {
	if (!alreadyRegistered) await GlobalRegistrator.unregister();
});

test("keeps the previous array while its entries are the same", () => {
	const a = { id: "a" };
	const b = { id: "b" };
	const { result, rerender } = renderHook(({ list }) => useStableList(list), {
		initialProps: { list: [a, b] },
	});
	const first = result.current;
	rerender({ list: [a, b] });
	expect(result.current).toBe(first);
	rerender({ list: [a] });
	expect(result.current).toEqual([a]);
	expect(result.current).not.toBe(first);
});
