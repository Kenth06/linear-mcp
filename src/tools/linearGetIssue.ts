import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { linearFetch, GQL, resolveIssueId } from "./linear";

export default function register(server: McpServer, env: Env) {
	server.tool(
		"linearGetIssue",
		{ idOrKey: z.string() },
		async (input) => {
			const id = await resolveIssueId(env, input.idOrKey);
			const data = await linearFetch<{
				issue?: {
					identifier: string;
					title: string;
					state?: { name?: string };
					assignee?: { name?: string };
					team?: { key?: string };
					priority?: number;
					project?: { name?: string };
					labels?: { nodes?: Array<{ id: string; name: string }> };
					updatedAt?: string;
				};
			}>(env, GQL.issueByIdentifier, { id });
			const i = data.issue;
			if (!i) return { content: [{ type: "text", text: "Issue no encontrado" }] };
			const labels = (i.labels?.nodes || []).map((l) => l.name).join(", ");
			const text = `${i.identifier} ${i.title}\nEstado: ${i.state?.name ?? ""}\nAsignado: ${i.assignee?.name ?? ""}\nEquipo: ${i.team?.key ?? ""}\nPrioridad: ${i.priority ?? ""}\nProyecto: ${i.project?.name ?? ""}\nLabels: ${labels}\nActualizado: ${i.updatedAt}`;
			return { content: [{ type: "text", text }] };
		},
	);
}


