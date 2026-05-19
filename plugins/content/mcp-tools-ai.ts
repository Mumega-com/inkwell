import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

const DEFAULT_MAX_TAGS = 8
const ABSOLUTE_MAX_TAGS = 12

interface AiTagResponse {
  response?: string
}

interface ContentMeta {
  title?: string
  slug?: string
  author?: string
  tags?: string[]
  description?: string
  date?: string
  status?: string
}

function extractTagsFromResponse(raw: string, maxTags: number): string[] {
  // Try parsing as JSON array first
  const arrayMatch = raw.match(/\[[\s\S]*?\]/)
  if (arrayMatch) {
    try {
      const parsed: unknown = JSON.parse(arrayMatch[0])
      if (Array.isArray(parsed)) {
        return parsed
          .filter((t): t is string => typeof t === 'string')
          .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''))
          .filter((t) => t.length > 0)
          .slice(0, maxTags)
      }
    } catch {
      // fall through to line-based parsing
    }
  }

  // Fallback: split on commas or newlines, clean up
  return raw
    .split(/[,\n]+/)
    .map((t) =>
      t
        .replace(/^[\s\-*\d.]+/, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, ''),
    )
    .filter((t) => t.length > 1)
    .slice(0, maxTags)
}

export const aiMcpTools: McpToolDef[] = [
  {
    name: 'auto_tag_content',
    description:
      'Use Workers AI to analyze content and suggest relevant topic tags. Provide a slug (looks up from KV) or raw text. Optionally persists tags to KV meta and D1 index.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'Content slug to look up from KV (reads post:{slug})',
        },
        text: {
          type: 'string',
          description: 'Raw text to analyze (used if slug is not provided)',
        },
        max_tags: {
          type: 'number',
          description: `Maximum number of tags to return (default ${DEFAULT_MAX_TAGS}, max ${ABSOLUTE_MAX_TAGS})`,
        },
      },
      required: [],
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env

      if (!env.AI) {
        return { error: 'ai_not_configured', hint: 'Add [ai] binding to wrangler.toml' }
      }

      const slug = typeof a.slug === 'string' ? a.slug.trim() : undefined
      const rawText = typeof a.text === 'string' ? a.text.trim() : undefined

      if (!slug && !rawText) {
        return { error: 'input_required', hint: 'Provide either slug or text' }
      }

      const maxTags = Math.min(
        typeof a.max_tags === 'number' && a.max_tags > 0
          ? Math.floor(a.max_tags)
          : DEFAULT_MAX_TAGS,
        ABSOLUTE_MAX_TAGS,
      )

      let contentBody: string | undefined

      if (slug) {
        const kvContent = await env.CONTENT.get(`post:${slug}`)
        if (!kvContent) {
          return { error: 'not_found', slug, hint: 'No content found for this slug' }
        }
        // Strip frontmatter for analysis
        const bodyMatch = kvContent.match(/^---[\s\S]*?---\s*(.*)$/s)
        contentBody = bodyMatch ? bodyMatch[1].trim() : kvContent
      } else {
        contentBody = rawText
      }

      if (!contentBody || contentBody.length === 0) {
        return { error: 'empty_content', hint: 'Content body is empty' }
      }

      // Truncate to ~4000 chars to stay within model context limits
      const truncated = contentBody.slice(0, 4000)

      const prompt = `Analyze the following content and return a JSON array of ${maxTags} relevant topic tags. Tags should be lowercase, single words or hyphenated phrases. Return ONLY the JSON array, no other text.

Content:
${truncated}

Tags:`

      const aiResult = (await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
      })) as AiTagResponse

      const responseText = typeof aiResult?.response === 'string' ? aiResult.response : ''
      if (!responseText) {
        return { error: 'ai_empty_response', hint: 'Workers AI returned no response' }
      }

      const tags = extractTagsFromResponse(responseText, maxTags)

      if (tags.length === 0) {
        return { error: 'no_tags_extracted', hint: 'Could not parse tags from AI response' }
      }

      // Persist tags if slug was provided
      if (slug) {
        // Update D1 content_index
        try {
          await env.DB_ANALYTICS.prepare('UPDATE content_index SET tags = ? WHERE slug = ?')
            .bind(JSON.stringify(tags), slug)
            .run()
        } catch {
          // Non-fatal: index update failure should not block the response
        }

        // Update KV meta
        try {
          const metaRaw = await env.CONTENT.get(`meta:${slug}`)
          if (metaRaw) {
            const meta: ContentMeta = JSON.parse(metaRaw) as ContentMeta
            meta.tags = tags
            await env.CONTENT.put(`meta:${slug}`, JSON.stringify(meta))
          }
        } catch {
          // Non-fatal: meta update failure should not block the response
        }
      }

      return {
        ok: true,
        ...(slug ? { slug } : {}),
        tags,
        source: 'ai' as const,
      }
    },
  },
]
