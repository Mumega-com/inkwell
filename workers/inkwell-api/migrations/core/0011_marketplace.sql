-- Tenant plugin installations (v7.0 marketplace)
CREATE TABLE IF NOT EXISTS tenant_plugins (
  tenant_id TEXT NOT NULL,
  plugin_slug TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  installed_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, plugin_slug)
);

CREATE INDEX IF NOT EXISTS idx_tenant_plugins_tenant ON tenant_plugins(tenant_id);
