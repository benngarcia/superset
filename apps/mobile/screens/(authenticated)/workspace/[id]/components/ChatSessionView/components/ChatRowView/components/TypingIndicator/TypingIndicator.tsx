import { Shimmer } from "@/components/ai-elements/shimmer";

export function TypingIndicator({ label }: { label: string }) {
	return <Shimmer className="text-[14px]">{label}</Shimmer>;
}
