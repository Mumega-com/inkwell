import type { MiddlewareHandler } from 'hono'

import type { AppBindings, AuthSession } from '../types'

const DEFAULT_COOKIE_NAME = 'inkwell_session'

function parseCookieHeader(headerValue: string | undefined | null): Record<string, string> {
  if (!headerValue) return {}

  const cookies: Record<string, string> = {}
  for (const segment of headerValue.split(';')) {
    const [rawName, ...rawValueParts] = segment.trim().split('=')
    if (!rawName) continue
    cookies[rawName] = decodeURIComponent(rawValueParts.join('='))
  }

  return cookies
}

export function getAuthCookieName(c: { env: AppBindings['Bindings'] }): string {
  return c.env.AUTH_COOKIE_NAME?.trim() || DEFAULT_COOKIE_NAME
}

export function buildSessionCookie(token: string, ttlSeconds: number, cookieName = DEFAULT_COOKIE_NAME): string {
  return [
    `${cookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Secure',
    `Max-Age=${ttlSeconds}`,
  ].join('; ')
}

export function buildExpiredSessionCookie(cookieName = DEFAULT_COOKIE_NAME): string {
  return [
    `${cookieName}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Secure',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ].join('; ')
}

export function getSessionTokenFromCookieHeader(cookieHeader: string | undefined | null, cookieName: string): string | null {
  const cookies = parseCookieHeader(cookieHeader)
  const token = cookies[cookieName]
  return token && token.trim() ? token : null
}

export async function readSessionFromRequest(
  c: { req: { header(name: string): string | undefined }; env: AppBindings['Bindings']; get: (key: 'sessions') => import('../../../../kernel/types').SessionPort },
): Promise<{ token: string | null; session: AuthSession | null }> {
  const cookieName = getAuthCookieName(c)

  // Try cookie first, fall back to Bearer token (for API clients that can't set cookies)
  let token = getSessionTokenFromCookieHeader(c.req.header('Cookie'), cookieName)
  if (!token) {
    const auth = c.req.header('Authorization')
    if (auth?.startsWith('Bearer ')) {
      const candidate = auth.slice(7)
      // Only treat as session token if it's not a known system token env var
      const isSystemToken =
        (c.env.PUBLISH_TOKEN && candidate === c.env.PUBLISH_TOKEN) ||
        (c.env.INKWELL_MCP_TOKEN && candidate === c.env.INKWELL_MCP_TOKEN) ||
        (c.env.CONTRACT_AUTH_TOKEN && candidate === c.env.CONTRACT_AUTH_TOKEN)
      if (!isSystemToken) {
        token = candidate
      }
    }
  }

  if (!token) {
    return { token: null, session: null }
  }

  const raw = await c.get('sessions').get(`session:${token}`)
  const session = raw ? JSON.parse(raw) as AuthSession : null
  return { token, session }
}

export const authSessionMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const { token, session } = await readSessionFromRequest(c)
  c.set('authSessionToken', token)
  c.set('authSession', session)
  await next()
}

export const requireAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const { token, session } = await readSessionFromRequest(c)
  c.set('authSessionToken', token)
  c.set('authSession', session)

  if (!session) {
    return c.json({ error: 'unauthenticated' }, 401)
  }

  await next()
}
