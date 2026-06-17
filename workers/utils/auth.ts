import type { Context } from 'hono';

type HonoEnv = { Bindings: Env };

/**
 * Extract the presented auth token from either the `Authorization: Bearer <t>`
 * header or a `?token=<t>` query param. The query param is supported for
 * URL-based clients (e.g. MCP connectors) that can't set custom headers.
 */
function presentedToken(c: Context<HonoEnv>): string | null {
	const header = c.req.header('Authorization');
	if (header?.startsWith('Bearer ')) return header.slice(7);
	return c.req.query('token') ?? null;
}

/**
 * Fail-closed auth for the admin `/api/*` endpoints. If `MCP_AUTH_TOKEN` is not
 * configured the endpoints are unusable (503) rather than silently open to the
 * world. Returns a `Response` to short-circuit the handler, or `null` when the
 * request is authorized.
 */
export function requireApiAuth(c: Context<HonoEnv>): Response | null {
	const token = c.env.MCP_AUTH_TOKEN;
	if (!token) {
		return c.json({ error: 'Server auth not configured: set the MCP_AUTH_TOKEN secret' }, 503);
	}
	if (presentedToken(c) !== token) {
		return c.json({ error: 'Unauthorized' }, 401);
	}
	return null;
}

/**
 * Auth gate for the `/mcp` endpoint. Enforced only when `MCP_AUTH_TOKEN` is
 * configured, so an unconfigured deployment (e.g. an existing claude.ai
 * connector) keeps working. Accepts the token via the `Authorization` header or
 * a `?token=` query param. Returns `true` when the request should be REJECTED.
 */
export function mcpAuthRejected(c: Context<HonoEnv>): boolean {
	const token = c.env.MCP_AUTH_TOKEN;
	if (!token) return false;
	return presentedToken(c) !== token;
}
