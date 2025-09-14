import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GQL, linearFetch } from "./linear";

export default function register(server: McpServer, env: Env) {
	server.tool(
		"linearListTeams",
		{},
		async () => {
			const data = await linearFetch<{ teams: { nodes: Array<{ id: string; key: string; name: string }> } }>(
				env,
				GQL.teamsList,
				{},
			);
			const items = (data.teams?.nodes || []).map((t) => `${t.key}\t${t.name}`);
			return { content: [{ type: "text", text: items.join("\n") || "Sin equipos" }] };
		},
	);
}


