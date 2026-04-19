-- Outreach sequences and steps for CRM outreach campaigns
CREATE TABLE IF NOT EXISTS outreach_sequences (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  tenant_slug TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  channel TEXT DEFAULT 'email',
  status TEXT DEFAULT 'draft',
  template TEXT,
  n8n_webhook_url TEXT,
  contact_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_outreach_seq_tenant ON outreach_sequences(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_outreach_seq_status ON outreach_sequences(tenant_slug, status);

CREATE TABLE IF NOT EXISTS outreach_steps (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  sequence_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  scheduled_at TEXT,
  sent_at TEXT,
  opened_at TEXT,
  replied_at TEXT,
  FOREIGN KEY (sequence_id) REFERENCES outreach_sequences(id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);
CREATE INDEX IF NOT EXISTS idx_outreach_steps_seq ON outreach_steps(sequence_id);
CREATE INDEX IF NOT EXISTS idx_outreach_steps_contact ON outreach_steps(contact_id);
CREATE INDEX IF NOT EXISTS idx_outreach_steps_status ON outreach_steps(sequence_id, status);
