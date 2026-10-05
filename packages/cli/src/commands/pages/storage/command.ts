import { positional, string, table } from "@superset/cli-framework";
import { MAX_PAGE_STORAGE_KEY_LENGTH } from "@superset/shared/page-storage";
import { command } from "../../../lib/command";
import { pageRefFromArg } from "../pageRef";

interface KeySummary {
	key: string;
	records: number;
	updatedAt: string;
}

interface StorageRecord {
	userId: string;
	name: string;
	value: unknown;
	updatedAt: string;
}

export type StorageView =
	| { pageId: string; keys: KeySummary[] }
	| { pageId: string; key: string; records: StorageRecord[] };

export function displayStorage(data: StorageView): string {
	if ("keys" in data) {
		if (data.keys.length === 0) return "This page has no stored records.";
		return table(
			data.keys.map((row) => ({
				key: row.key,
				records: row.records,
				updated: new Date(row.updatedAt).toLocaleString(),
			})),
			["key", "records", "updated"],
			["KEY", "RECORDS", "UPDATED"],
			[MAX_PAGE_STORAGE_KEY_LENGTH, 8, 24],
		);
	}
	if (data.records.length === 0) return `No records for key "${data.key}".`;
	return table(
		data.records.map((row) => ({
			name: row.name,
			value: JSON.stringify(row.value),
			updated: new Date(row.updatedAt).toLocaleString(),
		})),
		["name", "value", "updated"],
		["NAME", "VALUE", "UPDATED"],
		[24, 60, 24],
	);
}

export default command({
	description:
		"Read the shared storage of a page you created: keys, or every slot of one key",
	args: [positional("page").required().desc("Page id or slug")],
	options: {
		key: string().desc("Show every person's slot for this key"),
	},
	run: async ({ ctx, args, options }) => {
		const ref = pageRefFromArg(args.page as string);
		const data =
			options.key !== undefined
				? await ctx.api.page.storageRecords.query({ ...ref, key: options.key })
				: await ctx.api.page.storageKeys.query(ref);
		return { data };
	},
	display: (data) => displayStorage(data as StorageView),
});
