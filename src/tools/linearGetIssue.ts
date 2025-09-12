import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { linearFetch, GQL } from "./linear";

export default function register(server: McpServer, env: Env) {
	server.tool(
		"linearGetIssue",
		{ idOrKey: z.string() },
		async (input) => {
			const data = await linearFetch(env, GQL.issueByIdentifier, { id: input.idOrKey });
			const i = data.issue;
			if (!i) return { content: [{ type: "text", text: "Issue no encontrado" }] };
			const text = `${i.identifier} ${i.title}\nEstado: ${i.state?.name ?? ""}\nAsignado: ${i.assignee?.name ?? ""}\nEquipo: ${i.team?.key ?? ""}\nActualizado: ${i.updatedAt}`;
			return { content: [{ type: "text", text }] };
		},
	);
}


