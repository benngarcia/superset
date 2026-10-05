# Tasks

Types:

- <code><a href="./src/resources/tasks.ts">Task</a></code>
- <code><a href="./src/resources/tasks.ts">TaskListItem</a></code>
- <code><a href="./src/resources/tasks.ts">TaskListParams</a></code>
- <code><a href="./src/resources/tasks.ts">TaskListResponse</a></code>
- <code><a href="./src/resources/tasks.ts">TaskCreateParams</a></code>
- <code><a href="./src/resources/tasks.ts">TaskUpdateParams</a></code>

Methods:

- <code title="post /api/trpc/task.create">client.tasks.<a href="./src/resources/tasks.ts">create</a>({ ...params }) -> Task</code>
- <code title="get /api/trpc/task.byIdOrSlug">client.tasks.<a href="./src/resources/tasks.ts">retrieve</a>(idOrSlug) -> Task</code>
- <code title="get /api/trpc/task.list">client.tasks.<a href="./src/resources/tasks.ts">list</a>({ ...params }) -> TaskListResponse</code>
- <code title="post /api/trpc/task.update">client.tasks.<a href="./src/resources/tasks.ts">update</a>({ ...params }) -> Task</code>
- <code title="post /api/trpc/task.delete">client.tasks.<a href="./src/resources/tasks.ts">delete</a>(id) -> void</code>

## Statuses

Types:

- <code><a href="./src/resources/tasks.ts">TaskStatus</a></code>
- <code><a href="./src/resources/tasks.ts">TaskStatusListResponse</a></code>

Methods:

- <code title="get /api/trpc/task.statuses.list">client.tasks.statuses.<a href="./src/resources/tasks.ts">list</a>() -> TaskStatusListResponse</code>

# Workspaces

Types:

- <code><a href="./src/resources/workspaces.ts">CloudWorkspace</a></code>
- <code><a href="./src/resources/workspaces.ts">CloudWorkspaceStatus</a></code>
- <code><a href="./src/resources/workspaces.ts">WorkspaceListParams</a></code>
- <code><a href="./src/resources/workspaces.ts">WorkspaceListResponse</a></code>
- <code><a href="./src/resources/workspaces.ts">WorkspaceCreateParams</a></code>
- <code><a href="./src/resources/workspaces.ts">WorkspaceUpdateParams</a></code>
- <code><a href="./src/resources/workspaces.ts">WorkspaceDeleteResult</a></code>

Methods:

- <code title="get /api/trpc/cloudWorkspace.list">client.workspaces.<a href="./src/resources/workspaces.ts">list</a>({ search? }) -> WorkspaceListResponse</code>
- <code title="get /api/trpc/cloudWorkspace.list">client.workspaces.<a href="./src/resources/workspaces.ts">retrieve</a>(id) -> CloudWorkspace | null</code>
- <code title="post /api/trpc/cloudWorkspace.create">client.workspaces.<a href="./src/resources/workspaces.ts">create</a>({ environment?, name?, branch?, agent?, prompt?, model?, effort? }) -> CloudWorkspace</code>
- <code title="post /api/trpc/cloudWorkspace.rename">client.workspaces.<a href="./src/resources/workspaces.ts">update</a>(id, { name }) -> CloudWorkspace</code>
- <code title="post /api/trpc/cloudWorkspace.delete">client.workspaces.<a href="./src/resources/workspaces.ts">delete</a>(id) -> WorkspaceDeleteResult</code>

# Agents

Types:

- <code><a href="./src/resources/agents.ts">AgentCreateParams</a></code>
- <code><a href="./src/resources/agents.ts">AgentCreateResult</a></code>

Methods:

- <code title="workspace post /trpc/agents.run">client.agents.<a href="./src/resources/agents.ts">create</a>({ workspaceId, agent, prompt?, resumeSessionId?, model?, effort? }) -> AgentCreateResult</code>

# Terminals

Types:

- <code><a href="./src/resources/terminals.ts">TerminalCreateParams</a></code>
- <code><a href="./src/resources/terminals.ts">TerminalCreateResult</a></code>
- <code><a href="./src/resources/terminals.ts">TerminalListParams</a></code>
- <code><a href="./src/resources/terminals.ts">TerminalListResult</a></code>
- <code><a href="./src/resources/terminals.ts">TerminalSummary</a></code>
- <code><a href="./src/resources/terminals.ts">TerminalSendParams</a></code>
- <code><a href="./src/resources/terminals.ts">TerminalSendResult</a></code>
- <code><a href="./src/resources/terminals.ts">TerminalReadParams</a></code>
- <code><a href="./src/resources/terminals.ts">TerminalReadResult</a></code>
- <code><a href="./src/resources/terminals.ts">TerminalCloseParams</a></code>
- <code><a href="./src/resources/terminals.ts">TerminalCloseResult</a></code>

Methods:

- <code title="workspace post /trpc/terminal.createSession">client.terminals.<a href="./src/resources/terminals.ts">create</a>({ workspaceId, command?, cwd? }) -> TerminalCreateResult</code>
- <code title="workspace get /trpc/terminal.list">client.terminals.<a href="./src/resources/terminals.ts">list</a>({ workspaceId }) -> TerminalListResult</code>
- <code title="workspace post /trpc/terminal.send">client.terminals.<a href="./src/resources/terminals.ts">send</a>({ workspaceId, terminalId, text, submit? }) -> TerminalSendResult</code>
- <code title="workspace get /trpc/terminal.snapshot">client.terminals.<a href="./src/resources/terminals.ts">read</a>({ workspaceId, terminalId, maxLines? }) -> TerminalReadResult</code>
- <code title="workspace post /trpc/terminal.killSession">client.terminals.<a href="./src/resources/terminals.ts">close</a>({ workspaceId, terminalId }) -> TerminalCloseResult</code>

# Chat

Every method also takes `hostId` and `workspaceId`. A call goes to a host through the relay when it names a `hostId` or the client has one; otherwise it goes to the sandbox of the cloud workspace named by `workspaceId`. With an API key, the SDK trades the key for a short-lived user JWT at `/api/auth/token` for relay calls.

Types:

- <code><a href="./src/resources/chat.ts">ChatSession</a></code>
- <code><a href="./src/resources/chat.ts">ChatSessionStatus</a></code>
- <code><a href="./src/resources/chat.ts">ChatCursor</a></code>
- <code><a href="./src/resources/chat.ts">ChatUserContent</a></code>
- <code><a href="./src/resources/chat.ts">ChatDecision</a></code>
- <code><a href="./src/resources/chat.ts">ChatDeltaChannel</a></code>
- <code><a href="./src/resources/chat.ts">ChatEnvelope</a></code>
- <code><a href="./src/resources/chat.ts">ChatCreateSessionParams</a></code>
- <code><a href="./src/resources/chat.ts">ChatCreateSessionResult</a></code>
- <code><a href="./src/resources/chat.ts">ChatListSessionsParams</a></code>
- <code><a href="./src/resources/chat.ts">ChatSessionParams</a></code>
- <code><a href="./src/resources/chat.ts">ChatRetrieveSessionResult</a></code>
- <code><a href="./src/resources/chat.ts">ChatListItemsParams</a></code>
- <code><a href="./src/resources/chat.ts">ChatItemsPage</a></code>
- <code><a href="./src/resources/chat.ts">ChatPromptParams</a></code>
- <code><a href="./src/resources/chat.ts">ChatPromptResult</a></code>
- <code><a href="./src/resources/chat.ts">ChatCancelTurnParams</a></code>
- <code><a href="./src/resources/chat.ts">ChatRespondToApprovalParams</a></code>
- <code><a href="./src/resources/chat.ts">ChatSetModeParams</a></code>
- <code><a href="./src/resources/chat.ts">ChatSetConfigOptionParams</a></code>
- <code><a href="./src/resources/chat.ts">ChatSubscribeParams</a></code>

Methods:

- <code title="host post /chat-v3/trpc/createSession">client.chat.<a href="./src/resources/chat.ts">createSession</a>({ workspaceId, harness, modeId?, modelId?, resumeHarnessSessionId? }) -> ChatCreateSessionResult</code>
- <code title="host get /chat-v3/trpc/listSessions">client.chat.<a href="./src/resources/chat.ts">listSessions</a>({ workspaceId?, limit? }) -> ChatSession[]</code>
- <code title="host get /chat-v3/trpc/getSession">client.chat.<a href="./src/resources/chat.ts">retrieveSession</a>({ sessionId }) -> ChatRetrieveSessionResult</code>
- <code title="host get /chat-v3/trpc/getItems">client.chat.<a href="./src/resources/chat.ts">listItems</a>({ sessionId, before?, limit? }) -> ChatItemsPage</code>
- <code title="host post /chat-v3/trpc/prompt">client.chat.<a href="./src/resources/chat.ts">prompt</a>({ sessionId, content, clientId? }) -> ChatPromptResult</code>
- <code title="host post /chat-v3/trpc/cancelTurn">client.chat.<a href="./src/resources/chat.ts">cancelTurn</a>({ sessionId, turnId, pauseQueue? }) -> void</code>
- <code title="host post /chat-v3/trpc/respondToApproval">client.chat.<a href="./src/resources/chat.ts">respondToApproval</a>({ sessionId, approvalId, decision }) -> void</code>
- <code title="host post /chat-v3/trpc/setMode">client.chat.<a href="./src/resources/chat.ts">setMode</a>({ sessionId, modeId }) -> void</code>
- <code title="host post /chat-v3/trpc/setConfigOption">client.chat.<a href="./src/resources/chat.ts">setConfigOption</a>({ sessionId, configId, value }) -> void</code>
- <code title="host post /chat-v3/trpc/closeSession">client.chat.<a href="./src/resources/chat.ts">closeSession</a>({ sessionId }) -> void</code>
- <code title="host ws /chat-v3/sessions/:sessionId/stream">client.chat.<a href="./src/resources/chat.ts">subscribe</a>({ sessionId, since?, deltas?, onEnvelope, onError?, onClose? }) -> Subscription</code>

# Events

Types:

- <code><a href="./src/resources/events.ts">HostEvent</a></code>
- <code><a href="./src/resources/events.ts">ChatSessionChangedEvent</a></code>
- <code><a href="./src/resources/events.ts">EventsSubscribeParams</a></code>

Methods:

- <code title="host ws /events">client.events.<a href="./src/resources/events.ts">subscribe</a>({ hostId?, workspaceId?, onChatSessionChanged?, onEvent?, onError?, onClose? }) -> Subscription</code>

# Organization

Types:

- <code><a href="./src/resources/organization.ts">OrganizationRole</a></code>
- <code><a href="./src/resources/organization.ts">Member</a></code>
- <code><a href="./src/resources/organization.ts">MemberListParams</a></code>
- <code><a href="./src/resources/organization.ts">MemberListResponse</a></code>

## Members

Methods:

- <code title="get /api/trpc/organization.members.list">client.organization.members.<a href="./src/resources/organization.ts">list</a>({ search?, limit? }) -> MemberListResponse</code>

# Telemetry

Every resource method reports one `sdk_method_called` event (method name, SDK version, runtime, success, duration) to `analytics.captureEvent` after the call settles. It is best-effort and never affects the call itself. Set `SUPERSET_TELEMETRY=0` to opt out.
