-- API usage tracking for SaaS billing
CREATE TABLE IF NOT EXISTS api_usage (
  tenant_slug TEXT NOT NULL,
  date TEXT NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_slug, date)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(date);
