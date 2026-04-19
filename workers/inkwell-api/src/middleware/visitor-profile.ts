/**
 * Visitor profile middleware — unified first-party identity.
 *
 * Creates/updates visitor_profiles in DB_ANALYTICS on every request.
 * Uses waitUntil for fire-and-forget — zero added latency.
 *
 * When an auth session exists, stitches the anonymous visitor_hash
 * to the portal_account_id — linking pre-signup behavior to identity.
 */
import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../types'

export const visitorProfileMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  // Skip non-page requests (API calls from agents, health checks)
  const path = new URL(c.req.url).pathname
  if (path.startsWith('/api/') && !path.startsWith('/api/analytics/')) {
    return next()
  }

  const ip = c.req.header('cf-connecting-ip') ?? 'anonymous'
  const country = c.req.header('cf-ipcountry') ?? 'unknown'
  const mobile = c.req.header('sec-ch-ua-mobile')
  const device = mobile === '?1' ? 'mobile' : 'desktop'
  const tenant = c.get('tenant_slug') ?? null

  // Generate consistent visitor hash (IP + daily salt for session-level stitching)
  const encoder = new TextEncoder()
  const daySalt = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const hashData = encoder.encode(ip + daySalt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', hashData)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const visitorHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)

  // Store visitor hash on context for downstream use
  c.set('visitor_hash', visitorHash)

  // Get UTM params from upstream middleware
  const utm = c.get('utm')

  // Get auth session for identity stitching
  const authSession = c.get('authSession')
  const portalAccountId = authSession?.portalAccountId ?? null
  const email = authSession?.contactValue ?? null

  // Fire-and-forget profile upsert
  const db = c.get('db_analytics')
  c.executionCtx.waitUntil(
    db.execute(
      `INSERT INTO visitor_profiles (
        visitor_hash, first_seen, last_seen, visit_count, total_page_views,
        last_path, country, device, tenant,
        utm_first_source, utm_first_medium, utm_first_campaign,
        utm_last_source, utm_last_medium, utm_last_campaign,
        portal_account_id, email
      ) VALUES (
        ?, datetime('now'), datetime('now'), 1, 1,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
      ON CONFLICT(visitor_hash) DO UPDATE SET
        last_seen = datetime('now'),
        visit_count = visitor_profiles.visit_count + 1,
        total_page_views = visitor_profiles.total_page_views + 1,
        last_path = excluded.last_path,
        country = excluded.country,
        device = excluded.device,
        utm_last_source = COALESCE(excluded.utm_last_source, visitor_profiles.utm_last_source),
        utm_last_medium = COALESCE(excluded.utm_last_medium, visitor_profiles.utm_last_medium),
        utm_last_campaign = COALESCE(excluded.utm_last_campaign, visitor_profiles.utm_last_campaign),
        portal_account_id = COALESCE(excluded.portal_account_id, visitor_profiles.portal_account_id),
        email = COALESCE(excluded.email, visitor_profiles.email)`,
      [
        visitorHash, path, country, device, tenant,
        utm?.source ?? null, utm?.medium ?? null, utm?.campaign ?? null,
        utm?.source ?? null, utm?.medium ?? null, utm?.campaign ?? null,
        portalAccountId, email,
      ]
    ).catch(() => { /* non-critical — don't fail the request */ })
  )

  return next()
}
