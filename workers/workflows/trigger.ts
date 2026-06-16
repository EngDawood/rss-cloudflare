import {
	createRun, listNewItems, getCronWorkflows, getWorkflowFeeds,
	type DbAgentWorkflow, type DbItemCompact,
} from '../db/d1';

/** Generate a Cloudflare Workflow instance id (≤100 chars). Used as the run id. */
export function genRunId(): string {
	return `run_${crypto.randomUUID().replace(/-/g, '')}`;
}

/**
 * Create a run row and launch a durable workflow instance with id = runId.
 * Shared by the action API (manual), the queue handler (rss_batch) and the
 * scheduled handler (cron).
 */
export async function launchWorkflowRun(
	env: Env,
	workflow: Pick<DbAgentWorkflow, 'id'>,
	items: DbItemCompact[],
	trigger: string,
): Promise<string> {
	const runId = genRunId();
	await createRun(env.DB, {
		id: runId,
		workflowId: workflow.id,
		trigger,
		itemsCount: items.length,
		status: 'queued',
	});
	await env.AGENT_WORKFLOW.create({
		id: runId,
		params: { workflowId: workflow.id, runId, items, trigger },
	});
	return runId;
}

/**
 * Fire all enabled cron-triggered workflows. Each gathers the latest items from
 * its watched feeds (up to batchSize, default 5). Called from the scheduled handler.
 */
export async function checkCronWorkflows(env: Env): Promise<void> {
	const workflows = await getCronWorkflows(env.DB);
	for (const wf of workflows) {
		try {
			const feedIds = await getWorkflowFeeds(env.DB, wf.id);
			const items = feedIds.length
				? await listNewItems(env.DB, { feedId: feedIds, limit: wf.batch_size || 5, unreadOnly: false })
				: [];
			await launchWorkflowRun(env, wf, items, 'cron');
		} catch (err) {
			console.error(`[Workflow Cron] Failed to launch workflow ${wf.id}:`, err);
		}
	}
}
