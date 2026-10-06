import { Trans, useLingui } from "@lingui/react/macro";
import { errorMessage } from "@superset/i18n/errors";
import { Button } from "@superset/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { toast } from "@superset/ui/sonner";
import { cn } from "@superset/ui/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowUp,
	Bot,
	ChevronDown,
	ExternalLink,
	Folder,
	LoaderCircle,
	Plus,
} from "lucide-react";
import { useState } from "react";
import { useHostProjects } from "renderer/hooks/host-projects/useHostProjects";
import { useV2AgentConfigs } from "renderer/hooks/useV2AgentConfigs";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { useWorkspaceCreates } from "renderer/stores/workspace-creates/useWorkspaceCreates";
import type { PullRequestDetail } from "../../hooks/usePullRequestDetail";

interface PullRequestAskComposerProps {
	projectId: string;
	hostId: string;
	hostUrl: string;
	data: PullRequestDetail;
	className?: string;
}

/** The question, with the pull request named so a fresh agent has its bearings. */
export function buildPullRequestQuestionPrompt(
	data: Pick<PullRequestDetail, "number" | "title" | "url">,
	question: string,
): string {
	return `About pull request #${data.number} "${data.title}" (${data.url}): ${question.trim()}`;
}

/**
 * The composer that floats over the bottom of the detail: a one-line question
 * with the project and agent chips above it. Submitting hands the question to
 * the pull request's workspace when one is already open, and otherwise starts
 * a workspace checked out on the pull request with the agent launched on it.
 */
export function PullRequestAskComposer({
	projectId,
	hostId,
	hostUrl,
	data,
	className,
}: PullRequestAskComposerProps) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const [text, setText] = useState("");
	const [chosenAgentId, setChosenAgentId] = useState<string | null>(null);
	const { projects } = useHostProjects();
	const projectName =
		projects.find(
			(project) => project.id === projectId || project.projectKey === projectId,
		)?.name ?? null;
	const { data: agentConfigs = [] } = useV2AgentConfigs(hostUrl);
	const agent =
		agentConfigs.find((config) => config.id === chosenAgentId) ??
		agentConfigs[0] ??
		null;
	const linkedWorkspaceQueryKey = [
		"pullRequests",
		"linkedWorkspace",
		projectId,
		hostUrl,
		data.number,
	];
	const { data: linkedWorkspace } = useQuery({
		queryKey: linkedWorkspaceQueryKey,
		queryFn: () =>
			getHostServiceClientByUrl(hostUrl).pullRequests.getLinkedWorkspace.query({
				projectId,
				prNumber: data.number,
			}),
		staleTime: 30_000,
	});
	const linkedWorkspaceId = linkedWorkspace?.workspaceId ?? null;
	const { submit: submitWorkspaceCreate } = useWorkspaceCreates();

	const ask = useMutation({
		mutationFn: async (question: string) => {
			if (!agent) throw new Error("No agent is configured on this host");
			const prompt = buildPullRequestQuestionPrompt(data, question);
			if (linkedWorkspaceId) {
				await getHostServiceClientByUrl(hostUrl).agents.run.mutate({
					workspaceId: linkedWorkspaceId,
					agent: agent.id,
					prompt,
				});
				return;
			}
			const { completed } = submitWorkspaceCreate({
				hostId,
				snapshot: {
					id: crypto.randomUUID(),
					projectId,
					pr: data.number,
					agents: [{ agent: agent.id, prompt }],
				},
			});
			const outcome = await completed;
			if (!outcome.ok) throw new Error(outcome.error);
		},
		onSuccess: () => {
			setText("");
			void queryClient.invalidateQueries({ queryKey: linkedWorkspaceQueryKey });
			toast.success(
				linkedWorkspaceId
					? t({ message: "Sent to the pull request's workspace" })
					: t({ message: "Starting a workspace on this pull request" }),
			);
		},
		onError: (error) => {
			toast.error(t({ message: "Couldn't ask about this pull request" }), {
				description: errorMessage(error),
			});
		},
	});

	const canSend = text.trim().length > 0 && !ask.isPending && agent !== null;
	const submit = () => {
		if (!canSend) return;
		ask.mutate(text);
	};
	const placeholder = t({ message: "Ask about this pull request" });
	const chipClassName =
		"inline-flex h-6 min-w-0 max-w-48 items-center gap-1.5 rounded-md px-1.5 text-xs text-muted-foreground";

	return (
		<div
			data-pull-request-composer
			className={cn(
				"rounded-2xl border border-border/70 bg-background/95 p-1 shadow-lg backdrop-blur",
				className,
			)}
		>
			<div className="flex flex-col gap-1 px-2 pb-2 pt-2">
				<div className="flex min-w-0 items-center gap-1">
					{projectName ? (
						<span className={chipClassName} title={projectName}>
							<Folder aria-hidden className="size-3.5 shrink-0" />
							<span className="truncate">{projectName}</span>
						</span>
					) : null}
					{agentConfigs.length > 1 && agent ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className={cn(
										chipClassName,
										"hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
									)}
									aria-label={t({ message: `Agent: ${agent.label}` })}
								>
									<Bot aria-hidden className="size-3.5 shrink-0" />
									<span className="truncate">{agent.label}</span>
									<ChevronDown aria-hidden className="size-3 shrink-0" />
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" side="top" className="w-56">
								<DropdownMenuRadioGroup
									value={agent.id}
									onValueChange={setChosenAgentId}
								>
									{agentConfigs.map((config) => (
										<DropdownMenuRadioItem key={config.id} value={config.id}>
											<span className="truncate">{config.label}</span>
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuRadioGroup>
							</DropdownMenuContent>
						</DropdownMenu>
					) : agent ? (
						<span className={chipClassName} title={agent.label}>
							<Bot aria-hidden className="size-3.5 shrink-0" />
							<span className="truncate">{agent.label}</span>
						</span>
					) : null}
				</div>
				<div className="flex items-end gap-1.5">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon-xs"
								className="mb-px shrink-0 text-muted-foreground"
								aria-label={t({
									message: "More ways to use this pull request",
								})}
							>
								<Plus className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" side="top" className="w-56">
							<DropdownMenuItem asChild>
								<a href={data.url} target="_blank" rel="noopener noreferrer">
									<ExternalLink className="size-4" />
									<Trans>Open on GitHub</Trans>
								</a>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<textarea
						rows={1}
						value={text}
						placeholder={placeholder}
						aria-label={placeholder}
						disabled={ask.isPending}
						onChange={(event) => setText(event.target.value)}
						onKeyDown={(event) => {
							if (
								event.key === "Enter" &&
								!event.shiftKey &&
								!event.nativeEvent.isComposing
							) {
								event.preventDefault();
								submit();
							}
						}}
						className="field-sizing-content max-h-40 min-h-8 min-w-0 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground/70"
					/>
					<Button
						size="icon-xs"
						className="mb-0.5 size-7 shrink-0 rounded-full"
						disabled={!canSend}
						aria-label={
							ask.isPending
								? t({ message: "Sending to agent" })
								: t({ message: "Ask the agent" })
						}
						onClick={submit}
					>
						{ask.isPending ? (
							<LoaderCircle className="size-3.5 animate-spin" />
						) : (
							<ArrowUp className="size-4" />
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
