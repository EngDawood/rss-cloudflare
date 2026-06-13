-- Add source_type to feeds: 'rsshub' | 'rss_bridge' | 'rss_url' (null = legacy, treated as rss_url)
ALTER TABLE feeds ADD COLUMN source_type TEXT;
