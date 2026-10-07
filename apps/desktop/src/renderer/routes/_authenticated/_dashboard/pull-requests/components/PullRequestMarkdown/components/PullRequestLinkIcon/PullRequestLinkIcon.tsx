import { cn } from "@superset/ui/utils";
import { Globe } from "lucide-react";
import { useState } from "react";
import { FaGithub } from "react-icons/fa";

const ICON_CLASS_NAME =
	"mr-1 inline-block size-[1em] shrink-0 -translate-y-px align-middle";

function hostnameOf(url: string): string | null {
	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		return null;
	}
}

interface PullRequestLinkIconProps {
	url: string;
	className?: string;
}

/** The site a link points at: GitHub's mark for GitHub, else the site's favicon. */
export function PullRequestLinkIcon({
	url,
	className,
}: PullRequestLinkIconProps) {
	const host = hostnameOf(url);
	const [failed, setFailed] = useState(false);
	if (host === "github.com" || host?.endsWith(".github.com")) {
		return <FaGithub aria-hidden className={cn(ICON_CLASS_NAME, className)} />;
	}
	if (!host || failed) {
		return (
			<Globe
				aria-hidden
				strokeWidth={1.75}
				className={cn(ICON_CLASS_NAME, "opacity-70", className)}
			/>
		);
	}
	return (
		<img
			src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`}
			alt=""
			aria-hidden
			loading="lazy"
			decoding="async"
			draggable={false}
			onError={() => setFailed(true)}
			className={cn(ICON_CLASS_NAME, "rounded-[2px] object-contain", className)}
		/>
	);
}
