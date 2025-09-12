import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { linearFetch, GQL } from "./linear";

export default function register(server: McpServer, env: Env) {
	server.tool(
		"linearDeleteIssue",
		{ idOrKey: z.string() },
		async (input) => {
			await linearFetch(env, GQL.issueDelete, { id: input.idOrKey });
			return { content: [{ type: "text", text: "Eliminado" }] };
		},
	);
}


