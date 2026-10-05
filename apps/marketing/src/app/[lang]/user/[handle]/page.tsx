import { Trans, useLingui } from "@lingui/react/macro";
import { COMPANY } from "@superset/shared/constants";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ContributionGraph } from "@/app/[lang]/components/ContributionGraph";
import { LeaderboardBackLink } from "@/app/[lang]/components/LeaderboardBackLink";
import { LeaderboardLayout } from "@/app/[lang]/components/LeaderboardLayout";
import { LeaderboardPanel } from "@/app/[lang]/components/LeaderboardPanel";
import {
	buildModelColors,
	ModelBars,
	toTokenRows,
} from "@/app/[lang]/components/ModelBars";
import { StatStrip } from "@/app/[lang]/components/StatStrip";
import { tierRgb } from "@/app/[lang]/components/TierBadge";
import { TierIcon } from "@/app/[lang]/components/TierIcon";
import { TierObjectives } from "@/app/[lang]/components/TierObjectives";
import { TierTube } from "@/app/[lang]/components/TierTube";
import { TokenSplitBar } from "@/app/[lang]/components/TokenSplitBar";
import { localeUrl, localizedAlternates } from "@/app/[lang]/metadata";
import { avatarUrl } from "@/app/[lang]/utils/avatarUrl";
import {
	dayCount,
	formatCount,
	formatDayRange,
	formatTokens,
	formatUsd,
} from "@/app/[lang]/utils/formatUsage";
import { initServerI18n } from "@/app/i18n-server";
import { AchievementShelf } from "./components/AchievementShelf";
import { ProfileLinks } from "./components/ProfileLinks";
import { ProfileUnavailable } from "./components/ProfileUnavailable";
import { ShareButtons } from "./components/ShareButtons";
import { ViewToggle } from "./components/ViewToggle";
import { loadProfile } from "./utils/loadProfile";

export const instant = false;

interface PageProps {
	params: Promise<{ handle: string }>;
}

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const lang = await initServerI18n();
	const { handle } = await params;
	const lookup = await loadProfile(handle);

	if (lookup.state === "missing") {
		return { title: "Not found", robots: { index: false } };
	}
	if (lookup.state === "rate-limited" || lookup.state === "unavailable") {
		return { title: "Try again shortly", robots: { index: false } };
	}

	const { profile } = lookup;
	const who = profile.name ?? `@${profile.handle}`;
	const title = `${who} · #${profile.rank} on the ${COMPANY.NAME} leaderboard`;
	const description = `${formatTokens(profile.allTime.tokens, lang)} tokens and ${formatUsd(
		profile.allTime.usd,
		lang,
	)} of API-equivalent agent usage across ${formatCount(
		profile.models.length,
		lang,
	)} models.`;
	const url = localeUrl(lang, `/${profile.handle}`);

	return {
		title,
		description,
		alternates: localizedAlternates(lang, `/${profile.handle}`),

		openGraph: {
			title,
			description,
			url,
			siteName: COMPANY.NAME,
			type: "profile",
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
		},
	};
}

export default async function UserProfilePage({ params }: PageProps) {
	await connection();
	const locale = await initServerI18n();

	const { t } = useLingui();
	const { handle } = await params;
	const lookup = await loadProfile(handle);

	if (lookup.state === "missing") notFound();
	if (lookup.state === "rate-limited" || lookup.state === "unavailable") {
		return <ProfileUnavailable rateLimited={lookup.state === "rate-limited"} />;
	}

	const { profile } = lookup;
	const colors = buildModelColors([profile.models]);
	const shareUrl = `${COMPANY.MARKETING_URL.replace(/\/$/, "")}/${profile.handle}`;
	const company = COMPANY.NAME;
	const profileHandle = profile.handle;
	const rank = profile.rank;
	const total = profile.total;
	const tokens = formatTokens(profile.allTime.tokens, locale);
	const days = profile.dayRange ? dayCount(profile.dayRange) : 0;
	const shareText = t({
		message: `I'm #${rank} on the ${company} leaderboard with ${tokens} tokens of agent usage.`,
	});

	const tier = profile.factory?.tier ?? 0;
	const tint = tier >= 1 ? tierRgb(tier) : undefined;

	return (
		<LeaderboardLayout compact>
			<div className="flex flex-wrap items-center justify-between gap-3 mb-6">
				<LeaderboardBackLink />
				<ViewToggle handle={profileHandle} />
			</div>

			<header className="text-center">
				<div className="relative mx-auto w-fit">
					<Image
						src={avatarUrl(profile.handle)}
						alt=""
						width={72}
						height={72}
						unoptimized
						className="size-18 rounded-[2px] bg-foreground/[0.04] [image-rendering:pixelated]"
						style={
							tint
								? {
										boxShadow: `0 0 0 1px rgba(${tint},0.45), 0 0 28px rgba(${tint},0.22)`,
									}
								: undefined
						}
					/>
					{tier >= 1 && (
						<span
							className="absolute -bottom-2 -right-2 flex size-7 items-center justify-center border border-border bg-background"
							style={{ color: `rgb(${tint})` }}
						>
							<TierIcon tier={tier} size={18} />
						</span>
					)}
				</div>
				<h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-foreground mt-5 leading-tight">
					{profile.name ?? profile.handle}
				</h1>
				<p className="text-sm text-muted-foreground mt-2.5">
					{`@${profileHandle}`}
					<span className="mx-2 text-muted-foreground/40">·</span>
					<Link
						href="/leaderboard"
						className="hover:text-brand transition-colors"
					>
						<Trans>
							rank #{rank} of {total}
						</Trans>
					</Link>
				</p>

				{profile.bio && (
					<p className="max-w-md mx-auto text-sm text-foreground/80 leading-relaxed mt-5">
						{profile.bio}
					</p>
				)}

				<ProfileLinks
					githubHandle={profile.githubHandle}
					xHandle={profile.xHandle}
					websiteUrl={profile.websiteUrl}
				/>

				<div className="mt-7">
					<ShareButtons url={shareUrl} text={shareText} />
				</div>
			</header>

			<div className="mt-10 md:mt-12 space-y-6">
				<TierTube
					subject="you"
					position={
						profile.factory
							? profile.factory.tier + Math.min(0.9, profile.factory.progress)
							: 0
					}
					footer={<TierObjectives tier={tier} axes={profile.axes} />}
				/>

				<AchievementShelf awards={profile.awards} />

				<StatStrip
					stats={[
						{
							label: t({
								message: "Tokens",
							}),
							value: tokens,
							hint: t({
								message: "all time",
							}),
						},
						{
							label: t({
								message: "Cost",
							}),
							value: formatUsd(profile.allTime.usd, locale),
							hint: t({
								message: "API-equivalent",
							}),
						},
						{
							label: t({
								message: "Rank",
							}),
							value: `#${rank}`,
							hint: t({
								message: `of ${total}`,
							}),
						},
						{
							label: t({
								message: "Tracking",
							}),

							value: profile.dayRange
								? t({
										message: `${days}d`,
									})
								: "—",
							hint: profile.dayRange
								? formatDayRange(profile.dayRange, locale)
								: undefined,
						},
					]}
				/>

				<LeaderboardPanel title={<Trans>Contributions</Trans>}>
					<ContributionGraph
						daily={profile.daily}
						endDay={new Date().toISOString().slice(0, 10)}
						rgb="210,86,17"
					/>
				</LeaderboardPanel>

				<LeaderboardPanel title={<Trans>Models</Trans>}>
					<ModelBars
						rows={toTokenRows(
							profile.models.map((model) => ({ ...model, usd: model.usd })),
							locale,
						)}
						colors={colors}
					/>
				</LeaderboardPanel>

				<LeaderboardPanel title={<Trans>Token breakdown</Trans>}>
					<TokenSplitBar split={profile.tokenSplit} />
				</LeaderboardPanel>
			</div>
		</LeaderboardLayout>
	);
}
