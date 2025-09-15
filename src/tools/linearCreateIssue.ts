import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { linearFetch, GQL, resolveTeamIdFromKey } from "./linear";

export default function register(server: McpServer, env: Env) {
	server.tool(
		"linearCreateIssue",
		"Create a Linear issue. Supports project/labels by name, optional assignee and due date.",
		{
			teamKey: z.string(),
			title: z.string(),
			description: z.string().optional(),
			assigneeEmail: z.string().email().optional(),
			projectId: z.string().optional(),
			projectName: z.string().optional(),
			priority: z.number().int().min(0).max(4).optional(),
			labelIds: z.array(z.string()).optional(),
			labelNames: z.array(z.string()).optional(),
			dueToday: z.boolean().optional(),
			dueDate: z
				.string()
				.regex(/^\d{4}-\d{2}-\d{2}$/)
				.optional(),
		},
		async (input) => {
			const teamId = await resolveTeamIdFromKey(env, input.teamKey);

			let assigneeId: string | undefined;
			if (input.assigneeEmail) {
				const ud = await linearFetch<{
					users: { nodes: Array<{ id: string }> };
				}>(env, GQL.userByEmail, {
					email: input.assigneeEmail,
				});
				assigneeId = ud.users.nodes[0]?.id;
				if (!assigneeId)
					throw new Error(`Usuario no encontrado: ${input.assigneeEmail}`);
			}

			type IssueCreatePayload = {
				teamId: string;
				title: string;
				description?: string;
				assigneeId?: string;
				projectId?: string;
				priority?: number;
				labelIds?: string[];
				dueDate?: string;
			};
			let resolvedProjectId: string | undefined = input.projectId;
			if (!resolvedProjectId && input.projectName) {
				const pd = await linearFetch<{
					projects: { nodes: Array<{ id: string; name: string }> };
				}>(env, GQL.projectsByTeam, { teamId });
				const needle = (input.projectName ?? "").trim().toLowerCase();
				const proj = pd.projects.nodes.find(
					(p) => p.name.trim().toLowerCase() === needle,
				);
				if (!proj)
					throw new Error(
						`Proyecto no encontrado por nombre: ${input.projectName}`,
					);
				resolvedProjectId = proj.id;
			}

			let resolvedLabelIds: string[] | undefined = input.labelIds;
			if (
				(!resolvedLabelIds || resolvedLabelIds.length === 0) &&
				input.labelNames &&
				input.labelNames.length > 0
			) {
				const ld = await linearFetch<{
					issueLabels: { nodes: Array<{ id: string; name: string }> };
				}>(env, GQL.issueLabelsByTeam, { teamId });
				const mapByName = new Map(
					ld.issueLabels.nodes.map(
						(l) => [l.name.trim().toLowerCase(), l.id] as const,
					),
				);
				resolvedLabelIds = input.labelNames.map((n) => {
					const id = mapByName.get(n.trim().toLowerCase());
					if (!id) throw new Error(`Label no encontrado: ${n}`);
					return id;
				});
			}

			const payload: IssueCreatePayload = {
				teamId,
				title: input.title,
				description: input.description,
				assigneeId,
				projectId: resolvedProjectId,
				priority: input.priority,
				labelIds: resolvedLabelIds,
			};

			if (input.dueToday) {
				const now = new Date();
				const yyyy = now.getFullYear();
				const mm = String(now.getMonth() + 1).padStart(2, "0");
				const dd = String(now.getDate()).padStart(2, "0");
				payload.dueDate = `${yyyy}-${mm}-${dd}`;
			} else if (input.dueDate) {
				payload.dueDate = input.dueDate;
			}

			// Optional: allow setting state via name/type alias at creation if 'state' provided
			// Linear's IssueCreateInput supports stateId; resolve if description contains state alias not needed
			const r = await linearFetch<{
				issueCreate: { issue: { identifier: string; title: string } };
			}>(env, GQL.issueCreate, { input: payload });
			const issue = r.issueCreate.issue;
			return {
				content: [
					{ type: "text", text: `Creado ${issue.identifier}: ${issue.title}` },
				],
			};
		},
	);
}


