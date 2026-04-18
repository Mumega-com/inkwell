/**
 * Adapter middleware — creates port adapters per-request via Hono context.
 *
 * Which adapter is used for each port is driven by:
 *   1. inkwell.config.ts → config.adapters (static, per-fork)
 *   2. Env var overrides (SOS_MODE=sos overrides bus/memory/economy to SOS adapters)
 *
 * To add a new adapter (e.g. Supabase, Firebase, Redis):
 *   1. Create kernel/adapters/my-adapter.ts implementing the port interface
 *   2. Add a case to the factory function below
 *   3. Set config.adapters.portName = 'my-adapter' in inkwell.config.ts
 *
 * Plugins use c.get('bus'), c.get('memory'), etc. — they never know which adapter is behind it.
 */
import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../types'
import type { BusPort, MemoryPort, EconomyPort, AgentPort, GraphPort } from '../../../../kernel/types'
import { config } from '../../../../inkwell.config'

// ── Infrastructure adapters (always D1/KV/R2 on Cloudflare) ─────────────────
import { D1DatabaseAdapter } from '../../../../kernel/adapters/d1'
import { KVSessionAdapter } from '../../../../kernel/adapters/kv-session'
import { KVContentAdapter } from '../../../../kernel/adapters/kv-content'
import { R2StorageAdapter } from '../../../../kernel/adapters/r2-storage'

// ── Graph adapters ──────────────────────────────────────────────────────────
import { D1GraphAdapter } from '../../../../kernel/adapters/d1-graph'

// ── Agent adapters ──────────────────────────────────────────────────────────
import { D1AgentAdapter } from '../../../../kernel/adapters/d1-agent'

// ── Bus adapters ────────────────────────────────────────────────────────────
import { StandaloneBusAdapter } from '../../../../kernel/adapters/standalone-bus'
import { SOSBusAdapter } from '../../../../kernel/adapters/sos-bus'

// ── Memory adapters ─────────────────────────────────────────────────────────
import { StandaloneMemoryAdapter } from '../../../../kernel/adapters/standalone-memory'
import { SOSMemoryAdapter } from '../../../../kernel/adapters/sos-memory'

// ── Economy adapters ────────────────────────────────────────────────────────
import { StandaloneEconomyAdapter } from '../../../../kernel/adapters/standalone-economy'
import { SOSEconomyAdapter } from '../../../../kernel/adapters/sos-economy'

// ── Adapter Factories ───────────────────────────────────────────────────────
// Each factory takes the env and returns the adapter instance.
// To add a new implementation, add a case here.

type Env = AppBindings['Bindings']

function createBusAdapter(type: string, env: Env, tenant: string): BusPort {
  switch (type) {
    case 'sos':
      if (!env.SOS_BUS_URL || !env.NETWORK_TOKEN) return new StandaloneBusAdapter()
      return new SOSBusAdapter(env.SOS_BUS_URL, env.NETWORK_TOKEN, `organism:${tenant}`)
    case 'standalone':
    default:
      return new StandaloneBusAdapter()
  }
}

function createMemoryAdapter(type: string, env: Env, tenant: string): MemoryPort {
  switch (type) {
    case 'mirror':
      if (!env.SOS_MIRROR_URL || !env.NETWORK_TOKEN) return new StandaloneMemoryAdapter()
      return new SOSMemoryAdapter(env.SOS_MIRROR_URL, env.NETWORK_TOKEN, tenant)
    case 'standalone':
    default:
      return new StandaloneMemoryAdapter()
  }
}

function createEconomyAdapter(type: string, env: Env): EconomyPort {
  switch (type) {
    case 'sos':
      if (!env.SOS_ECONOMY_URL || !env.NETWORK_TOKEN) return new StandaloneEconomyAdapter()
      return new SOSEconomyAdapter(env.SOS_ECONOMY_URL, env.NETWORK_TOKEN)
    case 'standalone':
    default:
      return new StandaloneEconomyAdapter()
  }
}

function createGraphAdapter(type: string, db: import('../../../../kernel/types').DatabasePort): GraphPort {
  switch (type) {
    case 'd1':
    default:
      return new D1GraphAdapter(db)
  }
}

function createAgentAdapter(type: string, db: import('../../../../kernel/types').DatabasePort): AgentPort {
  switch (type) {
    case 'd1':
    default:
      return new D1AgentAdapter(db)
  }
}

// ── Resolve adapter type ────────────────────────────────────────────────────
// SOS_MODE=sos in env overrides config for bus/memory/economy.
// Otherwise, config.adapters is the source of truth.

function resolveAdapterType(port: string, env: Env): string {
  const sosMode = env.SOS_MODE === 'sos'
  const configType = (config.adapters as Record<string, string>)[port]

  if (sosMode) {
    if (port === 'bus') return 'sos'
    if (port === 'memory') return 'mirror'
    if (port === 'economy') return 'sos'
  }

  return configType ?? 'standalone'
}

// ── Middleware ───────────────────────────────────────────────────────────────

export const adapterMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  // Infrastructure ports (always Cloudflare bindings — swap these for GC/AWS)
  const dbCore = new D1DatabaseAdapter(c.env.DB_CORE)
  c.set('db_core', dbCore)
  c.set('db_analytics', new D1DatabaseAdapter(c.env.DB_ANALYTICS))
  c.set('db_marketing', new D1DatabaseAdapter(c.env.DB_MARKETING))
  c.set('sessions', new KVSessionAdapter(c.env.SESSIONS))
  c.set('content', new KVContentAdapter(c.env.CONTENT))

  const r2 = (c.env as Record<string, unknown>)['MEDIA']
  if (r2) {
    c.set('storage', new R2StorageAdapter(r2 as never))
  }

  // Config-driven ports — resolved from inkwell.config.ts + env overrides
  const tenant = c.get('tenant_slug') ?? 'default'

  c.set('graph', createGraphAdapter(resolveAdapterType('graph', c.env), dbCore))
  c.set('agent', createAgentAdapter(resolveAdapterType('agent', c.env), dbCore))
  c.set('bus', createBusAdapter(resolveAdapterType('bus', c.env), c.env, tenant))
  c.set('memory', createMemoryAdapter(resolveAdapterType('memory', c.env), c.env, tenant))
  c.set('economy', createEconomyAdapter(resolveAdapterType('economy', c.env), c.env))

  return next()
}
