import type { ConnectionSecrets } from "../../../../lib/connectors/upsert";
import { callTool, getTools } from "./tools";

export const slackServer = {
	getTools,
	callTool,
	// `accessToken` is the person's own token; `config.bot_token` is the workspace bot's.
	credential: (secrets: ConnectionSecrets) =>
		secrets.accessToken || secrets.config.bot_token,
};
