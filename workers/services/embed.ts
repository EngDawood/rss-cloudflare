/**
 * Vectorize + Workers AI embedding helpers.
 *
 * All functions are no-ops when the AI or VECTORIZE_ITEMS bindings are absent,
 * so the worker runs without Vectorize configured and falls back to LIKE search.
 *
 * Setup (one-time, not automated):
 *   npx wrangler vectorize create rss-items --dimensions=1024 --metric=cosine
 *   npm run cf-typegen   (to regenerate Env types after wrangler.jsonc changes)
 */
import type { FeedItem } from '../types/feed';

const EMBEDDING_MODEL = '@cf/baai/bge-m3';
const SCORE_THRESHOLD = 0.7;
const MAX_TEXT_CHARS = 2000;

type AiBinding = { run: (model: string, input: { text: string[] }) => Promise<{ data: { embedding: number[] }[] }> };
type VectorizeBinding = {
	upsert: (vectors: { id: string; values: number[]; namespace?: string; metadata?: Record<string, string | number | boolean> }[]) => Promise<void>;
	query: (values: number[], opts: { topK: number; namespace?: string; filter?: Record<string, string | number | boolean>; returnMetadata?: string }) => Promise<{ matches: { id: string; score: number }[] }>;
};

function getBindings(env: Env): { ai: AiBinding | undefined; vectorize: VectorizeBinding | undefined } {
	const e = env as unknown as Record<string, unknown>;
	return {
		ai: e['AI'] as AiBinding | undefined,
		vectorize: e['VECTORIZE_ITEMS'] as VectorizeBinding | undefined,
	};
}

function buildItemText(item: FeedItem): string {
	return [item.title, item.author, item.text].filter(Boolean).join('\n').slice(0, MAX_TEXT_CHARS);
}

/**
 * Embed feed items and upsert to the 'items' namespace in Vectorize.
 * Called after upsertItems in the queue handler for newly inserted items.
 */
export async function embedItems(env: Env, feedId: string, items: FeedItem[]): Promise<void> {
	const { ai, vectorize } = getBindings(env);
	if (!ai || !vectorize || items.length === 0) return;
	try {
		const texts = items.map(buildItemText);
		const result = await ai.run(EMBEDDING_MODEL, { text: texts });
		const vectors = items.map((item, i) => ({
			id: `item:${item.id}`,
			values: result.data[i].embedding,
			namespace: 'items',
			metadata: { feed_id: feedId, timestamp: item.timestamp },
		}));
		await vectorize.upsert(vectors);
	} catch (err) {
		console.error('[Embed] Failed to embed items:', err);
	}
}

/**
 * Embed a single note and upsert to the 'notes' namespace in Vectorize.
 */
export async function embedNote(env: Env, noteId: string, content: string): Promise<void> {
	const { ai, vectorize } = getBindings(env);
	if (!ai || !vectorize) return;
	try {
		const result = await ai.run(EMBEDDING_MODEL, { text: [content.slice(0, MAX_TEXT_CHARS)] });
		await vectorize.upsert([{
			id: `note:${noteId}`,
			values: result.data[0].embedding,
			namespace: 'notes',
			metadata: { preview: content.slice(0, 100) },
		}]);
	} catch (err) {
		console.error('[Embed] Failed to embed note:', err);
	}
}

/**
 * Semantic search over items using Vectorize.
 * Returns item IDs sorted by similarity score (highest first).
 * Returns [] when Vectorize is not configured — caller should fall back to LIKE search.
 */
export async function semanticSearchItems(
	env: Env,
	query: string,
	opts?: { limit?: number; feedId?: string },
): Promise<string[]> {
	const { ai, vectorize } = getBindings(env);
	if (!ai || !vectorize) return [];
	const { limit = 20, feedId } = opts ?? {};
	try {
		const result = await ai.run(EMBEDDING_MODEL, { text: [query] });
		const embedding = result.data[0].embedding;
		const queryOpts: Parameters<VectorizeBinding['query']>[1] = {
			topK: limit,
			namespace: 'items',
			returnMetadata: 'none',
		};
		if (feedId) queryOpts.filter = { feed_id: feedId };
		const queryResult = await vectorize.query(embedding, queryOpts);
		return (queryResult.matches ?? [])
			.filter(m => m.score >= SCORE_THRESHOLD)
			.map(m => m.id.replace('item:', ''));
	} catch (err) {
		console.error('[Embed] Semantic item search failed:', err);
		return [];
	}
}

/**
 * Semantic search over notes using Vectorize.
 * Returns note IDs sorted by similarity score.
 */
export async function semanticSearchNotes(env: Env, query: string, limit = 20): Promise<string[]> {
	const { ai, vectorize } = getBindings(env);
	if (!ai || !vectorize) return [];
	try {
		const result = await ai.run(EMBEDDING_MODEL, { text: [query] });
		const embedding = result.data[0].embedding;
		const queryResult = await vectorize.query(embedding, {
			topK: limit,
			namespace: 'notes',
			returnMetadata: 'none',
		});
		return (queryResult.matches ?? [])
			.filter(m => m.score >= SCORE_THRESHOLD)
			.map(m => m.id.replace('note:', ''));
	} catch (err) {
		console.error('[Embed] Semantic note search failed:', err);
		return [];
	}
}
