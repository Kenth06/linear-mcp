import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GQL, linearFetch, resolveTeamIdFromKey } from "./linear";

export default function register(server: McpServer, env: Env) {
	server.tool(
		"linearListLabels",
		{ teamKey: z.string().optional() },
		async (input) => {
			let teamId: string | undefined;
			if (input.teamKey) teamId = await resolveTeamIdFromKey(env, input.teamKey);
			const data = await linearFetch<{
				issueLabels: { nodes: Array<{ id: string; name: string }> };
			}>(env, GQL.issueLabelsByTeam, { teamId });
			const rows = data.issueLabels?.nodes || [];
			const items = rows.map((l) => `${l.id}\t${l.name}`);
			return { content: [{ type: "text", text: items.join("\n") || "Sin labels" }] };
		},
	);
}


