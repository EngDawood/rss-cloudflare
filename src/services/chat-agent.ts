import {
	getFeeds, listNewItems, searchItems, getChats,
	listNotes, insertNote, recall, listPostLog, getConfig
} from '../db/d1';

const GATEWAY_URL =
	'https://gateway.ai.cloudflare.com/v1/c53938b50ea00b247dcd72dd2e9eada3/rss-summarizer/compat/chat/completions';

// Choose a fast, tool-capable model for chat
const CHAT_MODEL = 'google/gemini-2.0-flash';

const AGENT_SYSTEM_PROMPT =
	`You are the official RSS & MCP Chat Agent. You have access to the local RSS reader database ` +
	`and can perform read-only queries (feeds, unread items, logs) as well as save administrative notes. ` +
	`Always use the appropriate tools to answer user questions about feeds, unread items, logs, or notes. ` +
	`Respond clearly, concisely, and formatting your answers in markdown. ` +
	`If you execute a tool, summarize the outcome to the user. Do not make up facts; use the tools to check the database.`;

// Define tools in OpenAI-compatible format
const AGENT_TOOLS = [
	{
		type: 'function' as const,
		function: {
			name: 'list_feeds',
			description: 'List all registered RSS feeds with their title, URL, enabled status, and last fetched timestamp.',
			parameters: { type: 'object', properties: {} }
		}
	},
	{
		type: 'function' as const,
		function: {
			name: 'list_new_items',
			description: 'List recent unread articles. Can filter by feedId, keyword query, or limit.',
			parameters: {
				type: 'object',
				properties: {
					feedId: { type: 'string', description: 'Filter items by a specific feed ID.' },
					query: { type: 'string', description: 'Filter items by keyword search.' },
					limit: { type: 'number', description: 'Maximum number of items to return (default 10).' }
				}
			}
		}
	},
	{
		type: 'function' as const,
		function: {
			name: 'search_items',
			description: 'Search all stored items (read and unread) by a keyword query.',
			parameters: {
				type: 'object',
				required: ['query'],
				properties: {
					query: { type: 'string', description: 'The search term/keyword.' },
					feedId: { type: 'string', description: 'Filter search by a specific feed ID.' },
					limit: { type: 'number', description: 'Maximum items to return (default 10).' }
				}
			}
		}
	},
	{
		type: 'function' as const,
		function: {
			name: 'list_chats',
			description: 'List all registered Telegram target chats (channels, groups, defaults).',
			parameters: { type: 'object', properties: {} }
		}
	},
	{
		type: 'function' as const,
		function: {
			name: 'list_notes',
			description: 'List saved memory notes. Can optionally filter by tag.',
			parameters: {
				type: 'object',
				properties: {
					limit: { type: 'number', description: 'Max notes to list.' },
					tag: { type: 'string', description: 'Filter notes by a specific tag.' }
				}
			}
		}
	},
	{
		type: 'function' as const,
		function: {
			name: 'save_note',
			description: 'Save a freeform administrative note or recap to D1 memory.',
			parameters: {
				type: 'object',
				required: ['content'],
				properties: {
					content: { type: 'string', description: 'The note text.' },
					tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags to group the note.' }
				}
			}
		}
	},
	{
		type: 'function' as const,
		function: {
			name: 'recall',
			description: 'Retrieve the unified timeline of notes and Telegram post logs.',
			parameters: {
				type: 'object',
				properties: {
					limit: { type: 'number', description: 'Max events to return.' }
				}
			}
		}
	},
	{
		type: 'function' as const,
		function: {
			name: 'list_post_log',
			description: 'List history of dispatched posts and errors.',
			parameters: {
				type: 'object',
				properties: {
					limit: { type: 'number', description: 'Max logs to return.' }
				}
			}
		}
	}
];

export async function runChatAgent(
	history: Array<{ role: 'user' | 'assistant'; content: string }>,
	env: Env,
): Promise<{ response: string; toolsCalled: string[] }> {
	const db = env.DB;
	const toolsCalled: string[] = [];

	// Resolve model: D1 config override -> env chat model -> env default model -> hardcoded fallback
	const resolvedModel = await getConfig(db, 'ai_model') || env.CHAT_AI_MODEL || env.DEFAULT_AI_MODEL || CHAT_MODEL;

	// Build messages array
	const messages: any[] = [
		{ role: 'system', content: AGENT_SYSTEM_PROMPT },
		...history.map(msg => ({
			role: msg.role,
			content: msg.content
		}))
	];

	let turns = 0;
	let responseText = 'Sorry, the agent timed out or failed to respond.';

	while (turns < 3) {
		turns++;
		
		const response = await fetch(GATEWAY_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_TOKEN}`
			},
			body: JSON.stringify({
				model: resolvedModel,
				messages,
				tools: AGENT_TOOLS,
				tool_choice: 'auto'
			})
		});

		if (!response.ok) {
			const text = await response.text();
			console.error('[Agent] Gateway returned error:', response.status, text);
			return { response: `Gateway Error (${response.status}): ${text}`, toolsCalled };
		}

		const data = (await response.json()) as {
			choices?: {
				message?: {
					content?: string | null;
					tool_calls?: Array<{
						id: string;
						type: string;
						function: {
							name: string;
							arguments: string;
						}
					}>;
				}
			}[];
		};

		const message = data.choices?.[0]?.message;
		if (!message) {
			break;
		}

		// Keep track of assistant message
		messages.push(message);

		if (message.content) {
			responseText = message.content;
		}

		if (message.tool_calls && message.tool_calls.length > 0) {
			// Execute tool calls
			for (const call of message.tool_calls) {
				const { name, arguments: rawArgs } = call.function;
				toolsCalled.push(name);
				
				let args: any = {};
				try {
					args = JSON.parse(rawArgs);
				} catch (e) {}

				let toolResult: any;
				try {
					switch (name) {
						case 'list_feeds':
							toolResult = await getFeeds(db);
							break;
						case 'list_new_items':
							toolResult = await listNewItems(db, {
								feedId: args.feedId,
								query: args.query,
								limit: args.limit || 10
							});
							break;
						case 'search_items':
							toolResult = await searchItems(db, {
								query: args.query,
								feedId: args.feedId,
								limit: args.limit || 10
							});
							break;
						case 'list_chats':
							toolResult = await getChats(db);
							break;
						case 'list_notes':
							toolResult = await listNotes(db, args.limit || 10, args.tag);
							break;
						case 'save_note':
							toolResult = await insertNote(db, {
								content: args.content,
								tags: args.tags
							});
							break;
						case 'recall':
							toolResult = await recall(db, args.limit || 10);
							break;
						case 'list_post_log':
							toolResult = await listPostLog(db, args.limit || 10, {});
							break;
						default:
							toolResult = { error: `Tool ${name} not found.` };
					}
				} catch (err: any) {
					console.error(`[Agent] Tool execution error for ${name}:`, err);
					toolResult = { error: err.message || String(err) };
				}

				// Push tool response
				messages.push({
					role: 'tool',
					tool_call_id: call.id,
					name,
					content: JSON.stringify(toolResult)
				});
			}
			// Continue the loop to let the LLM generate the final summary based on tool results
		} else {
			// No more tool calls, we have the final text response
			break;
		}
	}

	return {
		response: responseText,
		toolsCalled
	};
}
