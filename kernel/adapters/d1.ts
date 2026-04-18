/**
 * D1DatabaseAdapter — Cloudflare D1 implementation of DatabasePort.
 *
 * Wraps D1's .prepare().bind().first()/.all()/.run() API behind the
 * stable DatabasePort interface so plugins never import D1 types directly.
 */
import type { DatabasePort } from '../types'

/** Minimal D1 interface — avoids importing @cloudflare/workers-types in kernel. */
interface D1Binding {
  prepare(sql: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ meta: { changes: number } }>
}

export class D1DatabaseAdapter implements DatabasePort {
  constructor(private readonly db: D1Binding) {}

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const stmt = params?.length ? this.db.prepare(sql).bind(...params) : this.db.prepare(sql)
    const { results } = await stmt.all<T>()
    return results
  }

  async queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null> {
    const stmt = params?.length ? this.db.prepare(sql).bind(...params) : this.db.prepare(sql)
    return stmt.first<T>()
  }

  async execute(sql: string, params?: unknown[]): Promise<{ changes: number }> {
    const stmt = params?.length ? this.db.prepare(sql).bind(...params) : this.db.prepare(sql)
    const { meta } = await stmt.run()
    return { changes: meta.changes }
  }

  async batch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
    const prepared = statements.map(({ sql, params }) =>
      params?.length ? this.db.prepare(sql).bind(...params) : this.db.prepare(sql),
    )
    await this.db.batch(prepared)
  }
}
