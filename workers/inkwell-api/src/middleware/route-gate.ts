import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../types'

/**
 * Route gate middleware — conditionally enables/disables route groups
 * based on the ENABLED_ROUTES env var.
 *
 * Usage in index.ts:
 *   app.use('/api/contracts/*', routeGate('contracts'))
 *
 * ENABLED_ROUTES env var format:
 *   - Not set or "all" → all routes enabled (default)
 *   - Comma-separated list → only listed routes enabled
 *   - Example: "auth,mcp,content,analytics"
 */
export function routeGate(routeName: string): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const enabled = c.env.ENABLED_ROUTES || 'all'
    if (enabled !== 'all' && !enabled.split(',').map(s => s.trim()).includes(routeName)) {
      return c.json({ error: 'route_disabled', route: routeName }, 404)
    }
    await next()
  }
}
