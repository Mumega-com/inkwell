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
import { D1GraphAdapter } from '../../../../kernel/adapters/d1-graph'
import { D1AgentAdapter } from '../../../../kernel/adapters/d1-agent'
import { StandaloneBusAdapter } from '../../../../kernel/adapters/standalone-bus'
import { SOSBusAdapter } from '../../../../kernel/adapters/sos-bus'
import { StandaloneMemoryAdapter } from '../../../../kernel/adapters/standalone-memory'
import { SOSMemoryAdapter } from '../../../../kernel/adapters/sos-memory'
import { StandaloneEconomyAdapter } from '../../../../kernel/adapters/standalone-economy'
import { SOSEconomyAdapter } from '../../../../kernel/adapters/sos-economy'
import type { AppBindings } from '../types'

export const adapterMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const sosMode = c.env.SOS_MODE === 'sos'

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

  // Graph port (knowledge graph backed by D1)
  c.set('graph', new D1GraphAdapter(c.get('db_core')))

  // Agent port (managed agent config + budget tracking)
  c.set('agent', new D1AgentAdapter(c.get('db_core')))

  // Bus port — SOS or standalone
  const tenant = c.get('tenant_slug') ?? 'default'
  if (sosMode && c.env.SOS_BUS_URL && c.env.MUMEGA_TOKEN) {
    c.set('bus', new SOSBusAdapter(c.env.SOS_BUS_URL, c.env.MUMEGA_TOKEN, `organism:${tenant}`))
  } else {
    c.set('bus', new StandaloneBusAdapter())
  }

  // Memory port — SOS Mirror or standalone
  if (sosMode && c.env.SOS_MIRROR_URL && c.env.MUMEGA_TOKEN) {
    c.set('memory', new SOSMemoryAdapter(c.env.SOS_MIRROR_URL, c.env.MUMEGA_TOKEN, tenant))
  } else {
    c.set('memory', new StandaloneMemoryAdapter())
  }

  // Economy port — SOS Economy or standalone
  if (sosMode && c.env.SOS_ECONOMY_URL && c.env.MUMEGA_TOKEN) {
    c.set('economy', new SOSEconomyAdapter(c.env.SOS_ECONOMY_URL, c.env.MUMEGA_TOKEN))
  } else {
    c.set('economy', new StandaloneEconomyAdapter())
  }

  return next()
}
