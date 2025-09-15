import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GQL, linearFetch, resolveTeamIdFromKey } from "./linear";

export default function register(server: McpServer, env: Env) {
	server.tool(
		"linearListStates",
		"List workflow states for a given team.",
		{ teamKey: z.string() },
		async (input) => {
			const teamId = await resolveTeamIdFromKey(env, input.teamKey);
			const data = await linearFetch<{
				workflowStates: {
					nodes: Array<{ id: string; name: string; type?: string }>;
				};
			}>(env, GQL.teamWorkflowStates, { teamId });
			const items = (data.workflowStates?.nodes || []).map(
				(s) => `${s.id}\t${s.name}\t${s.type ?? ""}`,
			);
			return {
				content: [{ type: "text", text: items.join("\n") || "Sin estados" }],
			};
		},
	);
}


