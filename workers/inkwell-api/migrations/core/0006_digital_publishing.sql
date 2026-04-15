CREATE TABLE IF NOT EXISTS publishing_products (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL,
  product_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  access_model TEXT NOT NULL DEFAULT 'one_time',
  status TEXT NOT NULL DEFAULT 'draft',
  stripe_price_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_publishing_products_customer_key
  ON publishing_products (customer_slug, product_key);

CREATE TABLE IF NOT EXISTS publishing_resources (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL,
  external_id TEXT NOT NULL,
  parent_external_id TEXT,
  source_system TEXT NOT NULL DEFAULT 'shabrang',
  resource_type TEXT NOT NULL DEFAULT 'chapter',
  title TEXT NOT NULL,
  slug TEXT,
  visibility TEXT NOT NULL DEFAULT 'members_only',
  release_at TEXT,
  preview_url TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_publishing_resources_customer_external
  ON publishing_resources (customer_slug, external_id);

CREATE INDEX IF NOT EXISTS idx_publishing_resources_customer_visibility
  ON publishing_resources (customer_slug, visibility, release_at);

CREATE TABLE IF NOT EXISTS access_grants (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL,
  portal_account_id TEXT NOT NULL,
  product_id TEXT,
  resource_external_id TEXT,
  grant_type TEXT NOT NULL DEFAULT 'purchase',
  status TEXT NOT NULL DEFAULT 'active',
  granted_at TEXT NOT NULL,
  expires_at TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portal_account_id) REFERENCES portal_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES publishing_products(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_access_grants_account_status
  ON access_grants (customer_slug, portal_account_id, status, granted_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_grants_resource
  ON access_grants (customer_slug, resource_external_id, status, expires_at);

CREATE TABLE IF NOT EXISTS reading_progress (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL,
  portal_account_id TEXT NOT NULL,
  resource_external_id TEXT NOT NULL,
  progress_percent REAL NOT NULL DEFAULT 0,
  last_position TEXT,
  last_read_at TEXT NOT NULL,
  completed_at TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portal_account_id) REFERENCES portal_accounts(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reading_progress_unique
  ON reading_progress (customer_slug, portal_account_id, resource_external_id);

CREATE TABLE IF NOT EXISTS notification_events (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL,
  portal_account_id TEXT,
  event_type TEXT NOT NULL,
  resource_external_id TEXT,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata_json TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portal_account_id) REFERENCES portal_accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_events_customer_status
  ON notification_events (customer_slug, status, created_at DESC);
