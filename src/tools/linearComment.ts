import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { linearFetch, GQL } from "./linear";

export default function register(server: McpServer, env: Env) {
	server.tool(
		"linearComment",
		{
			issueIdOrKey: z.string(),
			body: z.string(),
		},
		async (input) => {
			const r = await linearFetch(env, GQL.commentCreate, {
				input: { issueId: input.issueIdOrKey, body: input.body },
			});
			return { content: [{ type: "text", text: `Comentario ${r.commentCreate?.comment?.id ?? "ok"}` }] };
		},
	);
}


