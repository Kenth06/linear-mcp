import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { linearFetch, GQL, resolveIssueId } from "./linear";

function isUuidLike(value: string): boolean {
	// Loose check for UUID v4-like strings
	return /^[0-9a-fA-F-]{36}$/.test(value);
}

export default function register(server: McpServer, env: Env) {
	server.tool(
		"linearUpdateIssue",
		{
			idOrKey: z.string(),
			title: z.string().optional(),
			description: z.string().optional(),
			stateId: z.string().optional(),
			state: z
				.string()
				.optional()
				.describe("Human-friendly status name or type"),
			assigneeEmail: z.string().email().optional(),
			dueDate: z
				.string()
				.regex(/^\d{4}-\d{2}-\d{2}$/)
				.optional(),
			projectId: z.string().optional(),
			projectName: z.string().optional(),
			priority: z.number().int().min(0).max(4).optional(),
			labelIds: z.array(z.string()).optional(),
			labelNames: z.array(z.string()).optional(),
		},
		async (input) => {
			const issueId = await resolveIssueId(env, input.idOrKey);
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

			const update: Record<string, unknown> = {};
			if (input.title) update.title = input.title;
			if (input.description) update.description = input.description;
			if (assigneeId) update.assigneeId = assigneeId;
			if (input.dueDate) update.dueDate = input.dueDate;
			if (input.projectId) update.projectId = input.projectId;
			if (typeof input.priority === "number") update.priority = input.priority;
			if (input.labelIds) update.labelIds = input.labelIds;

			// Resolve state: prefer explicit stateId if it is a UUID; otherwise map via name/type
			let desiredAlias: string | undefined = input.state;
			if (input.stateId && !isUuidLike(input.stateId))
				desiredAlias = input.stateId;
			if (input.stateId && isUuidLike(input.stateId))
				update.stateId = input.stateId;

			let teamIdForResolution: string | undefined;
			const needTeamForState = !update.stateId && !!desiredAlias;
			const needTeamForProject = !!input.projectName && !input.projectId;
			const needTeamForLabels = !!(
				input.labelNames &&
				(!input.labelIds || input.labelIds.length === 0)
			);
			if (needTeamForState || needTeamForProject || needTeamForLabels) {
				const issueData = await linearFetch<{
					issue?: { team?: { id?: string } };
				}>(env, GQL.issueById, { id: issueId });
				teamIdForResolution = issueData.issue?.team?.id;
				if (!teamIdForResolution)
					throw new Error("No se pudo determinar el team del issue");
			}

			if (!update.stateId && desiredAlias) {
				const issueData = await linearFetch<{
					issue?: { team?: { id?: string } };
				}>(env, GQL.issueById, {
					id: issueId,
				});
				const teamId: string | undefined = issueData.issue?.team?.id;
				if (!teamId) throw new Error("No se pudo determinar el team del issue");
				const statesData = await linearFetch<{
					workflowStates: {
						nodes: Array<{ id: string; name: string; type?: string }>;
					};
				}>(env, GQL.teamWorkflowStates, {
					teamId,
				});
				const nodes = statesData.workflowStates.nodes;
				const wanted = desiredAlias.trim().toLowerCase();
				const byName = nodes.find(
					(s) => s.name.trim().toLowerCase() === wanted,
				);
				const byType = nodes.find(
					(s) => (s.type || "").trim().toLowerCase() === wanted,
				);
				const stateId = (byName || byType)?.id;
				if (!stateId) throw new Error(`Estado no encontrado: ${desiredAlias}`);
				update.stateId = stateId;
			}

			// Resolve projectName -> projectId
				const pd = await linearFetch<{
					projects: { nodes: Array<{ id: string; name: string }> };
				}>(env, GQL.projectsByTeam, { teamId: teamIdForResolution! });
				const proj = pd.projects.nodes.find(
					(p) =>
						p.name.trim().toLowerCase() ===
						input.projectName!.trim().toLowerCase(),
				);
				if (!proj)
					throw new Error(`Proyecto no encontrado: ${input.projectName}`);
				update.projectId = proj.id;
			}

			if (!input.labelIds && input.labelNames && input.labelNames.length > 0) {
				// Resolve labelNames -> labelIds
				const ld = await linearFetch<{
					issueLabels: { nodes: Array<{ id: string; name: string }> };
				}>(env, GQL.issueLabelsByTeam, { teamId: teamIdForResolution! });
				const mapByName = new Map(
					ld.issueLabels.nodes.map(
						(l) => [l.name.trim().toLowerCase(), l.id] as const,
					),
				);
				update.labelIds = input.labelNames.map((n) => {
					const id = mapByName.get(n.trim().toLowerCase());
					if (!id) throw new Error(`Label no encontrado: ${n}`);
					return id;
				});
			}

			const r = await linearFetch<{
				issueUpdate: { issue: { identifier: string; title: string } };
			}>(env, GQL.issueUpdate, {
				id: issueId,
				input: update,
			});
			const issue = r.issueUpdate.issue;
			return {
				content: [
					{
						type: "text",
						text: `Actualizado ${issue.identifier}: ${issue.title}`,
					},
				],
			};
		},
	);
}


