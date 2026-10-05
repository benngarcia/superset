import { useCallback, useRef, useState } from "react";

const DRAFT_DEBOUNCE_MS = 300;

export function useComposerDraft(draftKey: string) {
	// Debounced so a draft costs one write per pause rather than one per
	// keystroke; the last value is flushed when the pane goes away.
	const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onChange = useCallback(
		(text: string) => {
			if (draftTimer.current) clearTimeout(draftTimer.current);
			draftTimer.current = setTimeout(() => {
				if (text === "") window.localStorage.removeItem(draftKey);
				else window.localStorage.setItem(draftKey, text);
			}, DRAFT_DEBOUNCE_MS);
		},
		[draftKey],
	);

	const [seed, setSeed] = useState(() => ({
		draftKey,
		text: window.localStorage.getItem(draftKey) ?? undefined,
	}));

	const clearDraft = useCallback(() => {
		window.localStorage.removeItem(draftKey);
		setSeed({ draftKey, text: undefined });
	}, [draftKey]);

	const storedDraft =
		seed.draftKey === draftKey
			? seed.text
			: (window.localStorage.getItem(draftKey) ?? undefined);

	return { storedDraft, onChange, clearDraft };
}
