/**
 * RBAC middleware — kernel-enforced role checks for plugin routes.
 *
 * Resolves the user's role from:
 *   1. Session cookie (AuthSession.role)
 *   2. CF Access JWT (cf_access_role variable)
 *   3. Defaults to 'viewer'
 *
 * System tokens (PUBLISH_TOKEN, INKWELL_MCP_TOKEN, CONTRACT_AUTH_TOKEN)
 * bypass RBAC — they are deployment-level secrets, not user sessions.
 */

import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../types'
import type { InkwellRole } from '../../../../kernel/types'
import { hasRole } from '../../../../kernel/types'
import { resolveRole } from '../../../../kernel/roles'

export function requireRole(requiredRole: InkwellRole): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    // System tokens bypass RBAC
    const auth = c.req.header('Authorization')
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice(7)
      if (
        (c.env.PUBLISH_TOKEN && token === c.env.PUBLISH_TOKEN) ||
        (c.env.INKWELL_MCP_TOKEN && token === c.env.INKWELL_MCP_TOKEN) ||
        (c.env.CONTRACT_AUTH_TOKEN && token === c.env.CONTRACT_AUTH_TOKEN)
      ) {
        return next()
      }
    }

    // Resolve user role from session or CF Access
    const session = c.get('authSession')
    const cfRole = c.get('cf_access_role')
    const userRole = resolveRole(session?.role ?? cfRole)

    if (!hasRole(userRole, requiredRole)) {
      return c.json(
        { error: 'forbidden', required_role: requiredRole, your_role: userRole },
        403,
      )
    }

    return next()
  }
}
