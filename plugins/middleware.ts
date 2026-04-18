/**
 * Shared middleware re-exported for plugin use.
 * Plugins import from '../middleware' — this file provides the bridge.
 * Source of truth: workers/inkwell-api/src/middleware/auth.ts
 */
export {
  requireAuth,
  readSessionFromRequest,
  authSessionMiddleware,
  getAuthCookieName,
  buildSessionCookie,
  buildExpiredSessionCookie,
  getSessionTokenFromCookieHeader,
} from '../workers/inkwell-api/src/middleware/auth'
