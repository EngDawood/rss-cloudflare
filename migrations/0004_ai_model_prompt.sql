-- AI model and custom prompt overrides at channel and source level

ALTER TABLE channel_ai_settings ADD COLUMN ai_model TEXT;
ALTER TABLE channel_ai_settings ADD COLUMN ai_prompt TEXT;
