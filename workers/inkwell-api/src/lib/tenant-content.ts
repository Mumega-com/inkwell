import type { KVNamespace } from '@cloudflare/workers-types'

/**
 * Get a content key scoped to a tenant.
 * In single-site mode (no tenant), returns the key as-is.
 * In multi-tenant mode, prefixes with tenant slug.
 */
export function contentKey(tenantSlug: string | null, key: string): string {
  if (!tenantSlug) return key
  return `${tenantSlug}:${key}`
}

/**
 * Get content from KV, scoped to tenant.
 */
export async function getContent(
  kv: KVNamespace,
  tenantSlug: string | null,
  slug: string,
): Promise<string | null> {
  return kv.get(contentKey(tenantSlug, `post:${slug}`))
}

/**
 * Get content metadata from KV, scoped to tenant.
 */
export async function getContentMeta(
  kv: KVNamespace,
  tenantSlug: string | null,
  slug: string,
): Promise<Record<string, unknown> | null> {
  return kv.get(contentKey(tenantSlug, `meta:${slug}`), 'json')
}

/**
 * Store content in KV, scoped to tenant.
 */
export async function putContent(
  kv: KVNamespace,
  tenantSlug: string | null,
  slug: string,
  markdown: string,
  meta: Record<string, unknown>,
): Promise<void> {
  const prefix = tenantSlug ? `${tenantSlug}:` : ''
  await kv.put(`${prefix}post:${slug}`, markdown)
  await kv.put(`${prefix}meta:${slug}`, JSON.stringify(meta))
}

/**
 * Add tenant filter to a D1 query.
 * Returns the WHERE clause fragment and bind value.
 */
export function tenantFilter(tenantSlug: string | null): { clause: string; bind: string[] } {
  if (!tenantSlug) return { clause: '', bind: [] }
  return { clause: ' AND tenant_slug = ?', bind: [tenantSlug] }
}
