"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@superset/ui/dialog";
import { m, useReducedMotion } from "framer-motion";
import {
	type CSSProperties,
	type KeyboardEvent,
	useRef,
	useState,
} from "react";
import type { About } from "@/lib/about";
import { PhotoPrint } from "./components/PhotoPrint";

const CARD_SPACING_PX = 92;
const CARD_TILT_DEG = 4;
const CARD_DROP_PX = 4;
const FULL_MAX_WIDTH_PX = 960;
const FULL_MAX_WIDTH_VW = 0.9;
const FULL_PHOTO_MAX_HEIGHT_VH = 0.62;
const FULL_PHOTO_ASPECT = 3 / 2;

// [extra tilt deg, x px, y px, scale], cycled per card. Fixed so server and
// client render the same styles.
const CARD_JITTER: ReadonlyArray<readonly [number, number, number, number]> = [
	[-2.5, -6, 10, 0.97],
	[1.8, 8, -6, 1.03],
	[-1.2, -4, 14, 0.95],
	[2.6, 6, -10, 1.02],
	[-0.6, 0, 4, 1.05],
	[2.2, -8, 12, 0.98],
	[-2.8, 10, -4, 1.01],
	[1.1, -6, 8, 0.96],
	[-1.9, 4, -8, 1.04],
];
const NO_JITTER = [0, 0, 0, 1] as const;

type FlipFrame = {
	x: number;
	y: number;
	scale: number;
	rotate: number;
};

const RESTING: FlipFrame = { x: 0, y: 0, scale: 1, rotate: 0 };

interface PhotoFanProps {
	photos: About["photos"];
}

export function PhotoFan({ photos }: PhotoFanProps) {
	const reduceMotion = useReducedMotion();
	const cardRefs = useRef<Array<HTMLLIElement | null>>([]);
	const [openIndex, setOpenIndex] = useState<number | null>(null);
	const [from, setFrom] = useState<FlipFrame>(RESTING);
	const [closing, setClosing] = useState(false);
	const middle = (photos.length - 1) / 2;
	const openPhoto = openIndex === null ? null : photos[openIndex];

	const cardTilt = (index: number) => {
		const [tilt] = CARD_JITTER[index % CARD_JITTER.length] ?? NO_JITTER;
		return (index - middle) * CARD_TILT_DEG + tilt;
	};

	const fullWidth = () =>
		Math.min(
			window.innerWidth * FULL_MAX_WIDTH_VW,
			FULL_MAX_WIDTH_PX,
			window.innerHeight * FULL_PHOTO_MAX_HEIGHT_VH * FULL_PHOTO_ASPECT,
		);

	const frameFromCard = (index: number): FlipFrame => {
		const card = cardRefs.current[index];
		if (!card) return RESTING;
		const rect = card.getBoundingClientRect();
		const isFanned = window.matchMedia("(min-width: 768px)").matches;
		return {
			x: rect.left + rect.width / 2 - window.innerWidth / 2,
			y: rect.top + rect.height / 2 - window.innerHeight / 2,
			scale: rect.width / fullWidth(),
			rotate: isFanned ? cardTilt(index) : 0,
		};
	};

	const open = (index: number) => {
		setFrom(frameFromCard(index));
		setClosing(false);
		setOpenIndex(index);
	};

	const close = () => {
		if (openIndex === null) return;
		if (reduceMotion) {
			setOpenIndex(null);
			return;
		}
		setFrom(frameFromCard(openIndex));
		setClosing(true);
	};

	const step = (delta: number) =>
		setOpenIndex((current) =>
			current === null
				? current
				: (current + delta + photos.length) % photos.length,
		);

	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === "ArrowLeft") step(-1);
		if (event.key === "ArrowRight") step(1);
	};

	return (
		<>
			<ul className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-6 px-6 md:mx-0 md:px-0 md:pb-0 md:block md:relative md:h-[420px] md:overflow-visible">
				{photos.map((photo, index) => {
					const offset = index - middle;
					const [, jitterX, jitterY, scale] =
						CARD_JITTER[index % CARD_JITTER.length] ?? NO_JITTER;
					const fanStyle = {
						"--fan-x": `${offset * CARD_SPACING_PX + jitterX}px`,
						"--fan-y": `${offset * offset * CARD_DROP_PX + jitterY}px`,
						"--fan-r": `${cardTilt(index)}deg`,
						"--fan-s": scale,
						"--fan-z": photos.length - Math.round(Math.abs(offset)),
						visibility: index === openIndex ? "hidden" : undefined,
					} as CSSProperties;

					return (
						<li
							key={photo.src}
							ref={(element) => {
								cardRefs.current[index] = element;
							}}
							style={fanStyle}
							className="group shrink-0 w-56 snap-center md:absolute md:[z-index:var(--fan-z)] md:left-1/2 md:top-8 md:w-[200px] md:-ml-[100px] md:transition-transform md:duration-300 md:ease-out md:[transform:translateX(var(--fan-x))_translateY(var(--fan-y))_rotate(var(--fan-r))_scale(var(--fan-s))] md:hover:z-50 md:hover:[transform:translateX(var(--fan-x))_translateY(calc(var(--fan-y)-24px))_rotate(0deg)_scale(1.12)]"
						>
							<button
								type="button"
								onClick={() => open(index)}
								className="block w-full cursor-zoom-in text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
							>
								<PhotoPrint
									photo={photo}
									wear={index}
									variant="card"
									sizes="224px"
								/>
							</button>
						</li>
					);
				})}
			</ul>

			<Dialog
				modal
				open={openPhoto !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) close();
				}}
			>
				{openPhoto && openIndex !== null && (
					<DialogContent
						showCloseButton={false}
						onKeyDown={handleKeyDown}
						className="w-auto max-w-none sm:max-w-none gap-0 rounded-none border-0 bg-transparent p-0 shadow-none duration-0"
					>
						<DialogTitle className="sr-only">{openPhoto.caption}</DialogTitle>
						<DialogDescription className="sr-only">
							{openPhoto.alt}
						</DialogDescription>
						<m.div
							initial={reduceMotion ? false : from}
							animate={closing ? from : RESTING}
							transition={{ type: "spring", stiffness: 220, damping: 28 }}
							onAnimationComplete={() => {
								if (closing) {
									setClosing(false);
									setOpenIndex(null);
								}
							}}
							onClick={close}
							className="cursor-zoom-out"
							style={{ width: fullWidth() }}
						>
							<PhotoPrint
								key={openPhoto.src}
								photo={openPhoto}
								wear={openIndex}
								variant="full"
								priority
								sizes="(max-width: 1066px) 90vw, 960px"
							/>
						</m.div>
					</DialogContent>
				)}
			</Dialog>
		</>
	);
}
