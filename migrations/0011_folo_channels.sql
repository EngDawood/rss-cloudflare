-- Folo webhook channel subscriptions (replaces KV key `folo:channels`)
-- Stores which Telegram chat IDs receive pushes from the /folo webhook endpoint.
CREATE TABLE IF NOT EXISTS folo_channels (
  channel_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
