import { type FrameName, SPRITE_SIZE } from "./frames";
import { monsterFrame, monsterIndex } from "./monsters";

interface DinoSpriteProps {
	frame: FrameName;
	identity?: string;
	rgb: string;
	facing: "left" | "right";
	className?: string;
	style?: React.CSSProperties;
	flash?: boolean;
	title: string;
}

export function DinoSprite({
	frame,
	identity = "",
	rgb,
	facing,
	className = "",
	style,
	flash = false,
	title,
}: DinoSpriteProps) {
	const rows = monsterFrame(identity, frame);
	const variant = monsterIndex(identity);
	const palettes = [
		["#83c8a3", "#c6e6a4", "#385f56"],
		["#dfad86", "#f6d895", "#81564e"],
		["#85bad7", "#ffe09b", "#3c6079"],
		["#9bc98a", "#e4eeaf", "#527858"],
		["#b69cda", "#ffd5b1", "#655480"],
	] as const;
	const [base, accent, shade] = palettes[variant] ?? palettes[0];
	const pixels: Array<{ x: number; y: number; eye: boolean; fill: string }> =
		[];
	rows.forEach((row, y) => {
		for (let x = 0; x < row.length; x++) {
			if (row[x] !== "#" && row[x] !== "o") continue;
			const eye = row[x] === "o";
			const topEdge = !rows[y - 1] || rows[y - 1]?.[x] === ".";
			const bottomEdge = !rows[y + 1] || rows[y + 1]?.[x] === ".";
			const rightEdge = row[x + 1] !== "#" && row[x + 1] !== "o";
			const highlight =
				topEdge || (variant === 0 && x >= 15 && y > 5 && y < 13);
			pixels.push({
				x,
				y,
				eye,
				fill: flash
					? "#fff"
					: eye
						? "#fff1cf"
						: highlight
							? accent
							: bottomEdge || rightEdge
								? shade
								: base,
			});
		}
	});

	return (
		<svg
			viewBox={`0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}`}
			className={className}
			shapeRendering="crispEdges"
			style={{
				...style,
				transform: [
					facing === "left" ? "scaleX(-1)" : "",
					style?.transform ?? "",
				]
					.filter(Boolean)
					.join(" "),
				filter: flash
					? "drop-shadow(0 0 10px rgba(255,255,255,0.9))"
					: `drop-shadow(2px 3px 0 rgba(0,0,0,0.5)) drop-shadow(0 0 10px rgba(${rgb},0.12))`,
			}}
			role="img"
			aria-label={title}
		>
			<title>{title}</title>
			{pixels.map((pixel) => (
				<rect
					key={`${pixel.x}-${pixel.y}`}
					x={pixel.x}
					y={pixel.y}
					width={1}
					height={1}
					fill={pixel.fill}
				/>
			))}
			{!flash &&
				pixels
					.filter((pixel) => pixel.eye)
					.map((pixel) => (
						<rect
							key={`eye-${pixel.x}-${pixel.y}`}
							x={pixel.x + 0.45}
							y={pixel.y + 0.3}
							width={0.5}
							height={0.6}
							fill="#18202a"
						/>
					))}
		</svg>
	);
}
