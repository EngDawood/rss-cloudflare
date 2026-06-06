import type { FeedItem } from '../types/feed';
import { updateItemSummary, resolveAiModel, resolveAiPrompt } from '../db/d1';

const GATEWAY_URL =
	'https://gateway.ai.cloudflare.com/v1/c53938b50ea00b247dcd72dd2e9eada3/rss-summarizer/compat/chat/completions';

const DEFAULT_MODEL = 'nvidia/llama-3.1-nemotron-70b-instruct';

const SYSTEM_PROMPT =
	'أنت مساعد متخصص في تلخيص الأخبار والمقالات. ' +
	'لخّص المحتوى التالي في 2-3 جمل مختصرة وواضحة باللغة العربية فقط، ' +
	'بغض النظر عن لغة النص الأصلي. ' +
	'أخرج الملخص فقط دون أي عناوين أو مقدمات.';

/**
 * Generate an Arabic summary of a feed item via the Cloudflare AI Gateway
 * universal endpoint (/compat/chat/completions).
 * Returns null silently on any error — never throws.
 */
export async function summarizeItem(
	item: FeedItem,
	env: Env,
	model?: string,
	systemPrompt: string = SYSTEM_PROMPT,
): Promise<string | null> {
	if (!item.text || item.text.trim().length < 50) return null;

	const resolvedModel = model || env.DEFAULT_AI_MODEL || DEFAULT_MODEL;

	try {
		const response = await fetch(GATEWAY_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_TOKEN}`,
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
			console.error('[AI] Gateway returned', response.status, await response.text());
			return null;
		}

		const data = (await response.json()) as {
			choices?: { message?: { content?: string } }[];
		};

		const summary = data.choices?.[0]?.message?.content?.trim();
		return summary || null;
	} catch (err) {
		console.error('[AI] Summarization failed for item', item.id, ':', err);
		return null;
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
	let model = env.DEFAULT_AI_MODEL || DEFAULT_MODEL;
	let prompt = SYSTEM_PROMPT;
	if (channelId) {
		const [resolvedModel, resolvedPrompt] = await Promise.all([
			resolveAiModel(db, channelId, sourceId),
			resolveAiPrompt(db, channelId, sourceId),
		]);
		if (resolvedModel) model = resolvedModel;
		if (resolvedPrompt) prompt = resolvedPrompt;
	}
	const summary = await summarizeItem(item, env, model, prompt);
	if (!summary) return;
	item.summary = summary;
	await updateItemSummary(db, feedId, item.id, summary);
}
