import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { linearFetch, GQL, resolveIssueId } from "./linear";

export default function register(server: McpServer, env: Env) {
	server.tool(
		"linearDeleteIssue",
		{ idOrKey: z.string() },
		async (input) => {
			const id = await resolveIssueId(env, input.idOrKey);
			await linearFetch(env, GQL.issueDelete, { id });
			return { content: [{ type: "text", text: "Eliminado" }] };
		},
	);
}


