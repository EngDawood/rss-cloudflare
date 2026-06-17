-- Per-feed health tracking: error log, last success timestamp, consecutive failure counter
ALTER TABLE feeds ADD COLUMN last_error TEXT DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN last_success_at INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_feeds_degraded ON feeds(consecutive_failures) WHERE consecutive_failures > 0;
