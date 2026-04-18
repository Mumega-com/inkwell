import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../types'
import { config } from '../../../../inkwell.config'
import {
  getCachedTenant,
  cacheTenant,
  resolveTenantFromOrigin,
} from '../lib/tenant-cache'

/**
 * Tenant resolution middleware.
 *
 * Resolution order:
 * 1. Check session cache for full tenant data (fast path — no origin call)
 * 2. Check for custom domain mapping: domain:{hostname} -> slug
 * 3. Check for subdomain pattern: {slug}.yourdomain.com -> slug
 * 4. If SOS_SAAS_URL is set, resolve from origin and cache the result
 * 5. If no tenant found, request proceeds without tenant context (single-site mode)
 *
 * Sets c.set('tenant_slug', slug) and c.set('tenant_config', config) for downstream routes.
 */
export function tenantResolver(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const host = c.req.header('host') || ''
    const sessions = c.get('sessions')
    let tenantSlug: string | null = null
    let tenantConfig: Record<string, unknown> | null = null

    // 1. Check cache for full tenant data (edge-cached, no origin call)
    if (sessions) {
      const cached = await getCachedTenant(sessions, host)
      if (cached) {
        tenantSlug = cached.slug
        tenantConfig = cached.inkwell_config
        c.set('tenant_slug', tenantSlug)
        c.set('tenant_config', tenantConfig)
        await next()
        return
      }
    }

    // 2. Check for custom domain mapping
    if (sessions) {
      const mapped = await sessions.get(`domain:${host}`)
      if (mapped) {
        tenantSlug = mapped
      }
    }

    // 3. Check subdomain pattern
    const baseDomain = config.domain
    if (!tenantSlug && baseDomain && host.endsWith(`.${baseDomain}`)) {
      const parts = host.replace(`.${baseDomain}`, '').split('.')
      if (parts.length === 1 && parts[0].length > 0) {
        tenantSlug = parts[0]
      }
    }

    // 4. If SOS_SAAS_URL is set, resolve from origin and cache
    if (c.env.SOS_SAAS_URL && sessions) {
      const resolved = await resolveTenantFromOrigin(c.env.SOS_SAAS_URL, host)
      if (resolved) {
        tenantSlug = resolved.slug
        tenantConfig = resolved.inkwell_config
        await cacheTenant(sessions, host, resolved)
      }
    }

    // Set tenant context (null means single-site / no tenant)
    c.set('tenant_slug', tenantSlug)
    c.set('tenant_config', tenantConfig)
    await next()
  }
}
