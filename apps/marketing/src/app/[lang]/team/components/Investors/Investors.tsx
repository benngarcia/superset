import type { About } from "@/lib/about";

interface InvestorsProps {
	investors: About["investors"];
}

export function Investors({ investors }: InvestorsProps) {
	return (
		<ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 border-t border-l border-border">
			{investors.map((investor) => (
				<li key={investor.name} className="border-r border-b border-border p-5">
					{investor.href ? (
						<a
							href={investor.href}
							target="_blank"
							rel="noopener noreferrer"
							className="text-foreground font-medium hover:text-foreground/80 transition-colors"
						>
							{investor.name}
						</a>
					) : (
						<span className="text-foreground font-medium">{investor.name}</span>
					)}
					{investor.detail && (
						<p className="text-sm text-muted-foreground mt-1">
							{investor.detail}
						</p>
					)}
				</li>
			))}
		</ul>
	);
}
