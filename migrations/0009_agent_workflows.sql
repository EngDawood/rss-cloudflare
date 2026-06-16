-- Migration 0009: Dynamic agent workflows
-- User-defined AI agents that watch RSS feeds, run an LLM with custom
-- instructions + tools (Telegram, Emdash CMS), and post results durably via
-- Cloudflare Workflows.
--
-- Slot 0008 is occupied by another branch; this work uses 0009. An abandoned
-- `feat/add-workflow` branch created an `agent_workflows` table on a LOCAL D1
-- only. Before applying remotely, confirm `agent_workflows` doesn't already
-- exist; for local dev, drop the stale table or recreate the local D1.

CREATE TABLE IF NOT EXISTS agent_workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ai_model TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  temperature REAL DEFAULT 0.7,
  max_turns INTEGER DEFAULT 5,
  enabled_tools TEXT NOT NULL,        -- JSON string[]
  trigger_type TEXT NOT NULL,         -- 'rss_batch' | 'cron' | 'manual'
  batch_size INTEGER DEFAULT 1,
  target_chat_id TEXT,                -- bound Telegram destination (raw id)
  target_chat_name TEXT,              -- display label if chosen from chats
  enabled INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS workflow_feeds (         -- many feeds per workflow
  workflow_id TEXT NOT NULL,
  feed_id TEXT NOT NULL,
  PRIMARY KEY (workflow_id, feed_id)
);
CREATE INDEX IF NOT EXISTS idx_workflow_feeds_feed ON workflow_feeds(feed_id);

CREATE TABLE IF NOT EXISTS workflow_runs (          -- one row per instance (enumerable; CF has no list API)
  id TEXT PRIMARY KEY,                -- = CF instance id
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL,               -- queued|running|complete|errored|terminated
  trigger TEXT,
  items_count INTEGER DEFAULT 0,
  output TEXT,
  error TEXT,
  started_at INTEGER DEFAULT (unixepoch()),
  finished_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_wf ON workflow_runs(workflow_id, started_at DESC);

CREATE TABLE IF NOT EXISTS workflow_run_events (    -- step/tool timeline, written by the workflow
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,                 -- 'llm_turn' | 'tool_call' | 'output' | 'error'
  step_name TEXT,
  detail TEXT,                        -- JSON: args/result/content preview
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_workflow_run_events_run ON workflow_run_events(run_id, seq);
