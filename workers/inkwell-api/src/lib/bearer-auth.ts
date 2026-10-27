import type { SubtleCrypto } from '@cloudflare/workers-types'
import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../types'

export function hasValidBearer(authorization: string | undefined, token: string | undefined): boolean {
  if (!token || !authorization?.startsWith('Bearer ')) return false
  const encoder = new TextEncoder()
  const supplied = encoder.encode(authorization.slice(7))
  const expected = encoder.encode(token)
  return supplied.byteLength === expected.byteLength
    && (crypto.subtle as SubtleCrypto).timingSafeEqual(supplied, expected)
}

export const requirePublishBearer: MiddlewareHandler<AppBindings> = async (c, next) => {
  if (!c.env.PUBLISH_TOKEN) return c.json({ error: 'publish_token_unconfigured' }, 503)
  if (!hasValidBearer(c.req.header('Authorization'), c.env.PUBLISH_TOKEN)) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  await next()
}

// Both publish writers persist an explicit status in KV metadata. The legacy
// content_index insert does not record it, so an index row is not publication proof.
export function isPublished(meta: Record<string, unknown> | null): boolean {
  return meta?.status === 'published'
}
