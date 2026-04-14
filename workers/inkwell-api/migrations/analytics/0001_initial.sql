CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  referrer TEXT,
  scroll_depth REAL,
  country TEXT,
  device TEXT,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_page_views_slug_timestamp
  ON page_views (slug, timestamp DESC);

CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  emoji TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reactions_slug_timestamp
  ON reactions (slug, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_reactions_slug_emoji
  ON reactions (slug, emoji);

CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_index (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  author TEXT,
  tags TEXT,
  description TEXT,
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_content_index_type_published_at
  ON content_index (type, published_at DESC);
