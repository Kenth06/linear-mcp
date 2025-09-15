import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { linearFetch, GQL, resolveIssueId } from "./linear";

function isUuidLike(value: string): boolean {
	// Loose check for UUID v4-like strings
	return /^[0-9a-fA-F-]{36}$/.test(value);
}

const updateIssueArgsSchema = {
	idOrKey: z.string(),
	title: z.string().optional(),
	description: z.string().optional(),
	stateId: z.string().optional(),
	state: z.string().optional().describe("Human-friendly status name or type"),
	assigneeEmail: z.string().email().optional(),
	dueDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional(),
	projectId: z.string().optional(),
	projectName: z.string().optional(),
	labelIds: z.array(z.string()).optional(),
	labelNames: z.array(z.string()).optional(),
} satisfies z.ZodRawShape;

export default function register(server: McpServer, env: Env) {
	server.tool(
		"linearUpdateIssue",
		"Update a Linear issue: title, description, state (alias), assignee, due date, project and labels by name or ID.",
		updateIssueArgsSchema,
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

			// We may need the issue's team for resolving aliases/names
			let teamId: string | undefined;

			// Resolve state: prefer explicit stateId if it is a UUID; otherwise map via name/type
			let desiredAlias: string | undefined = input.state;
			if (input.stateId && !isUuidLike(input.stateId))
				desiredAlias = input.stateId;
			if (input.stateId && isUuidLike(input.stateId))
				update.stateId = input.stateId;

			if (!update.stateId && desiredAlias) {
				const issueData = await linearFetch<{
					issue?: { team?: { id: string } };
				}>(env, GQL.issueById, {
					id: issueId,
				});
				teamId = issueData.issue?.team?.id;
				if (!teamId) throw new Error("No se pudo determinar el team del issue");
				const statesData = await linearFetch<{
					workflowStates: {
						nodes: Array<{ id: string; name: string; type?: string }>;
					};
				}>(env, GQL.teamWorkflowStates, {
					teamId,
				});
				const nodes: Array<{ id: string; name: string; type?: string }> =
					statesData.workflowStates.nodes;
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

			if (input.projectId) {
				// Project resolution: projectId direct or projectName via team
				update.projectId = input.projectId;
			} else if (input.projectName) {
				if (!teamId) {
					const issueData = await linearFetch<{
						issue?: { team?: { id: string } };
					}>(env, GQL.issueById, { id: issueId });
					teamId = issueData.issue?.team?.id;
					if (!teamId)
						throw new Error("No se pudo determinar el team del issue");
				}
				const pd = await linearFetch<{
					projects: { nodes: Array<{ id: string; name: string }> };
				}>(env, GQL.projectsByTeam, { teamId });
				const needle = input.projectName.trim().toLowerCase();
				const proj = pd.projects.nodes.find(
					(p) => p.name.trim().toLowerCase() === needle,
				);
				if (!proj)
					throw new Error(`Proyecto no encontrado por nombre: ${input.projectName}`);
				update.projectId = proj.id;
			}

			if (input.labelIds !== undefined) {
				// Labels resolution: labelIds direct or labelNames via team
				update.labelIds = input.labelIds;
			} else if (input.labelNames !== undefined) {
				if (input.labelNames.length === 0) {
					update.labelIds = [];
				} else {
					if (!teamId) {
						const issueData = await linearFetch<{
							issue?: { team?: { id: string } };
						}>(env, GQL.issueById, { id: issueId });
						teamId = issueData.issue?.team?.id;
						if (!teamId)
							throw new Error("No se pudo determinar el team del issue");
					}
					const ld = await linearFetch<{
						issueLabels: { nodes: Array<{ id: string; name: string }> };
					}>(env, GQL.issueLabelsByTeam, { teamId });
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