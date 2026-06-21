import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import { configDefaults } from 'vitest/config';

export default defineWorkersConfig({
	test: {
		exclude: [...configDefaults.exclude, '**/.claude/**'],
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.test.jsonc' },
			},
		},
	},
});
