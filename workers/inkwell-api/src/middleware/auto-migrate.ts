/**
 * Auto-migrate middleware — applies D1 migrations on first request.
 *
 * Tracks applied migrations in a `_migrations` table per database.
 * Each migration runs inside a try/catch with IF NOT EXISTS patterns,
 * so re-running is safe. Uses a module-level flag to only run once
 * per worker instance (cold start).
 */

import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../types'
import { compiledMigrations } from '../migrations-compiled'
import type { D1Database } from '@cloudflare/workers-types'

let migrated = false

export const autoMigrate: MiddlewareHandler<AppBindings> = async (c, next) => {
  if (migrated) return next()

  const dbMap: Record<string, D1Database> = {
    DB_ANALYTICS: c.env.DB_ANALYTICS,
    DB_CORE: c.env.DB_CORE,
    DB_MARKETING: c.env.DB_MARKETING,
  }

  for (const { binding, migrations } of compiledMigrations) {
    const db = dbMap[binding]
    if (!db) continue

    // Ensure tracking table exists
    await db.prepare(
      'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime(\'now\')))',
    ).run()

    // Get already-applied migrations
    const { results } = await db.prepare('SELECT name FROM _migrations').all<{ name: string }>()
    const applied = new Set((results ?? []).map(r => r.name))

    for (const migration of migrations) {
      if (applied.has(migration.name)) continue

      // Split on semicolons and run each statement individually
      // D1's batch API is more reliable than exec() for multi-statement SQL
      const statements = migration.sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      for (const stmt of statements) {
        try {
          await db.prepare(stmt).run()
        } catch {
          // Tolerate errors from ALTER TABLE ADD COLUMN on existing columns,
          // CREATE INDEX on existing indexes, etc. The migration SQL uses
          // IF NOT EXISTS where possible but ALTER TABLE doesn't support it.
        }
      }

      await db.prepare('INSERT INTO _migrations (name) VALUES (?)').bind(migration.name).run()
    }
  }

  migrated = true
  return next()
}
