import { describe, it, expect } from 'vitest';
import {
	CACHE_PREFIX_FEED, CACHE_PREFIX_UID,
	FEED_CACHE_TTL, TELEGRAM_CONFIG_TTL,
	RSS_ITEMS_LIMIT, TITLE_MAX_LENGTH,
	DEFAULT_FORMAT_SETTINGS, DEFAULT_ADMIN_CONFIG,
	FORMAT_LABELS
} from '../workers/constants';

describe('constants', () => {
	it('should have correct cache prefix values', () => {
		expect(CACHE_PREFIX_FEED).toBe('feed:');
		expect(CACHE_PREFIX_UID).toBe('uid:');
	});

	it('should have positive TTL values', () => {
		expect(FEED_CACHE_TTL).toBeGreaterThan(0);
		expect(TELEGRAM_CONFIG_TTL).toBeGreaterThan(0);
	});

	it('should have sensible item limits', () => {
		expect(RSS_ITEMS_LIMIT).toBeGreaterThan(0);
		expect(RSS_ITEMS_LIMIT).toBeLessThanOrEqual(100);
		expect(TITLE_MAX_LENGTH).toBeGreaterThan(0);
	});

	it('should have complete DEFAULT_FORMAT_SETTINGS with all required keys', () => {
		const requiredKeys = [
			'notification', 'media', 'author', 'sourceFormat',
			'linkPreview', 'lengthLimit', 'fallbackMode',
			'hashtags', 'removeTikTokViews'
		];
		for (const key of requiredKeys) {
			expect(DEFAULT_FORMAT_SETTINGS).toHaveProperty(key);
		}
	});

	it('should have DEFAULT_ADMIN_CONFIG with telegraph defaults', () => {
		expect(DEFAULT_ADMIN_CONFIG).toHaveProperty('telegraph');
		expect(DEFAULT_ADMIN_CONFIG.telegraph).toHaveProperty('enabled');
		expect(DEFAULT_ADMIN_CONFIG.telegraph).toHaveProperty('threshold');
		expect(typeof DEFAULT_ADMIN_CONFIG.telegraph.enabled).toBe('boolean');
		expect(typeof DEFAULT_ADMIN_CONFIG.telegraph.threshold).toBe('number');
		expect(DEFAULT_ADMIN_CONFIG.telegraph.threshold).toBeGreaterThan(0);
	});

	it('should have FORMAT_LABELS for all settings in DEFAULT_FORMAT_SETTINGS', () => {
		for (const key of Object.keys(DEFAULT_FORMAT_SETTINGS)) {
			expect(FORMAT_LABELS).toHaveProperty(key);
			expect(FORMAT_LABELS[key]).toHaveProperty('label');
			expect(typeof FORMAT_LABELS[key].label).toBe('string');
		}
	});
});
