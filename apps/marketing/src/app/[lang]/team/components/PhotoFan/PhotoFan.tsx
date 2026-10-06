"use client";

import { useLingui } from "@lingui/react/macro";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@superset/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { type CSSProperties, type KeyboardEvent, useState } from "react";
import type { About } from "@/lib/about";

const CARD_SPACING_PX = 92;
const CARD_TILT_DEG = 4;
const CARD_DROP_PX = 4;

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

interface PhotoFanProps {
	photos: About["photos"];
}

export function PhotoFan({ photos }: PhotoFanProps) {
	const { t } = useLingui();
	const [openIndex, setOpenIndex] = useState<number | null>(null);
	const middle = (photos.length - 1) / 2;
	const openPhoto = openIndex === null ? null : photos[openIndex];

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
			<ul className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-6 px-6 md:mx-0 md:px-0 md:pb-0 md:block md:relative md:h-[400px] md:overflow-visible">
				{photos.map((photo, index) => {
					const offset = index - middle;
					const [tilt, jitterX, jitterY, scale] =
						CARD_JITTER[index % CARD_JITTER.length] ?? NO_JITTER;
					const fanStyle = {
						"--fan-x": `${offset * CARD_SPACING_PX + jitterX}px`,
						"--fan-y": `${offset * offset * CARD_DROP_PX + jitterY}px`,
						"--fan-r": `${offset * CARD_TILT_DEG + tilt}deg`,
						"--fan-s": scale,
						"--fan-z": photos.length - Math.round(Math.abs(offset)),
					} as CSSProperties;

					return (
						<li
							key={photo.src}
							style={fanStyle}
							className="group shrink-0 w-56 snap-center md:absolute md:[z-index:var(--fan-z)] md:left-1/2 md:top-8 md:w-[200px] md:-ml-[100px] md:transition-transform md:duration-300 md:ease-out md:[transform:translateX(var(--fan-x))_translateY(var(--fan-y))_rotate(var(--fan-r))_scale(var(--fan-s))] md:hover:z-50 md:hover:[transform:translateX(var(--fan-x))_translateY(calc(var(--fan-y)-24px))_rotate(0deg)_scale(1.12)]"
						>
							<button
								type="button"
								onClick={() => setOpenIndex(index)}
								className="block w-full cursor-zoom-in text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
							>
								<figure className="m-0 bg-[#f4f1ea] p-2 pb-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
									<div className="relative aspect-[4/5] overflow-hidden bg-neutral-300">
										<Image
											src={photo.src}
											alt={photo.alt}
											fill
											className="object-cover"
											sizes="224px"
										/>
									</div>
									<figcaption className="mt-2 min-h-[2.5rem] text-[11px] leading-snug text-neutral-700 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
										{photo.caption}
									</figcaption>
								</figure>
							</button>
						</li>
					);
				})}
			</ul>

			<Dialog
				modal
				open={openPhoto !== null}
				onOpenChange={(open) => {
					if (!open) setOpenIndex(null);
				}}
			>
				{openPhoto && (
					<DialogContent
						onKeyDown={handleKeyDown}
						className="w-auto max-w-[calc(100vw-2rem)] sm:max-w-[min(92vw,1100px)] gap-0 rounded-none border-0 bg-[#f4f1ea] p-3 pb-4 text-neutral-800 shadow-2xl [&_[data-slot=dialog-close]]:text-neutral-700"
					>
						<DialogTitle className="sr-only">{openPhoto.caption}</DialogTitle>
						<DialogDescription className="sr-only">
							{openPhoto.alt}
						</DialogDescription>
						<Image
							key={openPhoto.src}
							src={openPhoto.src}
							alt={openPhoto.alt}
							width={1600}
							height={1200}
							sizes="(max-width: 1100px) 92vw, 1100px"
							className="h-auto max-h-[72vh] w-auto max-w-full"
						/>
						<div className="mt-3 flex items-center justify-between gap-4">
							<p className="text-sm leading-snug">{openPhoto.caption}</p>
							<div className="flex shrink-0 gap-1">
								<button
									type="button"
									onClick={() => step(-1)}
									aria-label={t`Previous`}
									className="rounded-sm p-1.5 text-neutral-700 hover:bg-neutral-300/60"
								>
									<ChevronLeft className="size-4" />
								</button>
								<button
									type="button"
									onClick={() => step(1)}
									aria-label={t`Next`}
									className="rounded-sm p-1.5 text-neutral-700 hover:bg-neutral-300/60"
								>
									<ChevronRight className="size-4" />
								</button>
							</div>
						</div>
					</DialogContent>
				)}
			</Dialog>
		</>
	);
}
