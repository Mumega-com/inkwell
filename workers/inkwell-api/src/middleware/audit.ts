import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../types'

/**
 * Public build audit hook.
 *
 * Private deployments can replace this with durable audit sinks. The OSS
 * worker keeps the middleware surface available without requiring private
 * logging bindings.
 */
export function auditLogger(): MiddlewareHandler<AppBindings> {
  return async (_c, next) => {
    await next()
  }
}
