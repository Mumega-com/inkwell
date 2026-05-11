-- Agent claiming support for bounties
-- Adds explicit agent assignee metadata for databases that already applied 0018.

ALTER TABLE bounties ADD COLUMN agent_id TEXT;
ALTER TABLE bounties ADD COLUMN assignee_type TEXT NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS idx_bounties_claimant ON bounties(customer_slug, claimant_id);
CREATE INDEX IF NOT EXISTS idx_bounties_agent ON bounties(customer_slug, agent_id);
