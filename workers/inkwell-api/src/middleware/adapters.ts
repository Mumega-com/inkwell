/**
 * Adapter middleware — creates port adapters per-request
 * and stores them on the Hono context.
 *
 * Plugins access infrastructure via c.get('db_core'), c.get('sessions'), etc.
 * This is the hexagonal architecture boundary: plugins depend on ports,
 * not on Cloudflare bindings (D1, KV, R2).
 *
 * To run on a different cloud, replace these adapters:
 *   D1DatabaseAdapter  → PostgresAdapter, MySQLAdapter
 *   KVSessionAdapter   → RedisAdapter, DynamoDBAdapter
 *   KVContentAdapter   → FirestoreAdapter, S3Adapter
 *   R2StorageAdapter   → S3Adapter, GCSAdapter
 */
import type { MiddlewareHandler } from 'hono'
import { D1DatabaseAdapter } from '../../../../kernel/adapters/d1'
import { KVSessionAdapter } from '../../../../kernel/adapters/kv-session'
import { KVContentAdapter } from '../../../../kernel/adapters/kv-content'
import { R2StorageAdapter } from '../../../../kernel/adapters/r2-storage'
import type { AppBindings } from '../types'

export const adapterMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  // Database ports
  c.set('db_core', new D1DatabaseAdapter(c.env.DB_CORE))
  c.set('db_analytics', new D1DatabaseAdapter(c.env.DB_ANALYTICS))
  c.set('db_marketing', new D1DatabaseAdapter(c.env.DB_MARKETING))

  // Session port
  c.set('sessions', new KVSessionAdapter(c.env.SESSIONS))

  // Content port (pre-rendered pages)
  c.set('content', new KVContentAdapter(c.env.CONTENT))

  // Storage port (R2 for media — optional, use no-op if binding missing)
  const r2 = (c.env as Record<string, unknown>)['MEDIA']
  if (r2) {
    c.set('storage', new R2StorageAdapter(r2 as never))
  }

  return next()
}
