-- CRM plugin: contacts, pipeline stages, deals, activities
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  tenant_slug TEXT NOT NULL DEFAULT 'default',
  email TEXT,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  title TEXT,
  source TEXT DEFAULT 'manual',
  stage TEXT DEFAULT 'lead',
  tags TEXT DEFAULT '[]',
  custom_fields TEXT DEFAULT '{}',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_stage ON contacts(tenant_slug, stage);

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  tenant_slug TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#6366f1',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  tenant_slug TEXT NOT NULL DEFAULT 'default',
  contact_id TEXT NOT NULL,
  title TEXT NOT NULL,
  value REAL DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  stage_id TEXT,
  status TEXT DEFAULT 'open',
  assigned_to TEXT,
  expected_close TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (stage_id) REFERENCES pipeline_stages(id)
);
CREATE INDEX IF NOT EXISTS idx_deals_tenant ON deals(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(tenant_slug, status);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  tenant_slug TEXT NOT NULL DEFAULT 'default',
  contact_id TEXT NOT NULL,
  deal_id TEXT,
  type TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  performed_by TEXT DEFAULT 'agent',
  performed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);
CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities(contact_id);
