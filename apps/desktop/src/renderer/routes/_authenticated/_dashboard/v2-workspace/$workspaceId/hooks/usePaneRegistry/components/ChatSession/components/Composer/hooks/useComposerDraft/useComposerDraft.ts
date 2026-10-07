import { useCallback, useEffect, useRef, useState } from "react";

const DRAFT_DEBOUNCE_MS = 300;

const unsavedDrafts = new Map<string, string>();

function writeDraft(draftKey: string, text: string) {
	unsavedDrafts.delete(draftKey);
	if (text === "") window.localStorage.removeItem(draftKey);
	else window.localStorage.setItem(draftKey, text);
}

function readDraft(draftKey: string): string | undefined {
	return (
		unsavedDrafts.get(draftKey) ??
		window.localStorage.getItem(draftKey) ??
		undefined
	);
}

export function appendToDraft(draftKey: string, text: string) {
	const current = readDraft(draftKey);
	writeDraft(draftKey, current ? `${text}\n\n${current}` : text);
}

export function useComposerDraft(draftKey: string) {
	const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingDraft = useRef<{ draftKey: string; text: string } | null>(null);
	const flushDraft = useCallback(() => {
		if (draftTimer.current) clearTimeout(draftTimer.current);
		draftTimer.current = null;
		const pending = pendingDraft.current;
		pendingDraft.current = null;
		if (pending) writeDraft(pending.draftKey, pending.text);
	}, []);
	const onChange = useCallback(
		(text: string) => {
			if (draftTimer.current) clearTimeout(draftTimer.current);
			unsavedDrafts.set(draftKey, text);
			pendingDraft.current = { draftKey, text };
			draftTimer.current = setTimeout(flushDraft, DRAFT_DEBOUNCE_MS);
		},
		[draftKey, flushDraft],
	);
	useEffect(() => flushDraft, [flushDraft]);

	const [seed, setSeed] = useState(() => ({
		draftKey,
		text: readDraft(draftKey),
	}));

	const clearDraft = useCallback(() => {
		if (draftTimer.current) clearTimeout(draftTimer.current);
		draftTimer.current = null;
		pendingDraft.current = null;
		unsavedDrafts.delete(draftKey);
		window.localStorage.removeItem(draftKey);
		setSeed({ draftKey, text: undefined });
	}, [draftKey]);

	const storedDraft =
		seed.draftKey === draftKey ? seed.text : readDraft(draftKey);

	return { storedDraft, onChange, clearDraft };
}
