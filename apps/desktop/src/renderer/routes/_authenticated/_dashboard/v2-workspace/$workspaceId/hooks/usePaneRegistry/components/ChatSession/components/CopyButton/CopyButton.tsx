import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const COPIED_MS = 1500;

/** Copies `text` and shows a check for a moment instead of a toast. */
export function CopyButton({
	className,
	iconClassName = "size-3.5",
	label,
	text,
}: {
	text: string;
	label: string;
	className?: string;
	iconClassName?: string;
}) {
	const { t } = useLingui();
	const [copied, setCopied] = useState(false);
	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), COPIED_MS);
		return () => clearTimeout(timer);
	}, [copied]);
	const copy = useCallback(() => {
		void navigator.clipboard
			.writeText(text)
			.then(() => setCopied(true))
			.catch((error: unknown) => {
				console.error("[chat] copy failed", error);
			});
	}, [text]);
	return (
		<button
			aria-label={copied ? t({ message: "Copied" }) : label}
			className={cn(
				"rounded p-1 text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground",
				copied && "text-foreground",
				className,
			)}
			onClick={copy}
			type="button"
		>
			{copied ? (
				<Check className={iconClassName} />
			) : (
				<Copy className={iconClassName} />
			)}
		</button>
	);
}
