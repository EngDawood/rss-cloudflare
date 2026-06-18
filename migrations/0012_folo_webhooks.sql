-- Folo multi-webhook support
-- Adds named webhook instances alongside the existing legacy /folo endpoint (env secret).
-- Legacy folo_channels table is unchanged — new per-webhook subscriptions go in folo_webhook_channels.

CREATE TABLE IF NOT EXISTS folo_webhooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Per-webhook channel subscriptions (one channel can subscribe to multiple webhooks)
CREATE TABLE IF NOT EXISTS folo_webhook_channels (
  channel_id TEXT NOT NULL,
  webhook_id TEXT NOT NULL REFERENCES folo_webhooks(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (channel_id, webhook_id)
);
