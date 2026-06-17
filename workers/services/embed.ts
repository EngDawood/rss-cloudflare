/**
 * Vectorize + Workers AI embedding helpers.
 *
 * Uses the VECTORIZE (VectorizeIndex) and AI (Ai) bindings from Env.
 * All functions are no-ops when bindings are absent (local dev, missing setup),
 * so the worker runs safely and keyword LIKE search is used as fallback.
 */
import type { FeedItem } from '../types/feed';

const EMBEDDING_MODEL = '@cf/baai/bge-m3';
const SCORE_THRESHOLD = 0.7;
const MAX_TEXT_CHARS = 2000;

/** bge-m3 embedding output shape (the Embedding variant of the union). */
type EmbeddingOutput = { data?: number[][] };

async function getEmbeddings(ai: Ai, texts: string[]): Promise<number[][] | null> {
	const result = await ai.run(EMBEDDING_MODEL, { text: texts }) as EmbeddingOutput;
	return result.data ?? null;
}

function buildItemText(item: FeedItem): string {
	return [item.title, item.author, item.text].filter(Boolean).join('\n').slice(0, MAX_TEXT_CHARS);
}

/**
 * Embed feed items and upsert to the 'items' namespace in Vectorize.
 * Called after upsertItems in the queue handler for newly inserted items.
 */
export async function embedItems(env: Env, feedId: string, items: FeedItem[]): Promise<void> {
	if (!env.AI || !env.VECTORIZE || items.length === 0) return;
	try {
		const embeddings = await getEmbeddings(env.AI, items.map(buildItemText));
		if (!embeddings) return;
		await env.VECTORIZE.upsert(items.map((item, i) => ({
			id: `item:${item.id}`,
			values: embeddings[i],
			namespace: 'items',
			metadata: { feed_id: feedId, timestamp: item.timestamp },
		})));
	} catch (err) {
		console.error('[Embed] Failed to embed items:', err);
	}
}

/**
 * Embed a single note and upsert to the 'notes' namespace in Vectorize.
 */
export async function embedNote(env: Env, noteId: string, content: string): Promise<void> {
	if (!env.AI || !env.VECTORIZE) return;
	try {
		const embeddings = await getEmbeddings(env.AI, [content.slice(0, MAX_TEXT_CHARS)]);
		if (!embeddings) return;
		await env.VECTORIZE.upsert([{
			id: `note:${noteId}`,
			values: embeddings[0],
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
 * Returns [] when Vectorize is not configured — caller falls back to LIKE search.
 */
export async function semanticSearchItems(
	env: Env,
	query: string,
	opts?: { limit?: number; feedId?: string },
): Promise<string[]> {
	if (!env.AI || !env.VECTORIZE) return [];
	const { limit = 20, feedId } = opts ?? {};
	try {
		const embeddings = await getEmbeddings(env.AI, [query]);
		if (!embeddings) return [];
		const queryOpts: VectorizeQueryOptions = { topK: limit, namespace: 'items', returnMetadata: 'none' };
		if (feedId) queryOpts.filter = { feed_id: feedId };
		const result = await env.VECTORIZE.query(embeddings[0], queryOpts);
		return (result.matches ?? [])
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
	if (!env.AI || !env.VECTORIZE) return [];
	try {
		const embeddings = await getEmbeddings(env.AI, [query]);
		if (!embeddings) return [];
		const result = await env.VECTORIZE.query(embeddings[0], {
			topK: limit,
			namespace: 'notes',
			returnMetadata: 'none',
		});
		return (result.matches ?? [])
			.filter(m => m.score >= SCORE_THRESHOLD)
			.map(m => m.id.replace('note:', ''));
	} catch (err) {
		console.error('[Embed] Semantic note search failed:', err);
		return [];
	}
}
