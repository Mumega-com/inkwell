-- Add missing columns to existing marketing_snapshots (scheduled.ts schema)
ALTER TABLE marketing_snapshots ADD COLUMN source TEXT;
ALTER TABLE marketing_snapshots ADD COLUMN metric TEXT;
ALTER TABLE marketing_snapshots ADD COLUMN value REAL;
ALTER TABLE marketing_snapshots ADD COLUMN dimensions TEXT;
ALTER TABLE marketing_snapshots ADD COLUMN period TEXT;
ALTER TABLE marketing_snapshots ADD COLUMN fetched_at TEXT;
ALTER TABLE marketing_snapshots ADD COLUMN clicks INTEGER;
ALTER TABLE marketing_snapshots ADD COLUMN impressions INTEGER;
ALTER TABLE marketing_snapshots ADD COLUMN date TEXT;

-- GSC granular tables
CREATE TABLE IF NOT EXISTS gsc_queries (
  id            TEXT PRIMARY KEY,
  query         TEXT NOT NULL,
  clicks        INTEGER DEFAULT 0,
  impressions   INTEGER DEFAULT 0,
  ctr           REAL DEFAULT 0,
  position      REAL DEFAULT 0,
  date          TEXT NOT NULL,
  customer_slug TEXT
);

CREATE TABLE IF NOT EXISTS gsc_pages (
  id            TEXT PRIMARY KEY,
  page          TEXT NOT NULL,
  clicks        INTEGER DEFAULT 0,
  impressions   INTEGER DEFAULT 0,
  ctr           REAL DEFAULT 0,
  position      REAL DEFAULT 0,
  date          TEXT NOT NULL,
  customer_slug TEXT
);

CREATE TABLE IF NOT EXISTS gsc_daily (
  id            TEXT PRIMARY KEY,
  date          TEXT NOT NULL,
  clicks        INTEGER DEFAULT 0,
  impressions   INTEGER DEFAULT 0,
  customer_slug TEXT
);

CREATE INDEX IF NOT EXISTS idx_gsc_queries_date ON gsc_queries(date);
CREATE INDEX IF NOT EXISTS idx_gsc_pages_date ON gsc_pages(date);
CREATE INDEX IF NOT EXISTS idx_gsc_daily_date ON gsc_daily(date);
