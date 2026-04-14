CREATE TABLE IF NOT EXISTS connector_accounts (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL,
  connector_type TEXT NOT NULL,
  external_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  config_json TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connector_accounts_unique
  ON connector_accounts (customer_slug, connector_type, COALESCE(external_account_id, 'default'));

CREATE TABLE IF NOT EXISTS connector_runs (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL,
  connector_type TEXT NOT NULL,
  connector_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TEXT NOT NULL,
  finished_at TEXT,
  records_written INTEGER NOT NULL DEFAULT 0,
  cursor_json TEXT,
  error_message TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (connector_account_id) REFERENCES connector_accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_connector_runs_customer_type
  ON connector_runs (customer_slug, connector_type, started_at DESC);

CREATE TABLE IF NOT EXISTS marketing_snapshots (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL,
  connector_type TEXT NOT NULL,
  metric_scope TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  dimension_key TEXT,
  dimension_value TEXT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  value_numeric REAL,
  value_text TEXT,
  payload_json TEXT,
  observed_at TEXT NOT NULL,
  connector_run_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (connector_run_id) REFERENCES connector_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_marketing_snapshots_customer_metric_period
  ON marketing_snapshots (customer_slug, connector_type, metric_scope, metric_name, period_start DESC);

CREATE TABLE IF NOT EXISTS marketing_rollups (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL,
  rollup_name TEXT NOT NULL,
  period_granularity TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  value_numeric REAL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_rollups_unique
  ON marketing_rollups (customer_slug, rollup_name, period_granularity, period_start, period_end);

CREATE TABLE IF NOT EXISTS lead_events (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL,
  source_connector TEXT NOT NULL,
  external_contact_id TEXT,
  external_opportunity_id TEXT,
  pipeline_name TEXT,
  stage_name TEXT,
  event_type TEXT NOT NULL,
  event_at TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_events_customer_event_at
  ON lead_events (customer_slug, event_at DESC);

CREATE TABLE IF NOT EXISTS content_performance_snapshots (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL,
  content_key TEXT NOT NULL,
  content_url TEXT,
  source_connector TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  impressions REAL,
  clicks REAL,
  conversions REAL,
  spend REAL,
  ctr REAL,
  avg_position REAL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_performance_customer_key_period
  ON content_performance_snapshots (customer_slug, content_key, period_start DESC);
