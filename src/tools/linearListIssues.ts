import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { linearFetch, GQL } from "./linear";

function isoDate(d: Date): string {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

export default function register(server: McpServer, env: Env) {
	server.tool(
		"linearListIssues",
		{
			teamKey: z.string().optional(),
			assigneeEmail: z.string().email().optional(),
			createdOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
			updatedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
			createdAfter: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
			createdBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
			updatedAfter: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
			updatedBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
		},
		async (input) => {
			let teamId: string | undefined;
			if (input.teamKey) {
				const td = await linearFetch<{ teams: { nodes: Array<{ id: string }> } }>(
					env,
					GQL.teamByKey,
					{ key: input.teamKey },
				);
				teamId = td.teams.nodes[0]?.id;
				if (!teamId) throw new Error(`Team no encontrado: ${input.teamKey}`);
			}

			let assigneeId: string | undefined;
			if (input.assigneeEmail) {
				const ud = await linearFetch<{ users: { nodes: Array<{ id: string }> } }>(
					env,
					GQL.userByEmail,
					{ email: input.assigneeEmail },
				);
				assigneeId = ud.users.nodes[0]?.id;
				if (!assigneeId) throw new Error(`Usuario no encontrado: ${input.assigneeEmail}`);
			}

			let createdAfter = input.createdAfter;
			let createdBefore = input.createdBefore;
			let updatedAfter = input.updatedAfter;
			let updatedBefore = input.updatedBefore;

			// Convenience: createdOn / updatedOn (set both bounds to whole day)
			if (input.createdOn) {
				createdAfter = input.createdOn;
				createdBefore = input.createdOn;
			}
			if (input.updatedOn) {
				updatedAfter = input.updatedOn;
				updatedBefore = input.updatedOn;
			}

			const toDateTime = (s?: string) => (s ? `${s}T00:00:00.000Z` : undefined);
			const toDateTimeEnd = (s?: string) => (s ? `${s}T23:59:59.999Z` : undefined);

			const data = await linearFetch<{
				issues: {
					nodes: Array<{
						identifier: string;
						title: string;
						state?: { name?: string };
					}>;
				};
			}>(env, GQL.issuesByFilter, {
				teamId,
				assigneeId,
				createdAfter: toDateTime(createdAfter),
				createdBefore: toDateTimeEnd(createdBefore),
				updatedAfter: toDateTime(updatedAfter),
				updatedBefore: toDateTimeEnd(updatedBefore),
			});

			const items = (data.issues?.nodes || []).map(
				(n: {
					identifier: string;
					title: string;
					state?: { name?: string };
					priority?: number;
					project?: { name?: string };
					labels?: { nodes?: Array<{ id: string; name: string }> };
				}) => {
					const labels = (n.labels?.nodes || []).map((l) => l.name).join(", ");
					return `${n.identifier} ${n.title} [${n.state?.name ?? ""}] P:${n.priority ?? ""} Proy:${n.project?.name ?? ""} Labels:${labels}`;
				},
			);
			return { content: [{ type: "text", text: items.join("\n") || "Sin resultados" }] };
		},
	);

	server.tool(
		"linearListIssuesToday",
		{
			teamKey: z.string().optional(),
			assigneeEmail: z.string().email().optional(),
		},
		async (input) => {
			let teamId: string | undefined;
			if (input.teamKey) {
				const td = await linearFetch<{ teams: { nodes: Array<{ id: string }> } }>(
					env,
					GQL.teamByKey,
					{ key: input.teamKey },
				);
				teamId = td.teams.nodes[0]?.id;
				if (!teamId) throw new Error(`Team no encontrado: ${input.teamKey}`);
			}

			let assigneeId: string | undefined;
			if (input.assigneeEmail) {
				const ud = await linearFetch<{ users: { nodes: Array<{ id: string }> } }>(
					env,
					GQL.userByEmail,
					{ email: input.assigneeEmail },
				);
				assigneeId = ud.users.nodes[0]?.id;
				if (!assigneeId) throw new Error(`Usuario no encontrado: ${input.assigneeEmail}`);
			}

			const today = isoDate(new Date());
			const toDateTime = (s: string) => `${s}T00:00:00.000Z`;
			const toDateTimeEnd = (s: string) => `${s}T23:59:59.999Z`;
			const data = await linearFetch<{
				issues: {
					nodes: Array<{
						identifier: string;
						title: string;
						state?: { name?: string };
					}>;
				};
			}>(env, GQL.issuesByFilter, {
				teamId,
				assigneeId,
				updatedAfter: toDateTime(today),
				updatedBefore: toDateTimeEnd(today),
			});
			const items = (data.issues?.nodes || []).map(
				(n: {
					identifier: string;
					title: string;
					state?: { name?: string };
					priority?: number;
					project?: { name?: string };
					labels?: { nodes?: Array<{ id: string; name: string }> };
				}) => {
					const labels = (n.labels?.nodes || []).map((l) => l.name).join(", ");
					return `${n.identifier} ${n.title} [${n.state?.name ?? ""}] P:${n.priority ?? ""} Proy:${n.project?.name ?? ""} Labels:${labels}`;
				},
			);
			return { content: [{ type: "text", text: items.join("\n") || "Sin resultados" }] };
		},
	);
}


