export type AttachmentTag = { path: string; type: string };

const TAG = /<attachment path="([^"]+)"(?: type="([^"]*)")? \/>/g;
const SAFE_TYPE = /^[\w.+-]+\/[\w.+-]+$/;

export function formatAttachmentTag({ path, type }: AttachmentTag): string {
	return SAFE_TYPE.test(type)
		? `<attachment path="${path}" type="${type}" />`
		: `<attachment path="${path}" />`;
}

export function parseAttachmentTags(text: string): {
	text: string;
	attachments: AttachmentTag[];
} {
	const attachments: AttachmentTag[] = [];
	const rest = text.replace(TAG, (_match, path: string, type?: string) => {
		attachments.push({ path, type: type ?? "" });
		return "";
	});
	return { text: rest.trim(), attachments };
}
