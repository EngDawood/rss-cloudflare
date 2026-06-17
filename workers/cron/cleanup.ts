/**
 * Scheduled data-retention sweep.
 * Triggered daily at 03:00 UTC (cron "0 3 * * *").
 *
 * Thresholds are configurable via the config table:
 *   cleanup_post_log_days  (default 90)
 *   cleanup_items_days     (default 30  — only already-read items are pruned)
 *   cleanup_runs_days      (default 30  — workflow_runs + their events)
 */

export interface CleanupResult {
	deletedPostLog: number;
	deletedItems: number;
	deletedRunEvents: number;
	deletedRuns: number;
}

export async function cleanupOldData(env: Env): Promise<CleanupResult> {
	const db = env.DB;
	const now = Math.floor(Date.now() / 1000);

	// Load configurable thresholds (silently fall through to defaults on error).
	const [plRow, itemsRow, runsRow] = await Promise.all([
		db.prepare("SELECT value FROM config WHERE key = 'cleanup_post_log_days'").first<{ value: string }>(),
		db.prepare("SELECT value FROM config WHERE key = 'cleanup_items_days'").first<{ value: string }>(),
		db.prepare("SELECT value FROM config WHERE key = 'cleanup_runs_days'").first<{ value: string }>(),
	]);

	const postLogDays    = parseInt(plRow?.value    ?? '') || 90;
	const readItemsDays  = parseInt(itemsRow?.value ?? '') || 30;
	const workflowDays   = parseInt(runsRow?.value  ?? '') || 30;

	const postLogCutoff  = now - postLogDays   * 86400;
	const itemsCutoff    = now - readItemsDays * 86400;
	const runsCutoff     = now - workflowDays  * 86400;

	// Run deletes concurrently; each is independent.
	const [plResult, itemsResult, eventsResult, runsResult] = await Promise.all([
		db.prepare('DELETE FROM post_log WHERE posted_at < ?').bind(postLogCutoff).run(),
		db.prepare('DELETE FROM items WHERE read = 1 AND fetched_at < ?').bind(itemsCutoff).run(),
		// Events must be deleted before their parent run rows (FK-style ordering).
		db.prepare(
			'DELETE FROM workflow_run_events WHERE run_id IN (SELECT id FROM workflow_runs WHERE finished_at IS NOT NULL AND finished_at < ?)',
		).bind(runsCutoff).run(),
		db.prepare(
			'DELETE FROM workflow_runs WHERE finished_at IS NOT NULL AND finished_at < ?',
		).bind(runsCutoff).run(),
	]);

	const result: CleanupResult = {
		deletedPostLog:   plResult.meta.rows_written,
		deletedItems:     itemsResult.meta.rows_written,
		deletedRunEvents: eventsResult.meta.rows_written,
		deletedRuns:      runsResult.meta.rows_written,
	};

	const total = result.deletedPostLog + result.deletedItems + result.deletedRunEvents + result.deletedRuns;
	console.log(`[Cleanup] Pruned ${total} rows (post_log=${result.deletedPostLog}, items=${result.deletedItems}, run_events=${result.deletedRunEvents}, runs=${result.deletedRuns})`);

	return result;
}
