import { genId } from './base';

// ── Agent workflows ──────────────────────────────────────────────────────────

export interface DbAgentWorkflow {
	id: string;
	name: string;
	ai_model: string;
	system_prompt: string;
	temperature: number;
	max_turns: number;
	enabled_tools: string;          // JSON string[]
	trigger_type: string;           // 'rss_batch' | 'cron' | 'manual'
	batch_size: number;
	target_chat_id: string | null;
	target_chat_name: string | null;
	enabled: number;
	created_at: number;
}

export interface DbAgentWorkflowWithFeeds extends DbAgentWorkflow {
	feed_ids: string[];
}

export interface DbWorkflowRun {
	id: string;
	workflow_id: string;
	status: string;
	trigger: string | null;
	items_count: number;
	output: string | null;
	error: string | null;
	started_at: number;
	finished_at: number | null;
}

export interface DbWorkflowRunEvent {
	id: number;
	run_id: string;
	seq: number;
	type: string;
	step_name: string | null;
	detail: string | null;
	created_at: number;
}

export interface WorkflowInput {
	name: string;
	aiModel: string;
	systemPrompt: string;
	temperature?: number;
	maxTurns?: number;
	enabledTools: string[];
	triggerType: string;
	batchSize?: number;
	targetChatId?: string | null;
	targetChatName?: string | null;
	enabled?: boolean;
}

export async function createWorkflow(db: D1Database, input: WorkflowInput): Promise<DbAgentWorkflow> {
	const id = genId();
	const now = Math.floor(Date.now() / 1000);
	const row: DbAgentWorkflow = {
		id,
		name: input.name,
		ai_model: input.aiModel,
		system_prompt: input.systemPrompt,
		temperature: input.temperature ?? 0.7,
		max_turns: input.maxTurns ?? 5,
		enabled_tools: JSON.stringify(input.enabledTools ?? []),
		trigger_type: input.triggerType,
		batch_size: input.batchSize ?? 1,
		target_chat_id: input.targetChatId ?? null,
		target_chat_name: input.targetChatName ?? null,
		enabled: input.enabled === false ? 0 : 1,
		created_at: now,
	};
	await db.prepare(
		`INSERT INTO agent_workflows
			(id, name, ai_model, system_prompt, temperature, max_turns, enabled_tools, trigger_type, batch_size, target_chat_id, target_chat_name, enabled, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).bind(
		row.id, row.name, row.ai_model, row.system_prompt, row.temperature, row.max_turns,
		row.enabled_tools, row.trigger_type, row.batch_size, row.target_chat_id, row.target_chat_name,
		row.enabled, row.created_at,
	).run();
	return row;
}

export async function updateWorkflow(db: D1Database, id: string, input: WorkflowInput): Promise<void> {
	await db.prepare(
		`UPDATE agent_workflows SET
			name = ?, ai_model = ?, system_prompt = ?, temperature = ?, max_turns = ?,
			enabled_tools = ?, trigger_type = ?, batch_size = ?, target_chat_id = ?, target_chat_name = ?, enabled = ?
		 WHERE id = ?`,
	).bind(
		input.name, input.aiModel, input.systemPrompt, input.temperature ?? 0.7, input.maxTurns ?? 5,
		JSON.stringify(input.enabledTools ?? []), input.triggerType, input.batchSize ?? 1,
		input.targetChatId ?? null, input.targetChatName ?? null, input.enabled === false ? 0 : 1,
		id,
	).run();
}

export async function listWorkflows(db: D1Database): Promise<DbAgentWorkflowWithFeeds[]> {
	const result = await db.prepare('SELECT * FROM agent_workflows ORDER BY created_at DESC').all<DbAgentWorkflow>();
	const feeds = await db.prepare('SELECT workflow_id, feed_id FROM workflow_feeds').all<{ workflow_id: string; feed_id: string }>();
	const byWorkflow = new Map<string, string[]>();
	for (const f of feeds.results) {
		const list = byWorkflow.get(f.workflow_id) ?? [];
		list.push(f.feed_id);
		byWorkflow.set(f.workflow_id, list);
	}
	return result.results.map(w => ({ ...w, feed_ids: byWorkflow.get(w.id) ?? [] }));
}

export async function getWorkflow(db: D1Database, id: string): Promise<DbAgentWorkflowWithFeeds | null> {
	const row = await db.prepare('SELECT * FROM agent_workflows WHERE id = ?').bind(id).first<DbAgentWorkflow>();
	if (!row) return null;
	const feedIds = await getWorkflowFeeds(db, id);
	return { ...row, feed_ids: feedIds };
}

export async function deleteWorkflow(db: D1Database, id: string): Promise<void> {
	await db.batch([
		db.prepare('DELETE FROM workflow_feeds WHERE workflow_id = ?').bind(id),
		db.prepare('DELETE FROM agent_workflows WHERE id = ?').bind(id),
	]);
}

export async function getWorkflowFeeds(db: D1Database, workflowId: string): Promise<string[]> {
	const result = await db.prepare('SELECT feed_id FROM workflow_feeds WHERE workflow_id = ?')
		.bind(workflowId).all<{ feed_id: string }>();
	return result.results.map(r => r.feed_id);
}

export async function setWorkflowFeeds(db: D1Database, workflowId: string, feedIds: string[]): Promise<void> {
	const stmts: D1PreparedStatement[] = [
		db.prepare('DELETE FROM workflow_feeds WHERE workflow_id = ?').bind(workflowId),
	];
	for (const feedId of feedIds) {
		stmts.push(
			db.prepare('INSERT OR IGNORE INTO workflow_feeds (workflow_id, feed_id) VALUES (?, ?)').bind(workflowId, feedId),
		);
	}
	await db.batch(stmts);
}

export async function getWorkflowsForFeed(db: D1Database, feedId: string): Promise<DbAgentWorkflow[]> {
	const result = await db.prepare(
		`SELECT w.* FROM agent_workflows w
		 JOIN workflow_feeds wf ON wf.workflow_id = w.id
		 WHERE wf.feed_id = ? AND w.trigger_type = 'rss_batch' AND w.enabled = 1`,
	).bind(feedId).all<DbAgentWorkflow>();
	return result.results;
}

export async function getCronWorkflows(db: D1Database): Promise<DbAgentWorkflow[]> {
	const result = await db.prepare(
		`SELECT * FROM agent_workflows WHERE trigger_type = 'cron' AND enabled = 1 ORDER BY created_at ASC`,
	).all<DbAgentWorkflow>();
	return result.results;
}

// ── Workflow runs ──────────────────────────────────────────────────────────────

export async function createRun(
	db: D1Database,
	opts: { id: string; workflowId: string; trigger?: string; itemsCount?: number; status?: string },
): Promise<void> {
	const now = Math.floor(Date.now() / 1000);
	await db.prepare(
		`INSERT INTO workflow_runs (id, workflow_id, status, trigger, items_count, started_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
	).bind(
		opts.id, opts.workflowId, opts.status ?? 'queued', opts.trigger ?? null, opts.itemsCount ?? 0, now,
	).run();
}

export async function setRunStatus(
	db: D1Database,
	runId: string,
	status: string,
	opts?: { output?: string | null; error?: string | null; finishedAt?: number },
): Promise<void> {
	const sets: string[] = ['status = ?'];
	const params: unknown[] = [status];
	if (opts && 'output' in opts) { sets.push('output = ?'); params.push(opts.output ?? null); }
	if (opts && 'error' in opts) { sets.push('error = ?'); params.push(opts.error ?? null); }
	if (opts?.finishedAt !== undefined) { sets.push('finished_at = ?'); params.push(opts.finishedAt); }
	params.push(runId);
	await db.prepare(`UPDATE workflow_runs SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run();
}

export async function listRuns(db: D1Database, workflowId: string, limit = 50): Promise<DbWorkflowRun[]> {
	const result = await db.prepare(
		'SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?',
	).bind(workflowId, limit).all<DbWorkflowRun>();
	return result.results;
}

export async function getRun(db: D1Database, runId: string): Promise<DbWorkflowRun | null> {
	return db.prepare('SELECT * FROM workflow_runs WHERE id = ?').bind(runId).first<DbWorkflowRun>();
}

export async function appendRunEvent(
	db: D1Database,
	runId: string,
	seq: number,
	type: string,
	stepName: string | null,
	detail: unknown,
): Promise<void> {
	await db.prepare(
		'INSERT INTO workflow_run_events (run_id, seq, type, step_name, detail) VALUES (?, ?, ?, ?, ?)',
	).bind(
		runId, seq, type, stepName,
		detail === undefined || detail === null ? null : JSON.stringify(detail),
	).run();
}

export async function getRunEvents(db: D1Database, runId: string): Promise<DbWorkflowRunEvent[]> {
	const result = await db.prepare(
		'SELECT * FROM workflow_run_events WHERE run_id = ? ORDER BY seq ASC',
	).bind(runId).all<DbWorkflowRunEvent>();
	return result.results;
}
