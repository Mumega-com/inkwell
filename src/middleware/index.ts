/**
 * Astro SSR middleware — content-tier enforcement for server-rendered pages.
 *
 * For page routes that carry content tier frontmatter, this middleware:
 *   1. Reads the session cookie (inkwell_session or AUTH_COOKIE_NAME)
 *   2. Checks the content tier against the session claims
 *   3. Redirects to /login if access is denied
 *
 * Public pages pass through immediately — no session lookup required.
 *
 * This middleware intentionally mirrors the Worker-side contentTierMiddleware
 * in workers/inkwell-api/src/middleware/content-tier.ts but targets the Astro
 * request/response model (defineMiddleware + MiddlewareHandler).
 *
 * NOTE: The actual content tier values live in Astro content collection
 * frontmatter (src/content.config.ts). Pages that use getEntry / getCollection
 * should pass the tier fields through to this middleware via locals.
 *
 * Typical usage: pages set `locals.contentTier` in the page's getStaticProps
 * or via a layout component. This middleware reads that value.
 */

import { defineMiddleware, sequence } from 'astro:middleware'
import { checkContentTier } from '../../workers/inkwell-api/src/middleware/content-tier'
import type { ContentTierContext, TierSession } from '../../workers/inkwell-api/src/middleware/content-tier'

const DEFAULT_COOKIE_NAME = 'inkwell_session'

/**
 * Parse the session token out of the Cookie header.
 * Mirrors getSessionTokenFromCookieHeader in auth.ts.
 */
function getTokenFromCookies(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) return null
  for (const segment of cookieHeader.split(';')) {
    const [rawName, ...rawValueParts] = segment.trim().split('=')
    if (rawName?.trim() === cookieName) {
      const val = decodeURIComponent(rawValueParts.join('=')).trim()
      return val || null
    }
  }
  return null
}

/**
 * Resolve the auth cookie name from runtime env (mirrors Worker auth.ts).
 * In Astro, runtime env is accessed via import.meta.env on the server side.
 */
function resolveCookieName(): string {
  // import.meta.env is available server-side in Astro SSR
  const name = (import.meta.env as Record<string, unknown>)['AUTH_COOKIE_NAME']
  return typeof name === 'string' && name.trim() ? name.trim() : DEFAULT_COOKIE_NAME
}

/**
 * Core middleware: checks `locals.contentTier` against the session cookie.
 * If `locals.contentTier` is not set, the page is treated as public.
 */
const contentTierGuard = defineMiddleware(async (context, next) => {
  const locals = context.locals as Record<string, unknown>
  const ctx = locals['contentTier'] as ContentTierContext | undefined

  // No tier context set → public, pass through
  if (!ctx || ctx.tier === 'public') {
    return next()
  }

  // Parse session token from cookie
  const cookieName = resolveCookieName()
  const cookieHeader = context.request.headers.get('Cookie')
  const token = getTokenFromCookies(cookieHeader, cookieName)

  // Resolve session from cookie token
  // In Cloudflare Astro, the KV binding is accessible via locals.runtime
  let session: TierSession | null = null
  if (token) {
    try {
      const runtime = locals['runtime'] as { env?: Record<string, unknown> } | undefined
      const sessions = runtime?.env?.['SESSIONS'] as { get(key: string): Promise<string | null> } | undefined
      if (sessions) {
        const raw = await sessions.get(`session:${token}`)
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>
          session = {
            user_id: parsed['identityId'] as string | undefined,
            role: parsed['role'] as string | undefined,
            squad_id: parsed['squad_id'] as string | undefined,
            project_id: parsed['project_id'] as string | undefined,
            entity_id: parsed['entity_id'] as string | undefined,
          }
        }
      }
    } catch {
      // Session parse failure → treat as unauthenticated
    }
  }

  const result = checkContentTier(ctx, session)

  if (!result.allowed) {
    const loginUrl = new URL('/login', context.request.url)
    loginUrl.searchParams.set('redirect', context.url.pathname)
    loginUrl.searchParams.set('reason', result.reason ?? 'forbidden')
    return context.redirect(loginUrl.toString(), 302)
  }

  return next()
})

export const onRequest = sequence(contentTierGuard)
