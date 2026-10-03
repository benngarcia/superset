import {
	type PointerEventHandler,
	type RefObject,
	type TouchEventHandler,
	type UIEventHandler,
	useCallback,
	useEffect,
	useRef,
	type WheelEventHandler,
} from "react";

const STICKY_BOTTOM_THRESHOLD_PX = 4;
const USER_SCROLL_INTENT_MS = 350;
const SMOOTH_SCROLL_MIN_GAP_MS = 250;

export type StickyBottomScrollBinding = {
	contentRef: RefObject<HTMLDivElement | null>;
	onPointerDown: PointerEventHandler<HTMLDivElement>;
	onScroll: UIEventHandler<HTMLDivElement>;
	onTouchMove: TouchEventHandler<HTMLDivElement>;
	onTouchStart: TouchEventHandler<HTMLDivElement>;
	onWheel: WheelEventHandler<HTMLDivElement>;
};

function maxScrollOffset(element: HTMLElement): number {
	return Math.max(0, element.scrollHeight - element.clientHeight);
}

/**
 * Keeps a scroll box pinned to its bottom while content streams in, and lets
 * go the moment the reader scrolls away on purpose: a wheel, a touch or a
 * pointer drag marks intent, a programmatic scroll does not. Scrolling back
 * within a few pixels of the bottom pins it again.
 */
export function useStickyBottomScroll({
	contentKey,
	scrollRef,
	streaming,
}: {
	scrollRef: RefObject<HTMLDivElement | null>;
	contentKey: string;
	streaming: boolean;
}): StickyBottomScrollBinding {
	const contentRef = useRef<HTMLDivElement>(null);
	const stickRef = useRef(true);
	const pointerIntentRef = useRef(false);
	const intentUntilRef = useRef(0);
	const lastScrollAtRef = useRef(0);
	const firstScrollRef = useRef(true);
	const wasStreamingRef = useRef(streaming);
	const maxOffsetRef = useRef(0);

	useEffect(() => {
		const element = scrollRef.current;
		if (!element) return;
		maxOffsetRef.current = maxScrollOffset(element);
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(() => {
			maxOffsetRef.current = maxScrollOffset(element);
		});
		observer.observe(element);
		if (contentRef.current) observer.observe(contentRef.current);
		return () => observer.disconnect();
	}, [scrollRef]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: contentKey is the trigger, not an input
	useEffect(() => {
		const wasStreaming = wasStreamingRef.current;
		wasStreamingRef.current = streaming;
		if (!streaming && !wasStreaming) return;
		const element = scrollRef.current;
		if (!element || !stickRef.current) return;
		const now = performance.now();
		const top = maxScrollOffset(element);
		maxOffsetRef.current = top;
		const smooth =
			!firstScrollRef.current &&
			now - lastScrollAtRef.current >= SMOOTH_SCROLL_MIN_GAP_MS;
		if (smooth) element.scrollTo({ top, behavior: "smooth" });
		else element.scrollTop = top;
		lastScrollAtRef.current = now;
		firstScrollRef.current = false;
	}, [contentKey, scrollRef, streaming]);

	const markIntent = useCallback(() => {
		intentUntilRef.current = performance.now() + USER_SCROLL_INTENT_MS;
	}, []);
	const onPointerDown = useCallback<PointerEventHandler<HTMLDivElement>>(() => {
		pointerIntentRef.current = true;
	}, []);
	const onScroll = useCallback<UIEventHandler<HTMLDivElement>>((event) => {
		if (
			maxOffsetRef.current - event.currentTarget.scrollTop <=
			STICKY_BOTTOM_THRESHOLD_PX
		) {
			stickRef.current = true;
			return;
		}
		if (pointerIntentRef.current || performance.now() <= intentUntilRef.current)
			stickRef.current = false;
	}, []);

	useEffect(() => {
		if (!streaming) return;
		const release = () => {
			pointerIntentRef.current = false;
		};
		window.addEventListener("pointerup", release);
		window.addEventListener("pointercancel", release);
		return () => {
			window.removeEventListener("pointerup", release);
			window.removeEventListener("pointercancel", release);
		};
	}, [streaming]);

	return {
		contentRef,
		onPointerDown,
		onScroll,
		onTouchMove: markIntent,
		onTouchStart: markIntent,
		onWheel: markIntent,
	};
}
