-- Migration to create the agent_workflows table for dynamic workflows and agent configuration
CREATE TABLE agent_workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    feed_id TEXT, -- Optional: trigger only for a specific RSS feed
    ai_model TEXT NOT NULL, -- e.g., @cf/meta/llama-3.1-70b-instruct
    system_prompt TEXT NOT NULL, -- The custom instructions / "skill"
    enabled_tools TEXT NOT NULL, -- JSON array: e.g., '["telegram", "emdash"]'
    trigger_type TEXT NOT NULL, -- 'rss_batch', 'cron', 'manual'
    batch_size INTEGER DEFAULT 1, -- e.g., trigger every 5 items
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
