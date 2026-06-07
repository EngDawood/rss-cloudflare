-- AI Summary: add summary storage, per-feed and per-channel settings

-- Store AI-generated summary alongside each item
ALTER TABLE items ADD COLUMN summary TEXT;

-- Per-feed AI summary setting (for MCP-registered feeds)
ALTER TABLE feeds ADD COLUMN ai_summary TEXT NOT NULL DEFAULT 'inherit';

-- Per-channel and per-source AI summary settings
-- channel_id can be:
--   "{channelId}"           → channel-level setting
--   "{channelId}:{sourceId}" → source-level override
CREATE TABLE IF NOT EXISTS channel_ai_settings (
  channel_id TEXT PRIMARY KEY,
  ai_summary TEXT NOT NULL DEFAULT 'inherit',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
