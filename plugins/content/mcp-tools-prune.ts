/**
 * prune_content MCP tool — identifies underperforming content and optionally archives it.
 *
 * Scans content_index for thin content (below word count threshold) and stale
 * content (no updates past age threshold). Returns a report or auto-archives.
 */
import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

interface ContentRow {
  slug: string
  title: string
  word_count: number | null
  published_at: string | null
  updated_at: string | null
}

interface PruneCandidate {
  slug: string
  title: string
  reasons: string[]
  word_count: number | null
  published_at: string | null
  updated_at: string | null
}

interface MetaRecord {
  slug?: string
  title?: string
  status?: string
  [key: string]: unknown
}

export const pruneMcpTools: McpToolDef[] = [
  {
    name: 'prune_content',
    description:
      'Analyze content_index for underperforming pages (thin or stale) and optionally archive them. Use action "report" to preview candidates, "archive" to set status to archived.',
    inputSchema: {
      type: 'object',
      properties: {
        min_word_count: {
          type: 'number',
          description: 'Pages below this word count are flagged as thin content (default: 200)',
        },
        max_age_days: {
          type: 'number',
          description:
            'Pages older than this many days with no updates are flagged as stale (default: 180)',
        },
        action: {
          type: 'string',
          enum: ['report', 'archive'],
          description: 'report = list candidates only; archive = set status to archived (default: report)',
        },
        collection: {
          type: 'string',
          description: 'Limit analysis to a specific collection type (e.g. blog, wiki, case-study)',
        },
      },
      required: [],
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env

      const minWordCount =
        typeof a.min_word_count === 'number' && a.min_word_count > 0 ? a.min_word_count : 200
      const maxAgeDays =
        typeof a.max_age_days === 'number' && a.max_age_days > 0 ? a.max_age_days : 180
      const action = a.action === 'archive' ? 'archive' : 'report'
      const collection = typeof a.collection === 'string' ? a.collection.trim() : null

      // Build thin-content query
      const thinParams: (string | number)[] = [minWordCount]
      let thinSql =
        "SELECT slug, title, word_count, published_at, updated_at FROM content_index WHERE word_count < ? AND status != 'archived'"
      if (collection) {
        thinSql += ' AND type = ?'
        thinParams.push(collection)
      }

      // Build stale-content query
      const staleParams: (string | number)[] = [maxAgeDays]
      let staleSql = `SELECT slug, title, word_count, published_at, updated_at FROM content_index WHERE updated_at < date('now', '-' || ? || ' days') AND status != 'archived'`
      if (collection) {
        staleSql += ' AND type = ?'
        staleParams.push(collection)
      }

      const [thinResult, staleResult] = await Promise.all([
        env.DB_ANALYTICS.prepare(thinSql)
          .bind(...thinParams)
          .all<ContentRow>(),
        env.DB_ANALYTICS.prepare(staleSql)
          .bind(...staleParams)
          .all<ContentRow>(),
      ])

      const thinRows = thinResult.results ?? []
      const staleRows = staleResult.results ?? []

      // Deduplicate by slug and build reason arrays
      const candidateMap = new Map<string, PruneCandidate>()

      for (const row of thinRows) {
        candidateMap.set(row.slug, {
          slug: row.slug,
          title: row.title,
          reasons: [`thin_content: ${row.word_count ?? 0} words`],
          word_count: row.word_count,
          published_at: row.published_at,
          updated_at: row.updated_at,
        })
      }

      for (const row of staleRows) {
        const existing = candidateMap.get(row.slug)
        const reason = `stale: last updated ${row.updated_at ?? 'unknown'}`
        if (existing) {
          existing.reasons.push(reason)
        } else {
          candidateMap.set(row.slug, {
            slug: row.slug,
            title: row.title,
            reasons: [reason],
            word_count: row.word_count,
            published_at: row.published_at,
            updated_at: row.updated_at,
          })
        }
      }

      const candidates = Array.from(candidateMap.values())
      let archived = 0

      if (action === 'archive' && candidates.length > 0) {
        const now = new Date().toISOString().slice(0, 10)

        for (const candidate of candidates) {
          // Update D1 status
          await env.DB_ANALYTICS.prepare(
            "UPDATE content_index SET status = 'archived', updated_at = ? WHERE slug = ?",
          )
            .bind(now, candidate.slug)
            .run()

          // Update KV meta
          const rawMeta = await env.CONTENT.get(`meta:${candidate.slug}`)
          if (rawMeta) {
            try {
              const meta = JSON.parse(rawMeta) as MetaRecord
              meta.status = 'archived'
              await env.CONTENT.put(`meta:${candidate.slug}`, JSON.stringify(meta))
            } catch {
              // KV meta was not valid JSON — overwrite with minimal archived record
              await env.CONTENT.put(
                `meta:${candidate.slug}`,
                JSON.stringify({ slug: candidate.slug, title: candidate.title, status: 'archived' }),
              )
            }
          }

          archived++
        }
      }

      return {
        ok: true,
        action,
        candidates,
        total: candidates.length,
        archived,
      }
    },
  },
]
