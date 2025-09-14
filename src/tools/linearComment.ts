import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { linearFetch, GQL, resolveIssueId } from "./linear";

export default function register(server: McpServer, env: Env) {
	server.tool(
		"linearComment",
		{
			issueIdOrKey: z.string(),
			body: z.string(),
		},
		async (input) => {
			const issueId = await resolveIssueId(env, input.issueIdOrKey);
			const r = await linearFetch(env, GQL.commentCreate, {
				input: { issueId, body: input.body },
			});
			return { content: [{ type: "text", text: `Comentario ${r.commentCreate?.comment?.id ?? "ok"}` }] };
		},
	);
}


