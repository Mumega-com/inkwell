-- Agent-capable bounty claims
-- Adds explicit agent assignment fields and lookup indexes.

ALTER TABLE bounties ADD COLUMN agent_id TEXT;
ALTER TABLE bounties ADD COLUMN assignee_type TEXT;

CREATE INDEX IF NOT EXISTS idx_bounties_squad ON bounties(customer_slug, squad_id);
CREATE INDEX IF NOT EXISTS idx_bounties_agent ON bounties(customer_slug, agent_id);
