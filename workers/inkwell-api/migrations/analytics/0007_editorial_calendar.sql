-- Editorial calendar columns on content_index
-- Extends the existing table with scheduling, workflow, and planning fields.

ALTER TABLE content_index ADD COLUMN status TEXT NOT NULL DEFAULT 'published';
ALTER TABLE content_index ADD COLUMN scheduled_at TEXT;
ALTER TABLE content_index ADD COLUMN channel TEXT NOT NULL DEFAULT 'blog';
ALTER TABLE content_index ADD COLUMN campaign_id TEXT;
ALTER TABLE content_index ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE content_index ADD COLUMN seo_keyword TEXT;
ALTER TABLE content_index ADD COLUMN assignee TEXT;

CREATE INDEX IF NOT EXISTS idx_content_index_status ON content_index (status);
CREATE INDEX IF NOT EXISTS idx_content_index_scheduled ON content_index (scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_index_campaign ON content_index (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_index_channel ON content_index (channel);
