import type { ContentPort } from '../../../../kernel/types'

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
 * Get content from ContentPort, scoped to tenant.
 */
export async function getContent(
  content: ContentPort,
  tenantSlug: string | null,
  slug: string,
): Promise<string | null> {
  return content.getPage(contentKey(tenantSlug, `post:${slug}`))
}

/**
 * Get content metadata from ContentPort, scoped to tenant.
 */
export async function getContentMeta(
  content: ContentPort,
  tenantSlug: string | null,
  slug: string,
): Promise<Record<string, unknown> | null> {
  const raw = await content.getPage(contentKey(tenantSlug, `meta:${slug}`))
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Store content in ContentPort, scoped to tenant.
 */
export async function putContent(
  content: ContentPort,
  tenantSlug: string | null,
  slug: string,
  markdown: string,
  meta: Record<string, unknown>,
): Promise<void> {
  const prefix = tenantSlug ? `${tenantSlug}:` : ''
  await content.putPage(`${prefix}post:${slug}`, markdown)
  await content.putPage(`${prefix}meta:${slug}`, JSON.stringify(meta))
}

/**
 * Add tenant filter to a D1 query.
 * Returns the WHERE clause fragment and bind value.
 */
export function tenantFilter(tenantSlug: string | null): { clause: string; bind: string[] } {
  if (!tenantSlug) return { clause: '', bind: [] }
  return { clause: ' AND tenant_slug = ?', bind: [tenantSlug] }
}
