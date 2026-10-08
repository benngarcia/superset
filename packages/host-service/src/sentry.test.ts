import { describe, expect, it } from "bun:test";
import { carriesAgentHookBody } from "./sentry";

describe("carriesAgentHookBody", () => {
	it("matches the hook procedure, alone or batched", () => {
		expect(carriesAgentHookBody("/trpc/notifications.hook")).toBe(true);
		expect(
			carriesAgentHookBody(
				"/trpc/terminalAgents.list,notifications.hook?batch=1",
			),
		).toBe(true);
	});

	it("leaves other procedures' bodies to Sentry's defaults", () => {
		expect(carriesAgentHookBody("/trpc/terminalAgents.list")).toBe(false);
		expect(carriesAgentHookBody("/trpc/notifications.hookish")).toBe(false);
		expect(carriesAgentHookBody("/notifications.hook")).toBe(false);
		expect(carriesAgentHookBody("//[/trpc/notifications.hook")).toBe(false);
	});
});
