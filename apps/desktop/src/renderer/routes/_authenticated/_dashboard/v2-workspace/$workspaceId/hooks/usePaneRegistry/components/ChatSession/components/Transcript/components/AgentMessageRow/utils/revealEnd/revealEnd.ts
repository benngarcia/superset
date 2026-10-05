function isSpace(char: string | undefined): boolean {
	return char !== undefined && /\s/.test(char);
}

/**
 * Where to cut a streamed reply so only whole words show: the end of the word
 * that `at` falls in. While the reply is still arriving, a partial word at the
 * end is held back.
 */
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
