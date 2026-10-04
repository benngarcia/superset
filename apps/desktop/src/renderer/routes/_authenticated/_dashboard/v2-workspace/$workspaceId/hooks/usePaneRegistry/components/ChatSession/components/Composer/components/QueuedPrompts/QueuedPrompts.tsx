import { Trans, useLingui } from "@lingui/react/macro";
import type { UserMessage } from "@superset/chat/protocol";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import {
	CornerDownRight,
	Ellipsis,
	ListEnd,
	Pause,
	Play,
	Trash2,
} from "lucide-react";
import { userMessageText } from "../../../../utils/userMessageText";

export function QueuedPrompts({
	prompts,
	paused,
	actionable,
	onClear,
	onEdit,
	onRemove,
	onResume,
	onSteer,
}: {
	prompts: UserMessage[];
	paused: boolean;
	actionable: boolean;
	onClear: () => void;
	onEdit: (prompt: UserMessage) => void;
	onRemove: (id: string) => void;
	onResume: () => void;
	onSteer: (id: string) => void;
}) {
	const { t } = useLingui();
	if (prompts.length === 0) return null;

	return (
		<div className="mx-4 max-h-56 overflow-y-auto rounded-t-2xl border border-border/60 border-b-0 bg-muted/40 py-1">
			{paused && (
				<div className="flex items-center gap-2 border-border/60 border-b py-1.5 pr-2 pl-3 text-muted-foreground text-sm">
					<Pause className="size-3.5 shrink-0" />
					<span className="min-w-0 flex-1 truncate">
						<Trans>Queue paused because you interrupted</Trans>
					</span>
					{actionable && (
						<button
							className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors hover:bg-accent hover:text-foreground"
							onClick={onClear}
							type="button"
						>
							<Trash2 className="size-3.5" />
							<Trans>Clear all</Trans>
						</button>
					)}
					<button
						className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors hover:bg-accent hover:text-foreground"
						onClick={onResume}
						type="button"
					>
						<Play className="size-3.5" />
						<Trans>Resume</Trans>
					</button>
				</div>
			)}
			{prompts.map((prompt) => {
				const text = userMessageText(prompt);
				const attachmentNames = prompt.content.flatMap((content) =>
					content.type === "attachment" ? [content.name] : [],
				);
				return (
					<div
						className="flex items-center gap-2 py-1 pr-2 pl-3 text-sm"
						key={prompt.id}
					>
						<ListEnd className="size-4 shrink-0 text-muted-foreground" />
						<span className="min-w-0 flex-1 truncate">
							{text || attachmentNames.join(", ")}
						</span>
						{actionable && (
							<>
								<Tooltip>
									<TooltipTrigger asChild>
										<button
											className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-foreground"
											onClick={() => onSteer(prompt.id)}
											type="button"
										>
											<CornerDownRight className="size-3.5" />
											<Trans>Steer</Trans>
										</button>
									</TooltipTrigger>
									<TooltipContent>
										<Trans>Stop the agent and send this now</Trans>
									</TooltipContent>
								</Tooltip>
								<button
									aria-label={t({ message: "Remove queued message" })}
									className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
									onClick={() => onRemove(prompt.id)}
									type="button"
								>
									<Trash2 className="size-3.5" />
								</button>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button
											aria-label={t({ message: "More actions" })}
											className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
											type="button"
										>
											<Ellipsis className="size-3.5" />
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem
											disabled={attachmentNames.length > 0}
											onSelect={() => onEdit(prompt)}
										>
											<Trans>Edit</Trans>
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</>
						)}
					</div>
				);
			})}
		</div>
	);
}
