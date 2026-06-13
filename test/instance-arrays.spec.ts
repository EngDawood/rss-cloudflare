import { describe, it, expect } from 'vitest';
import { RSS_BRIDGE_INSTANCES, RSS_BRIDGE_TIKTOK_INSTANCES, RSSHUB_INSTANCES } from '../workers/services/source-fetcher';

describe('instance arrays', () => {
	it('should have non-empty instance arrays', () => {
		expect(RSS_BRIDGE_INSTANCES.length).toBeGreaterThan(0);
		expect(RSS_BRIDGE_TIKTOK_INSTANCES.length).toBeGreaterThan(0);
		expect(RSSHUB_INSTANCES.length).toBeGreaterThan(0);
	});

	it('should have all HTTPS URLs in RSS_BRIDGE_INSTANCES', () => {
		for (const url of RSS_BRIDGE_INSTANCES) {
			expect(url).toMatch(/^https:\/\//);
		}
	});

	it('should have all HTTPS URLs in RSSHUB_INSTANCES', () => {
		for (const url of RSSHUB_INSTANCES) {
			expect(url).toMatch(/^https:\/\//);
		}
	});

	it('should have no duplicate entries in RSS_BRIDGE_INSTANCES', () => {
		const unique = new Set(RSS_BRIDGE_INSTANCES);
		expect(unique.size).toBe(RSS_BRIDGE_INSTANCES.length);
	});

	it('should have no duplicate entries in RSSHUB_INSTANCES', () => {
		const unique = new Set(RSSHUB_INSTANCES);
		expect(unique.size).toBe(RSSHUB_INSTANCES.length);
	});

	it('should have RSS_BRIDGE_TIKTOK_INSTANCES as superset of bridge01', () => {
		const bridge01 = 'https://rss-bridge.org/bridge01';
		expect(RSS_BRIDGE_TIKTOK_INSTANCES).toContain(bridge01);
		expect(RSS_BRIDGE_TIKTOK_INSTANCES[0]).toBe(bridge01);
		// All entries from RSS_BRIDGE_INSTANCES should be present
		for (const inst of RSS_BRIDGE_INSTANCES) {
			expect(RSS_BRIDGE_TIKTOK_INSTANCES).toContain(inst);
		}
	});

	it('should have no trailing slashes on instance URLs', () => {
		for (const url of [...RSS_BRIDGE_INSTANCES, ...RSSHUB_INSTANCES]) {
			expect(url).not.toMatch(/\/$/);
		}
	});
});
