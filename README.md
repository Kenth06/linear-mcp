## Linear MCP on Cloudflare Workers

Remote MCP server to manage Linear via HTTP, deployed on Cloudflare Workers. Built with TypeScript, Hono, and the MCP SDK.

### Features

- MCP HTTP endpoint at `/mcp` compatible with clients like Claude Desktop
- Health endpoint at `/health`
- Linear tools:
  - `linearCreateIssue`: create issues (supports `state` by name/type)
  - `linearUpdateIssue`: update title, description, state (UUID or alias), assignee, due date
  - `linearComment`: add Markdown comments by issue id or key (e.g., `ENG-123`)
  - `linearDeleteIssue`: delete issues by id or key
  - `linearWebhookCreate` / `linearWebhookDelete`
  - `linearListIssues`: filter by team, assignee, and date ranges
  - `linearListIssuesToday`: issues updated today
  - `linearGetIssue`: detailed issue view by id/key

### Requirements

- Node 18+
- Cloudflare account + Wrangler

### Install

```bash
npm i
```

### Cloudflare configuration (secrets)

```bash
wrangler secret put MCP_SERVER_NAME            # e.g., linear-mcp
wrangler secret put LINEAR_GRAPHQL_URL         # https://api.linear.app/graphql
wrangler secret put LINEAR_API_KEY             # personal key (Authorization: <KEY>)
# Optional for webhooks/forwarding (not required for MCP tools)
wrangler secret put LINEAR_WEBHOOK_SECRET
wrangler secret put FORWARD_URL
wrangler secret put FORWARD_SIGNING_SECRET
```

### Local development

```bash
npm run dev
curl -s http://127.0.0.1:8787/health | jq
```

### HTTP MCP examples

List tools:

```bash
curl -s -X POST http://127.0.0.1:8787/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}' | jq
```

Create issue:

```bash
curl -s -X POST http://127.0.0.1:8787/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":"2","method":"tools/call",
       "params":{"name":"linearCreateIssue",
                 "arguments":{"teamKey":"ENG","title":"Test","dueToday":true}}}' | jq
```

Update issue to active (name/type alias resolution):

```bash
curl -s -X POST http://127.0.0.1:8787/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":"3","method":"tools/call",
       "params":{"name":"linearUpdateIssue",
                 "arguments":{"idOrKey":"ENG-123","state":"active"}}}' | jq
```

List issues today for a team:

```bash
curl -s -X POST http://127.0.0.1:8787/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":"4","method":"tools/call",
       "params":{"name":"linearListIssuesToday",
                 "arguments":{"teamKey":"ENG"}}}' | jq
```

### Deploy

```bash
npm run deploy
```

Worker URL example:

```
https://<your-worker>.workers.dev
```

You can call `/mcp` directly:

```bash
curl -s -X POST https://<your-worker>.workers.dev/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}' | jq
```

### Claude Desktop integration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<your-worker>.workers.dev/mcp"],
      "url": "https://<your-worker>.workers.dev/mcp",
      "name": "Linear MCP",
      "version": "1.0.0"
    }
  }
}
```

Restart Claude. The tools will appear automatically.

### Webhooks

Receiver: `POST /webhooks/linear` validates HMAC (`linear-signature`) and optionally forwards signed payloads to `FORWARD_URL` with `x-mcp-signature` and `x-mcp-timestamp`.

Create via tool:

```bash
curl -s -X POST http://127.0.0.1:8787/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":"5","method":"tools/call",
       "params":{"name":"linearWebhookCreate",
                 "arguments":{"url":"https://<your-worker>.workers.dev/webhooks/linear",
                              "allPublicTeams":true}}}' | jq
```

### Implementation notes

- Codebase
  - `src/index.ts`: Hono app, MCP mount `/mcp`, webhook receiver, HMAC verification
  - `src/factory.ts`: tool registration
  - `src/tools/linear.ts`: GraphQL helpers + queries/mutations
  - Tools in `src/tools/*`
- Durable Object
  - Defined as `LinearMCP` in `wrangler.jsonc` with binding `MCP_OBJECT`
- Type generation
  - `npm run cf-typegen` writes `worker-configuration.d.ts`

### Security

- All credentials via Cloudflare Secrets
- HMAC verification for incoming webhooks
- Signed forwarding with `x-mcp-signature`

### Troubleshooting

- 401/403 from Linear: verify `LINEAR_API_KEY` and `LINEAR_GRAPHQL_URL = https://api.linear.app/graphql`
- “Team no encontrado”: check `teamKey` value in Linear
- State updates: `stateId` must be UUID; tools accept aliases and resolve automatically

### License

MIT


