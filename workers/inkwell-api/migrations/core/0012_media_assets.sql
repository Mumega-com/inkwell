-- Migration: media_assets
-- Description: Media asset registry for R2-stored files (images, video, audio, docs)

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  tenant TEXT,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  alt_text TEXT,
  description TEXT,
  tags TEXT DEFAULT '[]',           -- JSON array of strings
  thumbhash TEXT,
  nsfw_score REAL,
  transcript TEXT,
  chapters TEXT DEFAULT '[]',       -- JSON array of {time, title}
  variants TEXT DEFAULT '{}',       -- JSON object: variant name -> URL
  graph_slug TEXT,
  source_type TEXT NOT NULL DEFAULT 'upload',  -- 'upload' | 'generate' | 'import'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_tenant ON media_assets(tenant);
CREATE INDEX IF NOT EXISTS idx_media_content_type ON media_assets(content_type);
CREATE INDEX IF NOT EXISTS idx_media_graph_slug ON media_assets(graph_slug);
CREATE INDEX IF NOT EXISTS idx_media_source_type ON media_assets(source_type);
