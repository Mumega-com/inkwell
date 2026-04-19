-- Generic event stream — append-only, one row per tracked event
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,        -- 'CTA Clicked', 'Form Started', 'Search Performed'
  properties TEXT,                  -- JSON: flexible event-specific data
  path TEXT NOT NULL,               -- page URL path where event fired
  visitor_hash TEXT NOT NULL,       -- SHA-256 hash (anonymous)
  session_id TEXT,                  -- consistent per-session identifier
  tenant TEXT,
  -- UTM attribution (captured at event time)
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  -- Context
  referrer TEXT,
  country TEXT,
  device TEXT,                      -- 'mobile' | 'desktop'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_visitor ON events(visitor_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_utm ON events(utm_source, utm_campaign);

-- Visitor profiles — unified first-party identity
CREATE TABLE IF NOT EXISTS visitor_profiles (
  visitor_hash TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  visit_count INTEGER NOT NULL DEFAULT 1,
  -- UTM attribution (first-touch and last-touch)
  utm_first_source TEXT,
  utm_first_medium TEXT,
  utm_first_campaign TEXT,
  utm_last_source TEXT,
  utm_last_medium TEXT,
  utm_last_campaign TEXT,
  -- Identity stitching (linked on auth)
  portal_account_id TEXT,           -- linked when user logs in
  email TEXT,                       -- set on auth, enables subscriber matching
  -- Behavioral
  total_events INTEGER NOT NULL DEFAULT 0,
  total_page_views INTEGER NOT NULL DEFAULT 0,
  last_event_name TEXT,
  last_path TEXT,
  country TEXT,
  device TEXT,
  tenant TEXT,
  properties TEXT                   -- JSON: flexible profile properties
);
CREATE INDEX IF NOT EXISTS idx_visitor_profiles_account ON visitor_profiles(portal_account_id);
CREATE INDEX IF NOT EXISTS idx_visitor_profiles_tenant ON visitor_profiles(tenant, last_seen DESC);

-- Daily event aggregates — rebuilt by flywheel
CREATE TABLE IF NOT EXISTS event_aggregates (
  date TEXT NOT NULL,
  event_name TEXT NOT NULL,
  tenant TEXT,
  count INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(date, event_name, tenant)
);
