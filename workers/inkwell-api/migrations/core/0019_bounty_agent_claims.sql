-- Bounty agent claims
-- Adds explicit agent assignment metadata for token-authenticated workers.

ALTER TABLE bounties ADD COLUMN agent_id TEXT;
ALTER TABLE bounties ADD COLUMN assignee_type TEXT;

CREATE INDEX IF NOT EXISTS idx_bounties_agent
  ON bounties(customer_slug, agent_id);

