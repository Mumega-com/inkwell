-- Crawl log — one row per bot visit
CREATE TABLE IF NOT EXISTS crawl_logs (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  bot_name TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 200,
  tenant TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_crawl_logs_bot ON crawl_logs(bot_name);
CREATE INDEX IF NOT EXISTS idx_crawl_logs_tenant_ts ON crawl_logs(tenant, timestamp);

-- Redirect rules
CREATE TABLE IF NOT EXISTS seo_redirects (
  id TEXT PRIMARY KEY,
  from_path TEXT NOT NULL,
  to_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301,
  tenant TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(from_path, tenant)
);

-- Meta overrides per path
CREATE TABLE IF NOT EXISTS seo_meta_overrides (
  path TEXT NOT NULL,
  title TEXT,
  description TEXT,
  og_image TEXT,
  robots TEXT,
  canonical TEXT,
  tenant TEXT,
  PRIMARY KEY(path, tenant)
);
