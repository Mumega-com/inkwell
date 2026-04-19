-- Per-tenant MCP tokens for multi-user deployments
CREATE TABLE IF NOT EXISTS mcp_tokens (
  token TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'default',
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_mcp_tokens_tenant ON mcp_tokens(tenant_slug);
