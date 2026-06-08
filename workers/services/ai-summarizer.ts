import type { FeedItem } from '../types/feed';
import { updateItemSummary, resolveAiModel, resolveAiPrompt } from '../db/d1';

const GATEWAY_URL =
	'https://gateway.ai.cloudflare.com/v1/c53938b50ea00b247dcd72dd2e9eada3/rss-summarizer/compat/chat/completions';

const DEFAULT_DYNAMIC_ROUTE = 'dynamic/summarize';

const SYSTEM_PROMPT =
	'أنت مساعد متخصص في تلخيص الأخبار والمقالات. ' +
	'لخّص المحتوى التالي في 2-3 جمل مختصرة وواضحة باللغة العربية فقط، ' +
	'بغض النظر عن لغة النص الأصلي. ' +
	'أخرج الملخص فقط دون أي عناوين أو مقدمات.';

function normalizeGatewayModel(model: string): string {
	if (
		model.startsWith('workers-ai/') ||
		model.startsWith('openai/') ||
		model.startsWith('google-ai-studio/') ||
		model.startsWith('google-vertex-ai/') ||
		model.startsWith('anthropic/') ||
		model.startsWith('groq/') ||
		model.startsWith('cohere/') ||
		model.startsWith('perplexity/') ||
		model.startsWith('deepseek/') ||
		model.startsWith('cerebras/') ||
		model.startsWith('openrouter/')
	) {
		return model;
	}

	if (model.startsWith('google/gemini-') || model.startsWith('gemini-')) {
		const name = model.replace(/^google\//, '');
		return `google-ai-studio/${name}`;
	}

	if (
		model.startsWith('@cf/') ||
		model.startsWith('nvidia/') ||
		model.startsWith('meta/') ||
		model.startsWith('qwen/') ||
		model.startsWith('microsoft/') ||
		model.startsWith('google/gemma')
	) {
		const cfModel = model.startsWith('@cf/') ? model : `@cf/${model}`;
		return `workers-ai/${cfModel}`;
	}

	return model;
}

export async function summarizeItem(
	item: FeedItem,
	env: Env,
	model?: string,
	systemPrompt: string = SYSTEM_PROMPT,
	feedId?: string,
): Promise<string | null> {
	if (!item.text || item.text.trim().length < 50) {
		throw new Error('Article text is too short to summarize (must be at least 50 characters).');
	}

	// Use user-configured model if explicitly provided; otherwise use the gateway dynamic route
	const resolvedModel = model ? normalizeGatewayModel(model) : DEFAULT_DYNAMIC_ROUTE;

	try {
		const response = await fetch(GATEWAY_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_TOKEN}`,
				'cf-aig-cache-ttl': '3600', // Enable edge caching for 1 hour
				'cf-aig-metadata': JSON.stringify({
					purpose: 'summarize',
					feedId: feedId || 'none',
					itemId: item.id || 'none',
				}),
			},
			body: JSON.stringify({
				model: resolvedModel,
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: item.text.slice(0, 2000) },
				],
				max_tokens: 300,
				temperature: 0.3,
			}),
		});

		if (!response.ok) {
			const errText = await response.text();
			throw new Error(`AI Gateway returned ${response.status}: ${errText}`);
		}

		const data = (await response.json()) as {
			choices?: { message?: { content?: string } }[];
		};

		const summary = data.choices?.[0]?.message?.content?.trim();
		if (!summary) {
			throw new Error('AI Gateway returned an empty summary response.');
		}
		return summary;
	} catch (err: any) {
		console.error('[AI] Summarization failed for item', item.id, ':', err);
		throw err;
	}
}

/**
 * Generate and persist an Arabic summary for an item if not already cached.
 * Resolves model and prompt overrides from D1 when channelId is provided.
 * Mutates item.summary in-place.
 */
export async function maybeEnrichSummary(
	item: FeedItem,
	feedId: string,
	db: D1Database,
	env: Env,
	channelId?: string,
	sourceId?: string,
): Promise<void> {
	if (item.summary) return; // already cached in D1
	let model: string | undefined = undefined;
	let prompt = SYSTEM_PROMPT;
	if (channelId) {
		const [resolvedModel, resolvedPrompt] = await Promise.all([
			resolveAiModel(db, channelId, sourceId),
			resolveAiPrompt(db, channelId, sourceId),
		]);
		if (resolvedModel) model = resolvedModel;
		if (resolvedPrompt) prompt = resolvedPrompt;
	}
	try {
		const summary = await summarizeItem(item, env, model, prompt, feedId);
		if (!summary) return;
		item.summary = summary;
		await updateItemSummary(db, feedId, item.id, summary);
	} catch (err) {
		console.error('[AI] maybeEnrichSummary failed:', err);
	}
}
