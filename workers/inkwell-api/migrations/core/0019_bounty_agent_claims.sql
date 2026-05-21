-- Add agent-aware bounty claims for existing bounty tables

ALTER TABLE bounties ADD COLUMN agent_id TEXT;
ALTER TABLE bounties ADD COLUMN assignee_type TEXT NOT NULL DEFAULT 'user';
