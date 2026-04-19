/**
 * PostgresDatabaseAdapter — Postgres implementation of DatabasePort.
 *
 * Accepts any client that implements the PgClient interface below.
 * Compatible with:
 *   - @neondatabase/serverless (Cloudflare Workers, edge)
 *   - postgres (Node.js, Deno)
 *   - pg (Node.js)
 *   - Supabase client
 *
 * SQL parameterization: D1 uses ? placeholders, Postgres uses $1, $2, etc.
 * This adapter accepts both — it converts ? to $N before executing.
 */
import type { DatabasePort } from '../types'

/** Minimal interface for a Postgres client — keep this narrow so many libs fit. */
export interface PgClient {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }>
}

/** Convert D1-style ? placeholders to Postgres $N placeholders */
function convertPlaceholders(sql: string): string {
  let idx = 0
  return sql.replace(/\?/g, () => `$${++idx}`)
}

export class PostgresDatabaseAdapter implements DatabasePort {
  constructor(private readonly client: PgClient) {}

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const { rows } = await this.client.query<T>(convertPlaceholders(sql), params)
    return rows
  }

  async queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null> {
    const { rows } = await this.client.query<T>(convertPlaceholders(sql), params)
    return rows[0] ?? null
  }

  async execute(sql: string, params?: unknown[]): Promise<{ changes: number }> {
    const { rowCount } = await this.client.query(convertPlaceholders(sql), params)
    return { changes: rowCount }
  }

  async batch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
    for (const { sql, params } of statements) {
      await this.client.query(convertPlaceholders(sql), params)
    }
  }
}
