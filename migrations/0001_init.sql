-- RSS Reader MCP: D1 schema

CREATE TABLE IF NOT EXISTS feeds (
  id          TEXT PRIMARY KEY,
  url         TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL DEFAULT '',
  enabled     INTEGER NOT NULL DEFAULT 1,
  last_fetched_at INTEGER,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS items (
  feed_id     TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  id          TEXT NOT NULL,
  title       TEXT NOT NULL DEFAULT '',
  link        TEXT NOT NULL DEFAULT '',
  author      TEXT NOT NULL DEFAULT '',
  topics      TEXT NOT NULL DEFAULT '[]',   -- JSON string[]
  text        TEXT NOT NULL DEFAULT '',
  content_html TEXT,
  media       TEXT NOT NULL DEFAULT '[]',   -- JSON FeedItemMedia[]
  media_type  TEXT NOT NULL DEFAULT 'none',
  timestamp   INTEGER NOT NULL DEFAULT 0,
  read        INTEGER NOT NULL DEFAULT 0,
  fetched_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (feed_id, id)
);

CREATE INDEX IF NOT EXISTS idx_items_unread   ON items (feed_id, read);
CREATE INDEX IF NOT EXISTS idx_items_ts       ON items (feed_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
