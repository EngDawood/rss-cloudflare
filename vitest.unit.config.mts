import { defineConfig } from 'vitest/config';
// Local-only config for pure unit specs that stub fetch and need no Workers
// pool (the default workers pool requires a logged-in wrangler session for
// its remote bindings). Not used by `pnpm test`.
export default defineConfig({
	test: { include: ['test/media-downloader.spec.ts'], environment: 'node' },
});
