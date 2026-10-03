import { cn } from "@superset/ui/utils";

/**
 * Truncates from the left, so a long path keeps the segments nearest the file.
 * The mark keeps the bidi algorithm from reordering the punctuation.
 */
export function TruncateStart({
	children,
	className,
	title,
}: {
	children: string;
	className?: string;
	title?: string;
}) {
	return (
		<span
			className={cn("block min-w-0 truncate", className)}
			dir="rtl"
			title={title}
		>
			{`‎${children}`}
		</span>
	);
}
