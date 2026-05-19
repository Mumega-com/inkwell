import type { McpToolDef } from '../../kernel/types'
import type { AppBindings } from '../types'

type Env = AppBindings['Bindings']

export const contentMcpTools: McpToolDef[] = [
  {
    name: 'publish_content',
    description:
      'Publish or draft content to Inkwell. Creates a markdown entry stored in KV and indexed in D1.',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Content collection (e.g. blog, case-study)' },
        slug: { type: 'string', description: 'URL slug. Auto-derived from title if omitted.' },
        title: { type: 'string', description: 'Post title (required)' },
        content: { type: 'string', description: 'Markdown body (required)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tag list (max 12)' },
        status: {
          type: 'string',
          enum: ['draft', 'published'],
          description: 'Publish status (default: published)',
        },
        author: { type: 'string', description: 'Author name (default: agent)' },
        overwrite: { type: 'boolean', description: 'Replace existing slug if true (default: false)' },
      },
      required: ['collection', 'title', 'content'],
    },
    handler: async (a, rawEnv) => {
      const env = rawEnv as Env

      const title = typeof a.title === 'string' ? a.title.trim() : ''
      const content = typeof a.content === 'string' ? a.content.trim() : ''
      const slug =
        typeof a.slug === 'string'
          ? a.slug
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '')
              .slice(0, 80)
          : title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '')
              .slice(0, 80)
      const author = typeof a.author === 'string' ? a.author.trim().slice(0, 80) : 'agent'
      const tags = Array.isArray(a.tags)
        ? (a.tags as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, 12)
        : []
      const status = a.status === 'draft' ? 'draft' : 'published'
      const overwrite = a.overwrite === true

      if (!title) return { error: 'title required' }
      if (!content) return { error: 'content required' }
      if (!slug) return { error: 'invalid_slug' }

      if (!overwrite) {
        const existing = await env.CONTENT.get(`meta:${slug}`)
        if (existing) return { error: 'slug_exists', slug, hint: 'Set overwrite:true to replace' }
      }

      const date = new Date().toISOString().slice(0, 10)
      const description = content
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[#*_>\-\[\]`]/g, ' ')
        .trim()
        .slice(0, 220)

      const frontmatter = [
        `title: "${title}"`,
        `date: "${date}"`,
        `author: "${author}"`,
        `tags: [${tags.map((t) => `"${t}"`).join(', ')}]`,
        `description: "${description.slice(0, 220)}"`,
        `status: "${status}"`,
      ].join('\n')

      const markdown = `---\n${frontmatter}\n---\n\n${content}`

      await env.CONTENT.put(`post:${slug}`, markdown)
      await env.CONTENT.put(
        `meta:${slug}`,
        JSON.stringify({ title, slug, author, tags, description, date, status }),
      )

      await env.DB_ANALYTICS.prepare(
        'INSERT OR REPLACE INTO content_index (slug, title, type, lang, author, tags, description, published_at, updated_at, word_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(
          slug,
          title,
          'blog',
          'en',
          author,
          JSON.stringify(tags),
          description,
          date,
          date,
          content.split(/\s+/).length,
        )
        .run()

      let deployState = 'manual'
      if (env.CF_PAGES_DEPLOY_HOOK) {
        try {
          const resp = await fetch(env.CF_PAGES_DEPLOY_HOOK, { method: 'POST' })
          deployState = resp.ok ? 'triggered' : `trigger_failed_${resp.status}`
        } catch {
          deployState = 'trigger_failed'
        }
      }

      return {
        ok: true,
        slug,
        status,
        url: `${env.SITE_URL}/blog/${slug}`,
        deploy: deployState,
      }
    },
  },
]
