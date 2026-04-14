CREATE TABLE IF NOT EXISTS auth_identities (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL,
  channel TEXT NOT NULL,
  contact_value TEXT NOT NULL,
  contact_normalized TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  verified_at TEXT,
  last_login_at TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_channel_contact
  ON auth_identities (customer_slug, channel, contact_normalized);

CREATE TABLE IF NOT EXISTS auth_login_codes (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  customer_slug TEXT NOT NULL,
  delivery_channel TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued',
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (identity_id) REFERENCES auth_identities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_login_codes_identity
  ON auth_login_codes (identity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_login_codes_status_expires
  ON auth_login_codes (status, expires_at);

CREATE TABLE IF NOT EXISTS portal_accounts (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL,
  identity_id TEXT,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (identity_id) REFERENCES auth_identities(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_accounts_customer
  ON portal_accounts (customer_slug, created_at DESC);

CREATE TABLE IF NOT EXISTS quote_requests (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL,
  portal_account_id TEXT,
  origin_country TEXT NOT NULL,
  destination_country TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  transport_mode TEXT,
  estimated_low INTEGER,
  estimated_high INTEGER,
  transit_time_label TEXT,
  import_duties_label TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  ghl_contact_id TEXT,
  ghl_opportunity_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portal_account_id) REFERENCES portal_accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quote_requests_customer_status
  ON quote_requests (customer_slug, status, created_at DESC);

CREATE TABLE IF NOT EXISTS shipment_timelines (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL,
  portal_account_id TEXT,
  quote_request_id TEXT,
  current_step_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  external_reference TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portal_account_id) REFERENCES portal_accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (quote_request_id) REFERENCES quote_requests(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_shipment_timelines_customer_status
  ON shipment_timelines (customer_slug, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS shipment_timeline_events (
  id TEXT PRIMARY KEY,
  timeline_id TEXT NOT NULL,
  step_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  occurred_at TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (timeline_id) REFERENCES shipment_timelines(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shipment_timeline_events_timeline
  ON shipment_timeline_events (timeline_id, sort_order, occurred_at);

CREATE TABLE IF NOT EXISTS document_checklists (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL,
  portal_account_id TEXT,
  destination_country TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portal_account_id) REFERENCES portal_accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_document_checklists_customer
  ON document_checklists (customer_slug, updated_at DESC);

CREATE TABLE IF NOT EXISTS document_checklist_items (
  id TEXT PRIMARY KEY,
  checklist_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  help_text TEXT,
  is_required INTEGER NOT NULL DEFAULT 1,
  is_completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (checklist_id) REFERENCES document_checklists(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_checklist_items_unique
  ON document_checklist_items (checklist_id, item_key);
