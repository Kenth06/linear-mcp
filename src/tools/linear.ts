export async function linearFetch(
	env: Env,
	query: string,
	variables?: Record<string, unknown>,
) {
	const res = await fetch(env.LINEAR_GRAPHQL_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: env.LINEAR_API_KEY,
		},
		body: JSON.stringify({ query, variables }),
	});
	const json = await res.json<any>();
	if (!res.ok || json.errors) {
		throw new Error(`Linear ${res.status}: ${JSON.stringify(json.errors || json)}`);
	}
	return json.data;
}

export const GQL = {
	teamByKey: `
		query ($key: String!) { teams(filter: { key: { eq: $key } }) { nodes { id key name } } }`,
	userByEmail: `
		query ($email: String!) { users(filter: { email: { eq: $email } }) { nodes { id name email } } }`,
	issueByIdOrKey: `
		query ($id: String!) { issue(id: $id) { id team { id } } }`,
	teamWorkflowStates: `
		query ($teamId: String!) { workflowStates(filter: { team: { id: { eq: $teamId } } }) { nodes { id name type } } }`,
	issuesByFilter: `
		query (
			$teamId: String, $assigneeId: String,
			$updatedAfter: DateTime, $updatedBefore: DateTime,
			$createdAfter: DateTime, $createdBefore: DateTime
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
};


