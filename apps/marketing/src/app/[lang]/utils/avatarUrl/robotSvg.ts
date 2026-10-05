const PALETTES = [
	["#17232d", "#7db9d8", "#3a546b", "#a6f5ef"],
	["#232037", "#c089e8", "#614c7a", "#ffdc8a"],
	["#172a25", "#7bc9a8", "#3c685a", "#e7a5ef"],
	["#302219", "#e2a36f", "#815b3c", "#b5ed83"],
	["#2b1e2a", "#d88b9c", "#724756", "#a6f5ef"],
	["#202238", "#9ea6ef", "#535985", "#ffdc8a"],
] as const;

const CHASSIS = [
	{ head: [32, 29, 56, 45], body: [43, 80, 34, 22], legs: "short" },
	{ head: [34, 22, 48, 45], body: [44, 73, 28, 29], legs: "long" },
	{ head: [26, 35, 64, 38], body: [32, 80, 51, 24], legs: "tracks" },
	{ head: [35, 25, 46, 49], body: [37, 80, 42, 25], legs: "wheel" },
	{ head: [23, 29, 70, 40], body: [42, 76, 34, 25], legs: "short" },
	{ head: [38, 26, 43, 45], body: [32, 78, 54, 27], legs: "short" },
] as const;

function rect(
	x: number,
	y: number,
	width: number,
	height: number,
	fill: string,
) {
	return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
}

function voxel(
	x: number,
	y: number,
	width: number,
	height: number,
	depth: number,
	fill: string,
) {
	const rise = depth * 0.7;
	return `<g>${rect(x, y, width, height, fill)}<path d="M${x} ${y}l${depth} ${-rise}h${width}l${-depth} ${rise}Z" fill="${fill}"/><path d="M${x} ${y}l${depth} ${-rise}h${width}l${-depth} ${rise}Z" fill="#fff" opacity=".28"/><path d="M${x + width} ${y}l${depth} ${-rise}v${height}l${-depth} ${rise}Z" fill="${fill}"/><path d="M${x + width} ${y}l${depth} ${-rise}v${height}l${-depth} ${rise}Z" fill="#000" opacity=".28"/></g>`;
}

export function robotSvg(handle: string): string {
	let hash = 2166136261;
	for (const char of handle.toLowerCase()) {
		hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
	}
	const pick = (offset: number, count: number) => (hash >>> offset) % count;
	const [background, body, accent, glow] =
		PALETTES[pick(4, PALETTES.length)] ?? PALETTES[0];
	const chassis = CHASSIS[pick(0, CHASSIS.length)] ?? CHASSIS[0];
	const [hx, hy, hw, hh] = chassis.head;
	const [bx, by, bw, bh] = chassis.body;
	const cx = hx + hw / 2;
	const screenX = hx + 6;
	const screenY = hy + 6;
	const screenW = hw - 12;
	const screenH = hh - 12;
	const eyeY = screenY + screenH * 0.35;
	const eyeL = cx - screenW * 0.23;
	const eyeR = cx + screenW * 0.23;
	const parts: string[] = [rect(0, 0, 128, 128, background)];
	parts.push(
		`<ellipse cx="65" cy="119" rx="35" ry="4" fill="#000" opacity=".25"/>`,
	);
	if (chassis.legs === "tracks") {
		parts.push(voxel(27, 106, 63, 10, 5, accent));
		for (let x = 31; x < 88; x += 10) parts.push(rect(x, 109, 5, 4, body));
	} else if (chassis.legs === "wheel") {
		parts.push(voxel(50, 105, 20, 13, 5, accent), rect(56, 108, 8, 7, body));
	} else {
		const length = chassis.legs === "long" ? 12 : 8;
		parts.push(
			voxel(bx + 4, by + bh, 9, length, 4, accent),
			voxel(bx + bw - 13, by + bh, 9, length, 4, accent),
		);
		parts.push(
			voxel(bx, by + bh + length - 2, 14, 5, 6, body),
			voxel(bx + bw - 14, by + bh + length - 2, 14, 5, 6, body),
		);
	}
	parts.push(voxel(bx - 9, by + 2, 7, bh - 3, 4, body));
	parts.push(voxel(bx - 10, by + bh - 2, 9, 6, 4, accent));
	parts.push(voxel(bx, by, bw, bh, 7, body));
	parts.push(voxel(bx + bw + 3, by + 2, 7, bh - 3, 4, body));
	parts.push(voxel(bx + bw + 2, by + bh - 2, 9, 6, 4, accent));
	const badge = pick(12, 3);
	if (badge === 0) {
		parts.push(
			rect(bx + 7, by + 6, bw - 14, 8, "#111821"),
			rect(bx + 10, by + 9, bw - 20, 2, glow),
		);
	} else if (badge === 1) {
		parts.push(
			`<path d="M${bx + bw / 2} ${by + 16}l-7-7v-3h5l2 2 2-2h5v3Z" fill="${glow}"/>`,
		);
	} else {
		for (let y = by + 6; y < by + bh - 4; y += 5)
			parts.push(rect(bx + 8, y, bw - 16, 2, accent));
	}
	parts.push(voxel(cx - 6, hy + hh - 1, 12, by - hy - hh + 3, 4, accent));
	parts.push(voxel(hx - 4, hy + hh * 0.45, 4, 9, 3, accent));
	parts.push(voxel(hx, hy, hw, hh, 9, body));
	parts.push(rect(screenX, screenY, screenW, screenH, "#111821"));
	parts.push(rect(screenX + 2, screenY + 2, screenW - 4, 2, "#24313a"));
	parts.push(voxel(hx + hw + 3, hy + hh * 0.45, 4, 9, 3, accent));
	const eyes = pick(16, 4);
	if (eyes === 0) {
		for (const x of [eyeL, eyeR])
			parts.push(
				`<path d="M${x - 3} ${eyeY + 3}v-4h6v4" fill="none" stroke="${glow}" stroke-width="2.5"/>`,
			);
	} else if (eyes === 1) {
		for (const x of [eyeL, eyeR])
			parts.push(
				rect(x - 3, eyeY - 2, 6, 7, glow),
				rect(x, eyeY - 1, 2, 3, "#111821"),
			);
	} else if (eyes === 2) {
		parts.push(
			rect(cx - 8, eyeY - 3, 16, 9, glow),
			rect(cx - 2, eyeY - 1, 5, 5, "#111821"),
		);
	} else {
		for (const x of [eyeL, eyeR])
			parts.push(
				`<path d="M${x} ${eyeY + 6}l-5-5v-3h3l2 2 2-2h3v3Z" fill="${glow}"/>`,
			);
	}
	const mouthY = screenY + screenH - 7;
	parts.push(
		`<path d="M${cx - 5} ${mouthY}v2h10v-2" fill="none" stroke="${glow}" stroke-width="2"/>`,
	);
	const top = pick(20, 4);
	if (top === 0)
		parts.push(
			voxel(cx - 1, hy - 12, 3, 9, 2, accent),
			voxel(cx - 4, hy - 15, 8, 5, 3, glow),
		);
	else if (top === 1) {
		parts.push(
			voxel(hx + 5, hy - 10, 6, 8, 3, accent),
			voxel(hx + hw - 13, hy - 10, 6, 8, 3, accent),
		);
	} else if (top === 2)
		parts.push(
			voxel(cx - 10, hy - 7, 20, 4, 4, accent),
			rect(cx - 7, hy - 6, 14, 2, glow),
		);
	else
		parts.push(
			voxel(cx - 4, hy - 11, 8, 8, 5, body),
			rect(cx - 2, hy - 9, 4, 4, glow),
		);
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" shape-rendering="crispEdges">${parts.join("")}</svg>`;
}
