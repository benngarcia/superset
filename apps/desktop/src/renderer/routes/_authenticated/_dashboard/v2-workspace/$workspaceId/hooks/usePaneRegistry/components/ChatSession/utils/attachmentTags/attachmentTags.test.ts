import { describe, expect, it } from "bun:test";
import { formatAttachmentTag, parseAttachmentTags } from "./attachmentTags";

describe("attachmentTags", () => {
	it("round-trips tags appended to a message and strips them from the text", () => {
		const message = [
			"look at these",
			formatAttachmentTag({
				path: ".superset/attachments/shot.png",
				type: "image/png",
			}),
			formatAttachmentTag({
				path: ".superset/attachments/notes.txt",
				type: 'text/plain" onerror="x',
			}),
		].join("\n");

		expect(parseAttachmentTags(message)).toEqual({
			text: "look at these",
			attachments: [
				{ path: ".superset/attachments/shot.png", type: "image/png" },
				{ path: ".superset/attachments/notes.txt", type: "" },
			],
		});
	});
});
