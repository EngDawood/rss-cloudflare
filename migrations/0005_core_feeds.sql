-- 0005 — Core feeds + typed consumers
--
-- One core `feeds` table keyed by (source_type, source_value) feeds many typed
-- consumers. `rss_url` is just one SourceType — this generalizes today's
-- `feeds.url`. `items` and `post_log` are unchanged (only a new index is added).
--
-- Telegram consumer  : channels + telegram_subscriptions (moved off KV)
-- MCP consumer        : mcp_subscriptions (MCP browse tools scope through this)

-- ── Reshape feeds: drop the url UNIQUE, add identity columns ──────────────────
-- SQLite table-rebuild. ai_summary (0003) is preserved; check_interval_minutes
-- is new. Item rows keep referencing feeds(id) — ids are carried over unchanged.
PRAGMA foreign_keys=OFF;

CREATE TABLE feeds_new (
  id            TEXT PRIMARY KEY,
  source_type   TEXT NOT NULL DEFAULT 'rss_url',   -- SourceType
  source_value  TEXT NOT NULL,                     -- URL for rss_url; username for instagram_user; etc.
  title         TEXT NOT NULL DEFAULT '',
  enabled       INTEGER NOT NULL DEFAULT 1,
  check_interval_minutes INTEGER NOT NULL DEFAULT 60,
  last_fetched_at INTEGER,
  ai_summary    TEXT NOT NULL DEFAULT 'inherit',
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO feeds_new (id, source_type, source_value, title, enabled, last_fetched_at, ai_summary, created_at)
  SELECT id, 'rss_url', url, title, enabled, last_fetched_at, ai_summary, created_at FROM feeds;

DROP TABLE feeds;
ALTER TABLE feeds_new RENAME TO feeds;

CREATE UNIQUE INDEX idx_feeds_source ON feeds (source_type, source_value);

PRAGMA foreign_keys=ON;

-- ── post_log: index for the per-channel dedup lookup (chat_id + item_id) ──────
CREATE INDEX IF NOT EXISTS idx_postlog_chat_item ON post_log (chat_id, item_id);

-- ── Telegram consumer ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channels (
  id                     TEXT PRIMARY KEY,           -- numeric Telegram chat id (as text)
  name                   TEXT NOT NULL DEFAULT '',
  enabled                INTEGER NOT NULL DEFAULT 1,
  check_interval_minutes INTEGER NOT NULL DEFAULT 60,
  default_format         TEXT,                       -- JSON Partial<FormatSettings>
  last_check_timestamp   INTEGER NOT NULL DEFAULT 0,
  created_at             INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS telegram_subscriptions (
  id           TEXT PRIMARY KEY,
  feed_id      TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  channel_id   TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  media_filter TEXT NOT NULL DEFAULT 'all',
  format       TEXT,                                 -- JSON Partial<FormatSettings>
  enabled      INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(channel_id, feed_id)
);

CREATE INDEX IF NOT EXISTS idx_tgsub_channel ON telegram_subscriptions(channel_id);
CREATE INDEX IF NOT EXISTS idx_tgsub_feed    ON telegram_subscriptions(feed_id);

-- ── MCP consumer ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mcp_subscriptions (
  id         TEXT PRIMARY KEY,
  feed_id    TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  label      TEXT,
  enabled    INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(feed_id)
);

CREATE INDEX IF NOT EXISTS idx_mcpsub_feed ON mcp_subscriptions(feed_id);
