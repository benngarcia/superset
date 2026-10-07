import { describe, expect, it } from "bun:test";
import type { TRPCError } from "@trpc/server";
import type { HostServiceContext } from "../../../types";
import { hostRouter } from "./host";

const apiAuth = {
	getHeaders: async () => ({ Authorization: "Bearer owner-jwt" }),
	invalidateCache: () => {},
};

const callerFor = (context: Partial<HostServiceContext>) =>
	hostRouter.createCaller({
		isAuthenticated: true,
		apiAuth,
		...context,
	} as HostServiceContext);

describe("host.apiToken", () => {
	it("gives a caller on this machine the token the host uses", async () => {
		const caller = callerFor({ isLocalCaller: true });
		expect(await caller.apiToken()).toEqual({ token: "owner-jwt" });
	});

	it.each([
		["through the relay", false],
		["of unknown origin", undefined],
	])("refuses a caller %s", async (_name, isLocalCaller) => {
		const error = (await callerFor({ isLocalCaller })
			.apiToken()
			.catch((thrown: unknown) => thrown)) as TRPCError;
		expect(error.code).toBe("FORBIDDEN");
	});
});
