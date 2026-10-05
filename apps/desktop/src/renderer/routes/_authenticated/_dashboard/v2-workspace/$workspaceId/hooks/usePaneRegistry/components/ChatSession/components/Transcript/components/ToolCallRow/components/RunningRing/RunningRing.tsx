import { cn } from "@superset/ui/utils";

export function RunningRing({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={cn("animate-spin-slow motion-reduce:animate-none", className)}
			fill="none"
			stroke="currentColor"
			strokeLinecap="round"
			strokeWidth="2"
			viewBox="0 0 24 24"
		>
			<circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
		</svg>
	);
}
