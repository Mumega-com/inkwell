import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../types'

/**
 * Tenant resolution middleware.
 *
 * Resolves tenant_slug from the Host header:
 * 1. Check for custom domain mapping in KV: domain:{hostname} -> slug
 * 2. Check for subdomain pattern: {slug}.mumega.com -> slug
 * 3. If no tenant found, request proceeds without tenant context (single-site mode)
 *
 * Sets c.set('tenant_slug', slug) for downstream routes.
 */
export function tenantResolver(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const host = c.req.header('host') || ''
    let tenantSlug: string | null = null

    // 1. Check KV for custom domain mapping
    if (c.env.SESSIONS) {
      const mapped = await c.env.SESSIONS.get(`domain:${host}`)
      if (mapped) {
        tenantSlug = mapped
      }
    }

    // 2. Check subdomain pattern
    if (!tenantSlug && host.endsWith('.mumega.com')) {
      const parts = host.replace('.mumega.com', '').split('.')
      if (parts.length === 1 && parts[0].length > 0) {
        tenantSlug = parts[0]
      }
    }

    // Set tenant context (null means single-site / no tenant)
    c.set('tenant_slug', tenantSlug)
    await next()
  }
}
