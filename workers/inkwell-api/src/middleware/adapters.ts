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
import type { BusPort, MemoryPort, EconomyPort, AgentPort, GraphPort, MediaPort, DatabasePort, SessionPort, ContentPort, StoragePort } from '../../../../kernel/types'
import { config } from '../../../../inkwell.config'

// ── Infrastructure adapters ─────────────────────────────────────────────────
import { D1DatabaseAdapter } from '../../../../kernel/adapters/d1'
import { PostgresDatabaseAdapter } from '../../../../kernel/adapters/postgres'
import { KVSessionAdapter } from '../../../../kernel/adapters/kv-session'
import { RedisSessionAdapter } from '../../../../kernel/adapters/redis-session'
import { KVContentAdapter } from '../../../../kernel/adapters/kv-content'
import { FileContentAdapter } from '../../../../kernel/adapters/file-content'
import { R2StorageAdapter } from '../../../../kernel/adapters/r2-storage'
import { S3StorageAdapter } from '../../../../kernel/adapters/s3-storage'

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

// ── Media adapter ──────────────────────────────────────────────────────────
import { CfMediaAdapter } from '../../../../kernel/adapters/cf-media'

// ── SEO adapter ───────────────────────────────────────────────────────────
import { CfSeoAdapter } from '../../../../kernel/adapters/cf-seo'

// ── Feedback adapter ──────────────────────────────────────────────────────
import { CfFeedbackAdapter } from '../../../../kernel/adapters/cf-feedback'

// ── Content Source adapters ─────────────────────────────────────────────────
import type { ContentSourcePort } from '../../../../kernel/types'
import { GitHubContentSource } from '../../../../kernel/adapters/source-github'
import { NotionContentSource } from '../../../../kernel/adapters/source-notion'
import { GoogleDriveSourceAdapter } from '../../../../kernel/adapters/source-gdrive'

/**
 * Create content source adapters from config.contentSources[].
 * Called by the sync plugin — not per-request middleware.
 * Obsidian adapter requires a VaultFS, so it's skipped in Worker context
 * (use CLI sync for local vaults).
 */
export function createContentSources(env: Env): ContentSourcePort[] {
  const sources: ContentSourcePort[] = []
  const contentSources = 'contentSources' in config ? config.contentSources : []
  for (const src of contentSources) {
    switch (src.type) {
      case 'github':
        sources.push(new GitHubContentSource({
          owner: src.owner,
          repo: src.repo,
          branch: src.branch,
          path: src.path,
          token: (env as Record<string, string>).GITHUB_TOKEN,
        }))
        break
      case 'notion':
        sources.push(new NotionContentSource({
          token: (env as Record<string, string>).NOTION_TOKEN ?? '',
          databaseId: src.databaseId,
        }))
        break
      case 'gdrive':
        sources.push(new GoogleDriveSourceAdapter({
          accessToken: (env as Record<string, string>).GDRIVE_TOKEN ?? '',
          folderId: src.folderId,
        }))
        break
      case 'obsidian':
        // Obsidian adapter requires VaultFS — not available in Worker context.
        // Use the CLI sync command or provide a VaultFS backed by R2/KV.
        break
    }
  }
  return sources
}

// ── Infrastructure Adapter Factories ────────────────────────────────────────
// Auto-detect provider from env: D1 bindings → Cloudflare, DATABASE_URL → Postgres, etc.

type Env = AppBindings['Bindings']

function createDatabaseAdapter(env: Env, binding: 'DB_CORE' | 'DB_ANALYTICS' | 'DB_MARKETING'): DatabasePort {
  const d1 = env[binding]
  if (d1) return new D1DatabaseAdapter(d1)

  // Postgres fallback — check for DATABASE_URL or binding-specific URL
  const pgUrl = (env as Record<string, string>)[`${binding}_URL`] ?? (env as Record<string, string>)['DATABASE_URL']
  if (pgUrl) {
    // Lazy-import: callers must provide a PgClient that works in their runtime.
    // For Workers: @neondatabase/serverless. For Node: pg or postgres.
    // The adapter middleware can't create the client itself because the pg library
    // varies by runtime. Instead, check for a pre-created client on env.
    const client = (env as Record<string, unknown>)[`${binding}_CLIENT`]
    if (client) return new PostgresDatabaseAdapter(client as never)
  }

  throw new Error(`No database adapter for ${binding}: set D1 binding or ${binding}_URL + ${binding}_CLIENT`)
}

function createSessionAdapter(env: Env): SessionPort {
  if (env.SESSIONS) return new KVSessionAdapter(env.SESSIONS)

  const redisClient = (env as Record<string, unknown>)['REDIS_CLIENT']
  if (redisClient) return new RedisSessionAdapter(redisClient as never)

  throw new Error('No session adapter: set SESSIONS KV binding or REDIS_CLIENT')
}

function createContentAdapter(env: Env): ContentPort {
  if (env.CONTENT) return new KVContentAdapter(env.CONTENT)

  const fsClient = (env as Record<string, unknown>)['FS_CLIENT']
  const contentDir = (env as Record<string, string>)['CONTENT_DIR'] ?? './content'
  if (fsClient) return new FileContentAdapter(fsClient as never, contentDir)

  throw new Error('No content adapter: set CONTENT KV binding or FS_CLIENT + CONTENT_DIR')
}

function createStorageAdapter(env: Env): StoragePort | undefined {
  const r2 = (env as Record<string, unknown>)['MEDIA']
  if (r2) return new R2StorageAdapter(r2 as never)

  const s3Client = (env as Record<string, unknown>)['S3_CLIENT']
  if (s3Client) return new S3StorageAdapter(s3Client as never)

  return undefined
}

// ── Config-Driven Adapter Factories ─────────────────────────────────────────
// Each factory takes the env and returns the adapter instance.
// To add a new implementation, add a case here.

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
  const configType = 'adapters' in config ? (config.adapters as Record<string, string>)[port] : undefined

  if (sosMode) {
    if (port === 'bus') return 'sos'
    if (port === 'memory') return 'mirror'
    if (port === 'economy') return 'sos'
  }

  return configType ?? 'standalone'
}

// ── Middleware ───────────────────────────────────────────────────────────────

export const adapterMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  // Infrastructure ports — auto-detect from env bindings
  const dbCore = createDatabaseAdapter(c.env, 'DB_CORE')
  c.set('db_core', dbCore)
  c.set('db_analytics', createDatabaseAdapter(c.env, 'DB_ANALYTICS'))
  c.set('db_marketing', createDatabaseAdapter(c.env, 'DB_MARKETING'))
  c.set('sessions', createSessionAdapter(c.env))
  c.set('content', createContentAdapter(c.env))

  const storage = createStorageAdapter(c.env)
  if (storage) c.set('storage', storage)

  // Config-driven ports — resolved from inkwell.config.ts + env overrides
  const tenant = c.get('tenant_slug') ?? 'default'

  c.set('graph', createGraphAdapter(resolveAdapterType('graph', c.env), dbCore))
  c.set('agent', createAgentAdapter(resolveAdapterType('agent', c.env), dbCore))
  c.set('bus', createBusAdapter(resolveAdapterType('bus', c.env), c.env, tenant))
  c.set('memory', createMemoryAdapter(resolveAdapterType('memory', c.env), c.env, tenant))
  c.set('economy', createEconomyAdapter(resolveAdapterType('economy', c.env), c.env))

  // SEO port — crawl logs, redirects, meta overrides (always D1)
  c.set('seo', new CfSeoAdapter({ db: dbCore }))

  // Feedback port — surveys, feature voting, classifications (uses DB_ANALYTICS)
  c.set('feedback', new CfFeedbackAdapter({ db: new D1DatabaseAdapter(c.env.DB_ANALYTICS) }))

  // Media port — R2 + D1 + Workers AI (Cloudflare-specific, requires R2 binding)
  const r2 = (c.env as Record<string, unknown>)['MEDIA']
  if (r2) {
    c.set('media', new CfMediaAdapter({
      r2: r2 as never,
      db: dbCore,
      ai: (c.env as Record<string, unknown>)['AI'] as never,
      siteUrl: c.env.SITE_URL,
    }))
  }

  return next()
}
