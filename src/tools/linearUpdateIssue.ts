import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { linearFetch, GQL } from "./linear";

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
			state: z.string().optional().describe("Human-friendly status name or type"),
			assigneeEmail: z.string().email().optional(),
			dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
		},
		async (input) => {
			let assigneeId: string | undefined;
			if (input.assigneeEmail) {
				const ud = await linearFetch(env, GQL.userByEmail, { email: input.assigneeEmail });
				assigneeId = ud.users.nodes[0]?.id;
				if (!assigneeId) throw new Error(`Usuario no encontrado: ${input.assigneeEmail}`);
			}

			const update: Record<string, unknown> = {};
			if (input.title) update.title = input.title;
			if (input.description) update.description = input.description;
			if (assigneeId) update.assigneeId = assigneeId;
			if (input.dueDate) update.dueDate = input.dueDate;

			// Resolve state: prefer explicit stateId if it is a UUID; otherwise map via name/type
			let desiredAlias: string | undefined = input.state;
			if (input.stateId && !isUuidLike(input.stateId)) desiredAlias = input.stateId;
			if (input.stateId && isUuidLike(input.stateId)) update.stateId = input.stateId;

			if (!update.stateId && desiredAlias) {
				const issueData = await linearFetch(env, GQL.issueByIdOrKey, { id: input.idOrKey });
				const teamId: string | undefined = issueData.issue?.team?.id;
				if (!teamId) throw new Error("No se pudo determinar el team del issue");
				const statesData = await linearFetch(env, GQL.teamWorkflowStates, { teamId });
				const nodes: Array<{ id: string; name: string; type?: string }> = statesData.workflowStates.nodes;
				const wanted = desiredAlias.trim().toLowerCase();
				const byName = nodes.find((s) => s.name.trim().toLowerCase() === wanted);
				const byType = nodes.find((s) => (s.type || "").trim().toLowerCase() === wanted);
				const stateId = (byName || byType)?.id;
				if (!stateId) throw new Error(`Estado no encontrado: ${desiredAlias}`);
				update.stateId = stateId;
			}

			const r = await linearFetch(env, GQL.issueUpdate, { id: input.idOrKey, input: update });
			const issue = r.issueUpdate.issue;
			return { content: [{ type: "text", text: `Actualizado ${issue.identifier}: ${issue.title}` }] };
		},
	);
}


