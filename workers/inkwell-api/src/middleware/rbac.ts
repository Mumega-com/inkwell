import type { Context, Next } from 'hono'
import { hasRole } from '../../../../kernel/types'
import type { InkwellRole } from '../../../../kernel/types'

export function requireRole(minimumRole: InkwellRole) {
  return async (c: Context, next: Next) => {
    const userRole = (c.get('cf_access_role') || 'viewer') as InkwellRole
    if (!hasRole(userRole, minimumRole)) {
      return c.json({ error: 'forbidden', message: `Requires ${minimumRole} role or higher` }, 403)
    }
    return next()
  }
}
