import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

/** Compute the cartesian product of an object of arrays */
function cartesian(vars: Record<string, string[]>): Record<string, string>[] {
  const keys = Object.keys(vars)
  if (keys.length === 0) return [{}]

  const result: Record<string, string>[] = []

  function recurse(depth: number, current: Record<string, string>): void {
    if (depth === keys.length) {
      result.push({ ...current })
      return
    }
    const key = keys[depth]
    for (const val of vars[key]) {
      current[key] = val
      recurse(depth + 1, current)
    }
  }

  recurse(0, {})
  return result
}

/** Replace all {variable} placeholders in a string */
function interpolate(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    // Replace all occurrences of {key}
    result = result.split(`{${key}}`).join(value)
  }
  return result
}

/** Slugify a string: lowercase, replace non-alphanumeric with -, trim dashes */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

/** Strip markdown formatting for description extraction */
function stripMarkdown(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_>\-\[\]`]/g, ' ')
    .trim()
}

/** Extract title from first line of markdown (strip heading markers) */
function extractTitle(template: string): string {
  const firstLine = template.split('\n')[0] ?? ''
  return firstLine.replace(/^#+\s*/, '').trim()
}

const MAX_PAGES = 500

export const generateMcpTools: McpToolDef[] = [
  {
    name: 'generate_pages',
    description:
      'Programmatic page generation from template + variables. Creates a cartesian product of all variable arrays and generates one page per combination. E.g. "Best {service} in {city}" with 5 services x 10 cities = 50 pages.',
    inputSchema: {
      type: 'object',
      properties: {
        template: {
          type: 'string',
          description:
            'Markdown template with {variable} placeholders. E.g. "# Best {service} in {city}\\n\\nLooking for {service} in {city}? ..."',
        },
        variables: {
          type: 'object',
          description:
            'Map of variable name to array of values. E.g. { "service": ["plumbing", "HVAC"], "city": ["Toronto", "Vancouver"] }',
          additionalProperties: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        collection: {
          type: 'string',
          description: 'Content collection name (e.g. "landing-pages")',
        },
        slug_template: {
          type: 'string',
          description:
            'Slug pattern with same variables. Default: auto-generate from title. E.g. "best-{service}-in-{city}"',
        },
        title_template: {
          type: 'string',
          description:
            'Title pattern. Default: first line of template stripped of markdown. E.g. "Best {service} in {city}"',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags to apply to all generated pages',
        },
        status: {
          type: 'string',
          enum: ['draft', 'published'],
          description: 'Publish status (default: draft)',
        },
        dry_run: {
          type: 'boolean',
          description: 'If true, return the list of pages that would be created without creating them',
        },
      },
      required: ['template', 'variables', 'collection'],
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env

      // ── Validate inputs ──────────────────────────────────────────────
      const template = typeof a.template === 'string' ? a.template : ''
      if (!template) return { error: 'template is required and must be a non-empty string' }

      const collection = typeof a.collection === 'string' ? a.collection.trim() : ''
      if (!collection) return { error: 'collection is required and must be a non-empty string' }

      // Validate variables: must be an object with string[] values
      if (typeof a.variables !== 'object' || a.variables === null || Array.isArray(a.variables)) {
        return { error: 'variables must be an object mapping variable names to string arrays' }
      }

      const rawVars = a.variables as Record<string, unknown>
      const variables: Record<string, string[]> = {}
      for (const [key, val] of Object.entries(rawVars)) {
        if (!Array.isArray(val)) {
          return { error: `variables.${key} must be an array of strings` }
        }
        const arr = val.filter((v): v is string => typeof v === 'string')
        if (arr.length === 0) {
          return { error: `variables.${key} must contain at least one string value` }
        }
        variables[key] = arr
      }

      if (Object.keys(variables).length === 0) {
        return { error: 'variables must contain at least one variable with values' }
      }

      const slugTemplate = typeof a.slug_template === 'string' ? a.slug_template : null
      const titleTemplate = typeof a.title_template === 'string' ? a.title_template : null
      const tags = Array.isArray(a.tags)
        ? (a.tags as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, 12)
        : []
      const status = a.status === 'published' ? 'published' : 'draft'
      const dryRun = a.dry_run === true

      // ── Compute cartesian product ────────────────────────────────────
      const combinations = cartesian(variables)

      if (combinations.length > MAX_PAGES) {
        return {
          error: `Too many pages: ${combinations.length} combinations exceeds the ${MAX_PAGES} page limit per call. Reduce variable arrays.`,
        }
      }

      if (combinations.length === 0) {
        return { error: 'No combinations produced from the given variables' }
      }

      // ── Derive title template if not provided ────────────────────────
      const effectiveTitleTemplate = titleTemplate ?? extractTitle(template)
      if (!effectiveTitleTemplate) {
        return { error: 'Could not derive a title. Provide title_template or start template with a heading.' }
      }

      const date = new Date().toISOString().slice(0, 10)
      const pages: Array<{ slug: string; title: string }> = []

      // ── Generate each page ───────────────────────────────────────────
      for (const combo of combinations) {
        const title = interpolate(effectiveTitleTemplate, combo)
        const content = interpolate(template, combo)

        const slug = slugTemplate
          ? slugify(interpolate(slugTemplate, combo))
          : slugify(title)

        if (!slug) continue

        const description = stripMarkdown(content).slice(0, 220)
        const wordCount = content.split(/\s+/).filter(Boolean).length

        pages.push({ slug, title })

        if (dryRun) continue

        // ── Build frontmatter + full markdown ────────────────────────
        const frontmatter = [
          `title: "${title}"`,
          `date: "${date}"`,
          `author: "generator"`,
          `tags: [${tags.map((t) => `"${t}"`).join(', ')}]`,
          `description: "${description}"`,
          `status: "${status}"`,
        ].join('\n')

        const markdown = `---\n${frontmatter}\n---\n\n${content}`

        const meta = JSON.stringify({
          title,
          slug,
          collection,
          author: 'generator',
          tags,
          description,
          date,
          status,
        })

        // ── Store in KV ──────────────────────────────────────────────
        await env.CONTENT.put(`post:${slug}`, markdown)
        await env.CONTENT.put(`meta:${slug}`, meta)

        // ── Index in D1 ──────────────────────────────────────────────
        await env.DB_ANALYTICS.prepare(
          'INSERT OR REPLACE INTO content_index (slug, title, type, lang, author, tags, description, published_at, updated_at, word_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
          .bind(
            slug,
            title,
            collection,
            'en',
            'generator',
            JSON.stringify(tags),
            description,
            date,
            date,
            wordCount,
          )
          .run()
      }

      return {
        ok: true,
        generated: pages.length,
        pages,
        dry_run: dryRun,
      }
    },
  },
]
