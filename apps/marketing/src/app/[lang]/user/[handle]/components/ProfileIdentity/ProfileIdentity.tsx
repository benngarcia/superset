import Image from "next/image";
import { tierRgb } from "@/app/[lang]/components/TierBadge";
import { avatarUrl } from "@/app/[lang]/utils/avatarUrl";
import type { ParticipantProfile } from "@/app/[lang]/utils/fetchLeaderboard";
import { ProfileLinks } from "../ProfileLinks";
import { ShareButtons } from "../ShareButtons";

export function ProfileIdentity({
	profile,
	shareUrl,
	shareText,
}: {
	profile: ParticipantProfile;
	shareUrl: string;
	shareText: string;
}) {
	const tier = profile.factory?.tier ?? 0;
	const tint = tier >= 1 ? tierRgb(tier) : undefined;
	return (
		<header className="min-w-0">
			<div className="flex items-center gap-4 lg:flex-col lg:items-start lg:gap-5">
				<Image
					src={avatarUrl(profile.handle)}
					alt=""
					width={96}
					height={96}
					unoptimized
					className="size-20 shrink-0 rounded-[2px] bg-foreground/[0.04] [image-rendering:pixelated] lg:size-24"
					style={
						tint
							? {
									boxShadow: `0 0 0 1px rgba(${tint},0.35), 0 0 28px rgba(${tint},0.12)`,
								}
							: undefined
					}
				/>
				<div className="min-w-0">
					<h1 className="text-2xl font-medium tracking-tight text-foreground break-words lg:text-3xl">
						{profile.name ?? profile.handle}
					</h1>
					<p className="mt-1 text-sm text-muted-foreground break-all">
						@{profile.handle}
					</p>
				</div>
			</div>
			{profile.bio && (
				<p className="mt-5 text-sm leading-relaxed text-muted-foreground break-words">
					{profile.bio}
				</p>
			)}
			<ProfileLinks
				githubHandle={profile.githubHandle}
				xHandle={profile.xHandle}
				websiteUrl={profile.websiteUrl}
			/>
			<div className="mt-2">
				<ShareButtons url={shareUrl} text={shareText} />
			</div>
		</header>
	);
}
