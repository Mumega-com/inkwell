/**
 * Adapter middleware — creates DatabasePort adapters per-request
 * and stores them on the Hono context.
 *
 * Plugins access databases via c.get('db_core') instead of c.env.DB_CORE.
 * This is the hexagonal architecture boundary: plugins depend on ports,
 * not on Cloudflare D1 bindings.
 */
import type { MiddlewareHandler } from 'hono'
import { D1DatabaseAdapter } from '../../../../kernel/adapters/d1'
import type { AppBindings } from '../types'

export const adapterMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  c.set('db_core', new D1DatabaseAdapter(c.env.DB_CORE))
  c.set('db_analytics', new D1DatabaseAdapter(c.env.DB_ANALYTICS))
  c.set('db_marketing', new D1DatabaseAdapter(c.env.DB_MARKETING))
  return next()
}
