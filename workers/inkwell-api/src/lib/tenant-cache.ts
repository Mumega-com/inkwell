import type { KVNamespace } from '@cloudflare/workers-types'

export interface CachedTenant {
  slug: string
  label: string
  plan: string
  domain: string | null
  subdomain: string
  status: string
  inkwell_config: Record<string, unknown> | null
  cached_at: number
}

const CACHE_TTL_SECONDS = 300 // 5 minutes

/**
 * Get tenant data from KV cache. Returns null if not cached or expired.
 */
export async function getCachedTenant(
  kv: KVNamespace,
  hostname: string,
): Promise<CachedTenant | null> {
  const raw = await kv.get(`tenant:${hostname}`, 'json')
  if (!raw) return null

  const tenant = raw as CachedTenant
  const age = (Date.now() - tenant.cached_at) / 1000
  if (age > CACHE_TTL_SECONDS) return null // expired

  return tenant
}

/**
 * Cache tenant data in KV.
 */
export async function cacheTenant(
  kv: KVNamespace,
  hostname: string,
  tenant: CachedTenant,
): Promise<void> {
  tenant.cached_at = Date.now()
  await kv.put(`tenant:${hostname}`, JSON.stringify(tenant), {
    expirationTtl: CACHE_TTL_SECONDS * 2, // KV TTL as backstop
  })
}

/**
 * Resolve tenant from origin SaaS service and cache the result.
 * Used when KV cache is empty or expired.
 */
export async function resolveTenantFromOrigin(
  saasUrl: string,
  hostname: string,
): Promise<CachedTenant | null> {
  try {
    const resp = await fetch(
      `${saasUrl}/resolve/${encodeURIComponent(hostname)}`,
      {
        headers: { Accept: 'application/json' },
        cf: { cacheTtl: 60 }, // Cloudflare cache for 60s
      },
    )
    if (!resp.ok) return null
    const data = (await resp.json()) as Record<string, unknown>
    return {
      slug: data.slug as string,
      label: data.label as string,
      plan: data.plan as string,
      domain: (data.domain as string) || null,
      subdomain: data.subdomain as string,
      status: data.status as string,
      inkwell_config: (data.inkwell_config as Record<string, unknown>) || null,
      cached_at: Date.now(),
    }
  } catch {
    return null
  }
}
