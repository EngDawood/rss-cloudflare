import { describe, it, expect } from 'vitest';
import { resolveToolsMetadata } from '../workers/workflows/tools';

describe('Workflow Tools Metadata', () => {
	it('resolves correct schemas for enabled tools', () => {
		const tools = resolveToolsMetadata(['telegram', 'emdash']);
		expect(tools).toHaveLength(2);
		
		const telegramTool = tools.find(t => t.function.name === 'telegram_send_message');
		expect(telegramTool).toBeDefined();
		expect(telegramTool?.function.parameters.required).toContain('chatId');
		expect(telegramTool?.function.parameters.required).toContain('text');

		const emdashTool = tools.find(t => t.function.name === 'emdash_mcp_call');
		expect(emdashTool).toBeDefined();
		expect(emdashTool?.function.parameters.required).toContain('toolName');
		expect(emdashTool?.function.parameters.required).toContain('arguments');
	});

	it('returns empty array when no tools enabled', () => {
		const tools = resolveToolsMetadata([]);
		expect(tools).toHaveLength(0);
	});
});
