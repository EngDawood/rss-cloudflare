import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools';

export class RSSReaderMCP extends McpAgent<Env> {
	server = new McpServer({ name: 'rss-reader', version: '1.0.0' });

	async init() {
		registerTools(this.server, this.env);
	}
}
