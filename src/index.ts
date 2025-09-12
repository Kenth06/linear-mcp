import { Hono } from "hono";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./factory";

/* ---------- MCP ---------- */
export class LinearMCP extends McpAgent {
	server = new McpServer({ name: "Linear MCP", version: "1.0.0" });
	async init() {
		registerTools(this.server, this.env as Env);
	}
}

/* ---------- App Hono ---------- */
const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) =>
	c.json({ ok: true, name: c.env.MCP_SERVER_NAME, version: "1.0.0" }),
);

async function hmacHex(secret: string, data: ArrayBuffer) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, data);
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

app.post("/webhooks/linear", async (c) => {
	const env = c.env as Env;
	if (!env.LINEAR_WEBHOOK_SECRET) return c.body(null, 401);

	const raw = await c.req.raw.clone().arrayBuffer();
	const got = c.req.header("linear-signature");
	if (!got) return c.body(null, 401);

	const calc = await hmacHex(env.LINEAR_WEBHOOK_SECRET, raw);
	const ok =
		got.length === calc.length &&
		[...got].reduce(
			(acc, ch, i) => acc | (ch.charCodeAt(0) ^ calc.charCodeAt(i)),
			0,
		) === 0;
	if (!ok) return c.body(null, 401);

	const body = await c.req.json<{ webhookTimestamp?: number }>();
	if (
		!body.webhookTimestamp ||
		Math.abs(Date.now() - body.webhookTimestamp) > 60_000
	) {
		return c.body(null, 401);
	}

	if (env.FORWARD_URL) {
		const headers: Record<string, string> = {
			"content-type": "application/json",
			"x-mcp-timestamp": String(Date.now()),
		};
		if (env.FORWARD_SIGNING_SECRET) {
			const sigHex = await hmacHex(env.FORWARD_SIGNING_SECRET, raw);
			headers["x-mcp-signature"] = sigHex;
		}
		c.executionCtx.waitUntil(
			fetch(env.FORWARD_URL, { method: "POST", headers, body: raw }),
		);
	}

	return c.body(null, 200);
});

app.mount("/mcp", LinearMCP.serve("/mcp").fetch, { replaceRequest: false });

export default app;

declare global {
		interface Env {
			MCP_SERVER_NAME: string;
			LINEAR_GRAPHQL_URL: string;
			LINEAR_API_KEY: string;
			LINEAR_WEBHOOK_SECRET?: string;
			FORWARD_URL?: string;
			FORWARD_SIGNING_SECRET?: string;
			MCP_OBJECT?: DurableObjectNamespace<LinearMCP>;
		}
	}
