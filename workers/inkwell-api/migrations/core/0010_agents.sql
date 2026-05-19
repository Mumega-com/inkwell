-- Agent configuration per tenant (v6.2)
CREATE TABLE IF NOT EXISTS agent_configs (
  tenant_id TEXT PRIMARY KEY,
  model TEXT NOT NULL DEFAULT 'haiku',
  system_prompt TEXT NOT NULL DEFAULT '',
  mcp_servers TEXT NOT NULL DEFAULT '[]',
  tools TEXT NOT NULL DEFAULT '[]',
  budget_per_day INTEGER NOT NULL DEFAULT 500,
  budget_per_month INTEGER NOT NULL DEFAULT 10000,
  status TEXT NOT NULL DEFAULT 'provisioning',
  anthropic_agent_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Agent usage tracking for budget enforcement
CREATE TABLE IF NOT EXISTS agent_usage (
  tenant_id TEXT NOT NULL,
  date TEXT NOT NULL,
  session_hours REAL NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, date)
);

CREATE INDEX IF NOT EXISTS idx_agent_usage_tenant ON agent_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_usage_date ON agent_usage(date);
