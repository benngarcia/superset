import { formatDate } from "@superset/i18n/format";
import type { About } from "@/lib/about";
import type { Person } from "@/lib/people";

interface PrinciplesProps {
	principles: About["principles"];
	people: Person[];
	locale: string;
}

export function Principles({ principles, people, locale }: PrinciplesProps) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
			{principles.map((principle) => {
				const author = people.find((p) => p.id === principle.author);

				return (
					<article
						key={`${principle.author}-${principle.title}`}
						className="border-t border-border pt-5"
					>
						<p className="font-mono text-xs text-muted-foreground">
							{formatDate(
								principle.date,
								{
									year: "numeric",
									month: "short",
									day: "numeric",
									timeZone: "UTC",
								},
								locale,
							)}
						</p>
						<p className="font-mono text-xs text-muted-foreground mt-1">
							{author?.name ?? principle.author}
							{author?.github && (
								<>
									{" "}
									<a
										href={`https://github.com/${author.github}`}
										target="_blank"
										rel="noopener noreferrer"
										className="hover:text-foreground transition-colors"
									>
										@{author.github}
									</a>
								</>
							)}
						</p>
						<h3 className="text-lg font-medium text-foreground mt-4">
							{principle.title}
						</h3>
						<p className="text-muted-foreground leading-relaxed mt-2">
							{principle.body}
						</p>
					</article>
				);
			})}
		</div>
	);
}
