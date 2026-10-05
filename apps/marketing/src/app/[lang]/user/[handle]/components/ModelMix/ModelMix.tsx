import { useLingui } from "@lingui/react/macro";
import { formatPercent } from "@superset/i18n/format";

export function ModelMix({
	models,
	totalTokens,
	locale,
}: {
	models: ReadonlyArray<{ model: string; tokens: string }>;
	totalTokens: string;
	locale: string;
}) {
	const { t } = useLingui();
	const total = Number(totalTokens);
	if (!(total > 0)) return null;
	const claude = models
		.filter((m) => m.model.startsWith("claude-"))
		.reduce((sum, m) => sum + Number(m.tokens), 0);
	const gpt = models
		.filter((m) => m.model.startsWith("gpt-"))
		.reduce((sum, m) => sum + Number(m.tokens), 0);
	const segments = [
		{ name: "Claude", value: claude, color: "#d25611" },
		{ name: "GPT", value: gpt, color: "#6b8ca3" },
		{
			name: t({ message: "Other" }),
			value: Math.max(0, total - claude - gpt),
			color: "#8a8a9e",
		},
	].filter((s) => s.value > 0);
	return (
		<div className="mb-6 border-b border-border pb-5">
			<dl className="flex flex-wrap gap-x-8 gap-y-3">
				{segments.map((s) => (
					<div key={s.name}>
						<dt className="flex items-center gap-2 text-xs text-muted-foreground">
							<span
								className="size-2 rounded-[1px]"
								style={{ backgroundColor: s.color }}
							/>
							{s.name}
						</dt>
						<dd className="mt-1 text-2xl font-medium tracking-tight tabular-nums">
							{formatPercent(
								s.value / total,
								{ maximumFractionDigits: 1 },
								locale,
							)}
						</dd>
					</div>
				))}
			</dl>
			<div
				aria-hidden="true"
				className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-[1px]"
			>
				{segments.map((s) => (
					<span
						key={s.name}
						style={{
							flexGrow: s.value,
							flexBasis: 0,
							backgroundColor: s.color,
						}}
					/>
				))}
			</div>
		</div>
	);
}
