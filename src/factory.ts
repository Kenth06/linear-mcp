import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import registerCreate from "./tools/linearCreateIssue";
import registerUpdate from "./tools/linearUpdateIssue";
import registerComment from "./tools/linearComment";
import registerDelete from "./tools/linearDeleteIssue";
import registerWebhooks from "./tools/linearWebhooks";
import registerListIssues from "./tools/linearListIssues";
import registerGetIssue from "./tools/linearGetIssue";
import registerListTeams from "./tools/linearListTeams";
import registerListStates from "./tools/linearListStates";

export function registerTools(server: McpServer, env: Env): void {
	registerCreate(server, env);
	registerUpdate(server, env);
	registerComment(server, env);
	registerDelete(server, env);
	registerWebhooks(server, env);
	registerListIssues(server, env);
	registerGetIssue(server, env);
	registerListTeams(server, env);
	registerListStates(server, env);
}


