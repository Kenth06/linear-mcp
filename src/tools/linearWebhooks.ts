import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GQL, linearFetch } from "./linear";

export default function register(server: McpServer, env: Env) {
	server.tool(
		"linearWebhookCreate",
		{
			url: z.string().url().describe("Ej: https://<tu-worker>/webhooks/linear"),
			teamKey: z.string().optional(),
			allPublicTeams: z.boolean().optional().default(false),
			resourceTypes: z.array(z.string()).default(["Issue", "Comment", "Project"]),
			enabled: z.boolean().optional().default(true),
		},
		async (input) => {
			let teamId: string | undefined;
			if (input.teamKey && !input.allPublicTeams) {
				const td = await linearFetch(env, GQL.teamIdByKey, { key: input.teamKey });
				teamId = td.teams.nodes[0]?.id;
				if (!teamId) throw new Error(`Team no encontrado: ${input.teamKey}`);
			}
			const r = await linearFetch(env, GQL.webhookCreate, {
				input: {
					url: input.url,
					enabled: input.enabled,
					resourceTypes: input.resourceTypes,
					allPublicTeams: teamId ? undefined : !!input.allPublicTeams,
					teamId,
				},
			});
			const w = r.webhookCreate.webhook;
			return { content: [{ type: "text", text: `Webhook id=${w.id} enabled=${w.enabled}` }] };
		},
	);

	server.tool(
		"linearWebhookDelete",
		{ id: z.string() },
		async (input) => {
			await linearFetch(env, GQL.webhookDelete, { id: input.id });
			return { content: [{ type: "text", text: "Webhook eliminado" }] };
		},
	);
}


