import type { MiddlewareHandler } from 'hono'
import type { KVNamespace } from '@cloudflare/workers-types'
import type { AppBindings } from '../types'

// ---------------------------------------------------------------------------
// CF Access Zero Trust middleware
//
// 1. Service Token auth (CF-Access-Client-Id + CF-Access-Client-Secret)
// 2. JWT signature verification against JWKS (RS256, cached in KV)
// 3. Backwards-compatible JWT decode when CF_ACCESS_TEAM is not set
// 4. Tenant resolution via SaaS API
//
// Non-blocking: requests without CF Access headers pass through unchanged.
// ---------------------------------------------------------------------------

// ── Base64url helpers ──────────────────────────────────────────────────

function decodeBase64Url(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4)
  return atob(padded)
}

function base64UrlToArrayBuffer(str: string): ArrayBuffer {
  const binary = decodeBase64Url(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

// ── JWT verification (RS256 via Web Crypto API) ────────────────────────

interface JwksKey {
  kid: string
  kty: string
  n: string
  e: string
}

async function verifyJwt(
  jwt: string,
  teamDomain: string,
  sessions: KVNamespace,
): Promise<Record<string, unknown> | null> {
  const parts = jwt.split('.')
  if (parts.length !== 3) return null

  // Decode header to get kid + alg
  const header = JSON.parse(decodeBase64Url(parts[0])) as { kid?: string; alg?: string }
  if (header.alg !== 'RS256' || !header.kid) return null

  // Fetch JWKS (cached in KV for 1 hour)
  const cacheKey = `cf-access-jwks:${teamDomain}`
  let jwksRaw = await sessions.get(cacheKey)

  if (!jwksRaw) {
    const res = await fetch(
      `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`,
    )
    if (!res.ok) return null
    jwksRaw = await res.text()
    await sessions.put(cacheKey, jwksRaw, { expirationTtl: 3600 })
  }

  const jwks = JSON.parse(jwksRaw) as { keys: JwksKey[] }
  const key = jwks.keys.find((k) => k.kid === header.kid)
  if (!key) return null

  // Import RSA public key
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    { kty: key.kty, n: key.n, e: key.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  // Verify signature
  const signatureInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const signature = base64UrlToArrayBuffer(parts[2])

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signature,
    signatureInput,
  )

  if (!valid) return null

  // Decode payload
  const payload = JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>

  // Check expiry
  if (typeof payload['exp'] === 'number' && payload['exp'] < Date.now() / 1000) {
    return null
  }

  return payload
}

// ── Middleware ──────────────────────────────────────────────────────────

export const cfAccessMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const envRecord = c.env as Record<string, string>

  // ── 1. Service Token check ─────────────────────────────────────────
  const clientId = c.req.header('CF-Access-Client-Id')
  const clientSecret = c.req.header('CF-Access-Client-Secret')

  if (clientId && clientSecret) {
    const expectedId = envRecord['CF_ACCESS_CLIENT_ID']
    const expectedSecret = envRecord['CF_ACCESS_CLIENT_SECRET']

    if (expectedId && expectedSecret) {
      if (clientId === expectedId && clientSecret === expectedSecret) {
        c.set('cf_access_email', `service-token@${clientId}`)
        c.set('cf_access_tenant', null)
        c.set('cf_access_role', 'admin')
        return next()
      }
      return c.json({ error: 'invalid_service_token' }, 403)
    }
    // No expected values configured — fall through to JWT check
  }

  // ── 2. JWT check ───────────────────────────────────────────────────
  const jwt = c.req.header('CF-Access-JWT-Assertion')
  if (!jwt) {
    c.set('cf_access_email', null)
    c.set('cf_access_tenant', null)
    c.set('cf_access_role', null)
    return next()
  }

  try {
    const teamDomain = envRecord['CF_ACCESS_TEAM']
    let payload: Record<string, unknown> | null = null

    if (teamDomain) {
      // Verify JWT signature against JWKS
      payload = await verifyJwt(jwt, teamDomain, c.env.SESSIONS)
    } else {
      // Backwards compatible: decode without verification
      const parts = jwt.split('.')
      if (parts.length === 3) {
        payload = JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>
      }
    }

    if (!payload) {
      c.set('cf_access_email', null)
      c.set('cf_access_tenant', null)
      c.set('cf_access_role', null)
      return next()
    }

    const email = typeof payload['email'] === 'string' ? payload['email'] : null
    if (!email) {
      c.set('cf_access_email', null)
      c.set('cf_access_tenant', null)
      c.set('cf_access_role', null)
      return next()
    }

    c.set('cf_access_email', email)

    // ── 3. Tenant resolution via SaaS API ────────────────────────────
    const saasUrl = c.env.SOS_SAAS_URL
    if (saasUrl) {
      try {
        const res = await fetch(
          `${saasUrl}/auth/tenant?email=${encodeURIComponent(email)}`,
          { headers: { Authorization: `Bearer ${c.env.NETWORK_TOKEN ?? ''}` } },
        )
        if (res.ok) {
          const data = (await res.json()) as { tenant_slug?: string }
          c.set('cf_access_tenant', data.tenant_slug ?? null)
        } else {
          c.set('cf_access_tenant', null)
        }
      } catch {
        c.set('cf_access_tenant', null)
      }
    } else {
      c.set('cf_access_tenant', null)
    }

    c.set('cf_access_role', null) // resolved later by RBAC middleware
  } catch {
    c.set('cf_access_email', null)
    c.set('cf_access_tenant', null)
    c.set('cf_access_role', null)
  }

  return next()
}
