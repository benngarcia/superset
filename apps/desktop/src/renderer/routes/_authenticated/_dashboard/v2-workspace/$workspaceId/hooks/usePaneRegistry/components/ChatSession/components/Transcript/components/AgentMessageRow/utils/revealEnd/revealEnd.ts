function isSpace(char: string | undefined): boolean {
	return char !== undefined && /\s/.test(char);
}

/** Cuts at the end of the word `at` falls in; a partial last word waits while streaming. */
export function revealEnd(
	text: string,
	at: number,
	streaming: boolean,
): number {
	for (let index = Math.max(0, Math.ceil(at)); index < text.length; index++) {
		if (isSpace(text[index])) return index;
	}
	if (!streaming) return text.length;
	let end = text.length;
	while (end > 0 && !isSpace(text[end - 1])) end--;
	return end;
}
