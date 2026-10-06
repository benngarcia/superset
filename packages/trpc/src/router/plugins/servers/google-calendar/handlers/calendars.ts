import { calendar, text } from "../api";
import type { Handler } from "../types";

interface CalendarListEntry {
	id?: string;
	summary?: string;
	summaryOverride?: string;
	primary?: boolean;
	accessRole?: string;
	timeZone?: string;
}

export const calendarHandlers: Record<string, Handler> = {
	list_calendars: async (_args, accessToken) => {
		const data = await calendar<{ items?: CalendarListEntry[] }>(accessToken, [
			"users",
			"me",
			"calendarList",
		]);
		const calendars = data.items ?? [];
		if (!calendars.length) return text("No calendars found");
		const lines = [`${calendars.length} calendar(s)`];
		for (const entry of calendars) {
			const name = entry.summaryOverride ?? entry.summary ?? "(untitled)";
			const primary = entry.primary ? " (primary)" : "";
			lines.push(
				`[${entry.id}] ${name}${primary} — ${entry.accessRole}, ${entry.timeZone}`,
			);
		}
		return text(lines.join("\n"));
	},
};
