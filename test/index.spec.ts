import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../workers';

const expectedNotFound = '{"error":"Not found","usage":{"username":"/instagram?u=username","hashtag":"/instagram?h=hashtag","location":"/instagram?l=location_id","params":"media_type=all|video|picture|multiple, direct_links=true|false","mcp":"/mcp"}}';

describe('RSS Bridge worker', () => {
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
});