import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../workers';

const expectedNotFound = '{"error":"Not found","usage":{"username":"/instagram?u=username","hashtag":"/instagram?h=hashtag","location":"/instagram?l=location_id","params":"media_type=all|video|picture|multiple, direct_links=true|false","mcp":"/mcp"}}';

describe('RSS Bridge worker', () => {
	// ── 404 responses ──────────────────────────────────────────────────

	it('responds with Not found for unknown routes (unit style)', async () => {
		const request = new Request<unknown, IncomingRequestCfProperties>('http://example.com/message');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toBe(expectedNotFound);
	});

	it('responds with Not found for unknown routes (integration style)', async () => {
		const request = new Request('http://example.com/message');
		const response = await SELF.fetch(request);
		expect(await response.text()).toBe(expectedNotFound);
	});

	it('returns 404 status code for unknown routes', async () => {
		const response = await SELF.fetch('http://example.com/nonexistent');
		expect(response.status).toBe(404);
	});

	it('returns JSON content-type for 404 responses', async () => {
		const response = await SELF.fetch('http://example.com/xyz');
		expect(response.headers.get('content-type')).toContain('application/json');
	});

	// ── /health endpoint ───────────────────────────────────────────────

	it('responds with 200 OK for /health', async () => {
		const response = await SELF.fetch('http://example.com/health');
		expect(response.status).toBe(200);
		const body = await response.json() as { status: string; timestamp: string };
		expect(body.status).toBe('ok');
		expect(body.timestamp).toBeDefined();
		expect(typeof body.timestamp).toBe('string');
	});

	it('returns a valid ISO timestamp from /health', async () => {
		const response = await SELF.fetch('http://example.com/health');
		const body = await response.json() as { timestamp: string };
		const parsed = new Date(body.timestamp);
		expect(parsed.getTime()).not.toBeNaN();
	});
});