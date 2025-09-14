import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { linearFetch, GQL, resolveTeamIdFromKey } from "./linear";

export default function register(server: McpServer, env: Env) {
	server.tool(
		"linearCreateIssue",
		{
			teamKey: z.string(),
			title: z.string(),
			description: z.string().optional(),
			assigneeEmail: z.string().email().optional(),
			projectId: z.string().optional(),
			dueToday: z.boolean().optional(),
			dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
		},
		async (input) => {
			const teamId = await resolveTeamIdFromKey(env, input.teamKey);

			let assigneeId: string | undefined;
			if (input.assigneeEmail) {
				const ud = await linearFetch(env, GQL.userByEmail, { email: input.assigneeEmail });
				assigneeId = ud.users.nodes[0]?.id;
				if (!assigneeId) throw new Error(`Usuario no encontrado: ${input.assigneeEmail}`);
			}

			const payload: Record<string, unknown> = {
				teamId,
				title: input.title,
				description: input.description,
				assigneeId,
				projectId: input.projectId,
			};

			if (input.dueToday) {
				const now = new Date();
				const yyyy = now.getFullYear();
				const mm = String(now.getMonth() + 1).padStart(2, "0");
				const dd = String(now.getDate()).padStart(2, "0");
				(payload as any).dueDate = `${yyyy}-${mm}-${dd}`;
			} else if (input.dueDate) {
				(payload as any).dueDate = input.dueDate;
			}

			// Optional: allow setting state via name/type alias at creation if 'state' provided
			// Linear's IssueCreateInput supports stateId; resolve if description contains state alias not needed
			const r = await linearFetch(env, GQL.issueCreate, { input: payload });
			const issue = r.issueCreate.issue;
			return { content: [{ type: "text", text: `Creado ${issue.identifier}: ${issue.title}` }] };
		},
	);
}


