-- Add tenant_slug to content_index for multi-tenant content publishing
ALTER TABLE content_index ADD COLUMN tenant_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_content_index_tenant_slug
  ON content_index (tenant_slug, published_at DESC);
