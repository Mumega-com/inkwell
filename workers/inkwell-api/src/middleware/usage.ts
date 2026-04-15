import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../types'

/**
 * Usage tracking middleware — counts API calls per tenant per day.
 * Stored in DB_ANALYTICS for the SaaS billing system to query.
 *
 * Runs after tenant resolver. Non-blocking (fire-and-forget).
 * Only tracks requests where a tenant is resolved.
 */
export function usageTracker(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    await next()

    // Only track if tenant is resolved
    const tenantSlug = c.get('tenant_slug')
    if (!tenantSlug) return

    // Fire-and-forget — don't block the response
    c.executionCtx.waitUntil(
      trackApiCall(c.env.DB_ANALYTICS, tenantSlug).catch(() => {})
    )
  }
}

async function trackApiCall(db: D1Database, tenantSlug: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)

  // Upsert: increment counter for today
  await db
    .prepare(
      `INSERT INTO api_usage (tenant_slug, date, call_count)
     VALUES (?, ?, 1)
     ON CONFLICT(tenant_slug, date) DO UPDATE SET call_count = call_count + 1`
    )
    .bind(tenantSlug, today)
    .run()
}
