/**
 * UTM attribution middleware — extracts UTM parameters from query strings.
 *
 * Runs on every request. Extracts utm_source, utm_medium, utm_campaign,
 * utm_content, utm_term and stores them on the Hono context.
 * Downstream handlers (event tracking, auth) attach these to their records.
 *
 * Also captures gclid/fbclid for ad platform attribution.
 */
import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../types'

export interface UtmParams {
  source: string | null
  medium: string | null
  campaign: string | null
  content: string | null
  term: string | null
  clickId: string | null     // gclid or fbclid
  clickSource: string | null // 'google' or 'meta'
}

export const utmMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const url = new URL(c.req.url)
  const params = url.searchParams

  const utm: UtmParams = {
    source: params.get('utm_source'),
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
    content: params.get('utm_content'),
    term: params.get('utm_term'),
    clickId: params.get('gclid') || params.get('fbclid') || null,
    clickSource: params.get('gclid') ? 'google' : params.get('fbclid') ? 'meta' : null,
  }

  // Only set if at least one UTM param is present
  const hasUtm = utm.source || utm.medium || utm.campaign || utm.clickId
  c.set('utm', hasUtm ? utm : null)

  return next()
}
