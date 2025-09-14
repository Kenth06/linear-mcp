import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GQL, linearFetch } from "./linear";

export default function register(server: McpServer, env: Env) {
	server.tool(
		"linearListUsers",
		{},
		async () => {
			const data = await linearFetch<{ users: { nodes: Array<{ id: string; name: string; email: string }> } }>(
				env,
				GQL.usersList,
				{},
			);
			const items = (data.users?.nodes || []).map((u) => `${u.id}\t${u.name}\t${u.email}`);
			return { content: [{ type: "text", text: items.join("\n") || "Sin usuarios" }] };
		},
	);
}


