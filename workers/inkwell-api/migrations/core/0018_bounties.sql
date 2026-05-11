-- Bounty plugin schema
-- Plugin: bounty v1.0.0

CREATE TABLE IF NOT EXISTS bounties (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reward_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'open',
  creator_id TEXT NOT NULL,
  claimant_id TEXT,
  agent_id TEXT,
  assignee_type TEXT NOT NULL DEFAULT 'user',
  proof_url TEXT,
  squad_id TEXT,
  labels_json TEXT DEFAULT '[]',
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bounties_tenant ON bounties(customer_slug);
CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(customer_slug, status);
CREATE INDEX IF NOT EXISTS idx_bounties_claimant ON bounties(customer_slug, claimant_id);
CREATE INDEX IF NOT EXISTS idx_bounties_agent ON bounties(customer_slug, agent_id);
