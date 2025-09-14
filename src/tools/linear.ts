export async function linearFetch<T = unknown>(
	env: Env,
	query: string,
	variables?: Record<string, unknown>,
): Promise<T> {
	const res = await fetch(env.LINEAR_GRAPHQL_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: env.LINEAR_API_KEY,
		},
		body: JSON.stringify({ query, variables }),
	});
	const json = (await res.json()) as { data: T; errors?: unknown };
	if (!res.ok || json.errors) {
		throw new Error(
			`Linear ${res.status}: ${JSON.stringify(json.errors || json)}`,
		);
	}
	return json.data;
}

export const GQL = {
	teamByKey: `
		query ($key: String!) { teams(filter: { key: { eq: $key } }) { nodes { id key name } } }`,
	userByEmail: `
		query ($email: String!) { users(filter: { email: { eq: $email } }) { nodes { id name email } } }`,
	issueById: `
		query ($id: String!) { issue(id: $id) { id team { id } } }`,
	issueIdByTeamAndNumber: `
		query ($teamId: ID!, $number: Float!) {
			issues(
				filter: { team: { id: { eq: $teamId } }, number: { eq: $number } }
			) { nodes { id } }
		}`,
	teamWorkflowStates: `
		query ($teamId: ID!) { workflowStates(filter: { team: { id: { eq: $teamId } } }) { nodes { id name type } } }`,
	issuesByFilter: `
		query (
			$teamId: ID, $assigneeId: ID,
			$updatedAfter: DateTimeOrDuration, $updatedBefore: DateTimeOrDuration,
			$createdAfter: DateTimeOrDuration, $createdBefore: DateTimeOrDuration
		) {
			issues(
				filter: {
					team: { id: { eq: $teamId } }
					assignee: { id: { eq: $assigneeId } }
					updatedAt: { gte: $updatedAfter, lte: $updatedBefore }
					createdAt: { gte: $createdAfter, lte: $createdBefore }
				}
			) { nodes { id identifier title state { id name } assignee { id name } createdAt updatedAt } }
		}`,
	issueByIdentifier: `
		query ($id: String!) { issue(id: $id) { id identifier title description state { id name } assignee { id name email } team { id key name } createdAt updatedAt } }`,
	issueCreate: `
		mutation ($input: IssueCreateInput!) {
			issueCreate(input: $input) { success issue { id identifier title } }
		}`,
	issueUpdate: `
		mutation ($id: String!, $input: IssueUpdateInput!) {
			issueUpdate(id: $id, input: $input) { success issue { id identifier title } }
		}`,
	issueDelete: `mutation ($id: String!) { issueDelete(id: $id) { success } }`,
	commentCreate: `
		mutation ($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { id } } }`,
	webhookCreate: `
		mutation ($input: WebhookCreateInput!) {
			webhookCreate(input: $input) { success webhook { id enabled url } }
		}`,
	webhookDelete: `mutation ($id: String!) { webhookDelete(id: $id) { success } }`,
	teamIdByKey: `query ($key: String!) { teams(filter: { key: { eq: $key } }) { nodes { id } } }`,
	teamsList: `query { teams(first: 50) { nodes { id key name } } }`,
};

export function isUuidLike(value: string): boolean {
	return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
		value,
	);
}

function isIssueKey(value: string): boolean {
	return /^[A-Z][A-Z0-9_]*-\d+$/.test(value);
}

function parseIssueKey(
	key: string,
): { teamKey: string; number: number } | null {
	const m = key.match(/^([A-Z][A-Z0-9_]*)-(\d+)$/);
	if (!m) return null;
	return { teamKey: m[1], number: Number(m[2]) };
}

export async function resolveTeamIdFromKey(
	env: Env,
	teamKey: string,
): Promise<string> {
	const td = await linearFetch<{ teams: { nodes: Array<{ id: string }> } }>(
		env,
		GQL.teamByKey,
		{ key: teamKey },
	);
	const teamId = td.teams.nodes[0]?.id as string | undefined;
	if (!teamId) throw new Error(`Team no encontrado: ${teamKey}`);
	return teamId;
}

export async function resolveIssueId(
	env: Env,
	idOrKey: string,
): Promise<string> {
	if (isUuidLike(idOrKey)) return idOrKey;
	if (isIssueKey(idOrKey)) {
		const parsed = parseIssueKey(idOrKey);
		if (!parsed) throw new Error(`Formato de clave inválido: ${idOrKey}`);
		const teamId = await resolveTeamIdFromKey(env, parsed.teamKey);
		const d = await linearFetch<{ issues: { nodes: Array<{ id: string }> } }>(
			env,
			GQL.issueIdByTeamAndNumber,
			{ teamId, number: parsed.number },
		);
		const id = d.issues?.nodes?.[0]?.id as string | undefined;
		if (!id) throw new Error(`Issue no encontrado: ${idOrKey}`);
		return id;
	}
	// Fallback: try as id; if not found, throw
	const d = await linearFetch<{ issue?: { id?: string } }>(env, GQL.issueById, {
		id: idOrKey,
	});
	if (!d.issue?.id) throw new Error(`Issue no encontrado: ${idOrKey}`);
	return d.issue.id as string;
}


