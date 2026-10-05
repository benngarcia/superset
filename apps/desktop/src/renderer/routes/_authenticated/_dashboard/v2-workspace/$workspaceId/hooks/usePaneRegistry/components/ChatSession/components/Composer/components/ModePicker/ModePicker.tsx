import { useLingui } from "@lingui/react/macro";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { cn } from "@superset/ui/utils";
import {
	Eye,
	FilePen,
	Hand,
	type LucideIcon,
	NotebookPen,
	ShieldAlert,
	ShieldCheck,
} from "lucide-react";
import { LuCheck, LuChevronDown } from "react-icons/lu";
import { isUnrestrictedMode } from "../../../../utils/isUnrestrictedMode";
import {
	MENU_DESCRIPTION_CLASS,
	PILL_CHEVRON_CLASS,
	PILL_TRIGGER_CLASS,
} from "../../constants";

export type SessionMode = { id: string; label: string };

type ModeCopy = {
	title: string;
	description: string;
	icon: LucideIcon;
	unrestricted?: boolean;
};

const HIDDEN_MODE_IDS = new Set(["plan"]);

export function ModePicker({
	currentModeId,
	modes,
	onSelect,
}: {
	modes: SessionMode[];
	currentModeId: string | undefined;
	onSelect: (modeId: string) => void;
}) {
	const { t } = useLingui();
	const offeredModes = modes.filter((mode) => !HIDDEN_MODE_IDS.has(mode.id));
	if (offeredModes.length < 2) return null;

	const knownModes: Record<string, ModeCopy> = {
		default: {
			title: t({ message: "Ask for approval" }),
			description: t({
				message: "Ask before editing files or running commands",
			}),
			icon: Hand,
		},
		acceptEdits: {
			title: t({ message: "Approve edits" }),
			description: t({
				message: "Edit files without asking; ask before commands",
			}),
			icon: FilePen,
		},
		plan: {
			title: t({ message: "Plan" }),
			description: t({ message: "Read and plan without changing anything" }),
			icon: NotebookPen,
		},
		"read-only": {
			title: t({ message: "Read only" }),
			description: t({ message: "Read files; ask for anything else" }),
			icon: Eye,
		},
		auto: {
			title: t({ message: "Approve for me" }),
			description: t({ message: "Ask only for actions that look risky" }),
			icon: ShieldCheck,
		},
		bypassPermissions: {
			title: t({ message: "Full access" }),
			description: t({
				message:
					"Unrestricted access to the internet and any file on your computer",
			}),
			icon: ShieldAlert,
		},
		"full-access": {
			title: t({ message: "Full access" }),
			description: t({
				message:
					"Unrestricted access to the internet and any file on your computer",
			}),
			icon: ShieldAlert,
		},
		"agent-full-access": {
			title: t({ message: "Full access" }),
			description: t({
				message:
					"Unrestricted access to the internet and any file on your computer",
			}),
			icon: ShieldAlert,
		},
		agent: {
			title: t({ message: "Approve for me" }),
			description: t({ message: "Ask only for actions that look risky" }),
			icon: ShieldCheck,
		},
	};
	const copyFor = (mode: SessionMode): ModeCopy => ({
		...(knownModes[mode.id] ?? {
			title: mode.label,
			description: "",
			icon: Hand,
		}),
		unrestricted: isUnrestrictedMode(mode.id),
	});

	const current =
		modes.find((mode) => mode.id === currentModeId) ?? offeredModes[0];
	if (!current) return null;
	const currentCopy = copyFor(current);
	const CurrentIcon = currentCopy.icon;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					className={cn(PILL_TRIGGER_CLASS, "group max-w-40")}
					type="button"
				>
					<CurrentIcon
						className={cn(
							"size-3.5 shrink-0",
							currentCopy.unrestricted &&
								"text-orange-600 dark:text-orange-400",
						)}
					/>
					<span className="truncate">{currentCopy.title}</span>
					<LuChevronDown className={PILL_CHEVRON_CLASS} />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-72 rounded-xl" side="top">
				<DropdownMenuLabel className="py-1 text-[11px] font-normal text-muted-foreground">
					{t({ message: "How should the agent's actions be approved?" })}
				</DropdownMenuLabel>
				{offeredModes.map((mode) => {
					const copy = copyFor(mode);
					const Icon = copy.icon;
					return (
						<DropdownMenuItem
							className={cn(
								"items-start gap-2 rounded-md py-1.5 text-xs",
								copy.unrestricted && "text-orange-600 dark:text-orange-400",
							)}
							key={mode.id}
							onSelect={() => {
								if (mode.id !== currentModeId) onSelect(mode.id);
							}}
						>
							<Icon className="mt-px size-3.5 shrink-0" />
							<div className="flex min-w-0 flex-1 flex-col">
								<span>{copy.title}</span>
								{copy.description ? (
									<span
										className={cn(
											MENU_DESCRIPTION_CLASS,
											copy.unrestricted
												? "text-orange-600/80 dark:text-orange-400/80"
												: "text-muted-foreground",
										)}
									>
										{copy.description}
									</span>
								) : null}
							</div>
							{mode.id === current.id ? (
								<LuCheck className="mt-px size-3.5 shrink-0" />
							) : null}
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
