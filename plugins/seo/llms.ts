import { Hono } from 'hono'
import { config } from '../../inkwell.config'
import type { AppBindings } from '../types'

interface GraphNode {
  slug: string
  title: string
  type: string
  url: string | null
  description: string | null
  visibility: string
}

const llmsRoutes = new Hono<AppBindings>()

/**
 * GET /llms.txt — lightweight site summary for LLM crawlers.
 * Lists all public pages and blog posts with title, URL, and description.
 */
llmsRoutes.get('/llms.txt', async (c) => {
  const db = c.get('db_core')
  const siteUrl = c.env.SITE_URL || `https://${config.domain}`

  const nodes = await db.query<GraphNode>(
    `SELECT slug, title, type, url, description, visibility
     FROM graph_nodes
     WHERE visibility = 'public'
     ORDER BY type, title`
  )

  const docs = nodes.filter((n) => n.type === 'page' || n.type === 'doc')
  const blog = nodes.filter((n) => n.type === 'blog' || n.type === 'post')

  const lines: string[] = []
  lines.push(`# ${config.name}`)
  lines.push('')
  lines.push(`> ${config.tagline}`)
  lines.push('')

  if (config.seo.organization.knowsAbout.length > 0) {
    lines.push(config.seo.organization.knowsAbout.join(', ') + '.')
    lines.push('')
  }

  if (docs.length > 0) {
    lines.push('## Docs')
    lines.push('')
    for (const node of docs) {
      const url = node.url || `${siteUrl}/${node.slug}`
      const desc = node.description ? `: ${node.description}` : ''
      lines.push(`- [${node.title}](${url})${desc}`)
    }
    lines.push('')
  }

  if (blog.length > 0) {
    lines.push('## Blog')
    lines.push('')
    for (const node of blog) {
      const url = node.url || `${siteUrl}/${node.slug}`
      const desc = node.description ? `: ${node.description}` : ''
      lines.push(`- [${node.title}](${url})${desc}`)
    }
    lines.push('')
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
})

/**
 * GET /llms-full.txt — full site content for LLM crawlers.
 * Same structure as llms.txt but includes the full content body of each page.
 */
llmsRoutes.get('/llms-full.txt', async (c) => {
  const db = c.get('db_core')
  const content = c.get('content')
  const siteUrl = c.env.SITE_URL || `https://${config.domain}`

  const nodes = await db.query<GraphNode>(
    `SELECT slug, title, type, url, description, visibility
     FROM graph_nodes
     WHERE visibility = 'public'
     ORDER BY type, title`
  )

  const docs = nodes.filter((n) => n.type === 'page' || n.type === 'doc')
  const blog = nodes.filter((n) => n.type === 'blog' || n.type === 'post')

  const lines: string[] = []
  lines.push(`# ${config.name}`)
  lines.push('')
  lines.push(`> ${config.tagline}`)
  lines.push('')

  if (config.seo.organization.knowsAbout.length > 0) {
    lines.push(config.seo.organization.knowsAbout.join(', ') + '.')
    lines.push('')
  }

  if (docs.length > 0) {
    lines.push('## Docs')
    lines.push('')
    for (const node of docs) {
      const url = node.url || `${siteUrl}/${node.slug}`
      const desc = node.description ? `: ${node.description}` : ''
      lines.push(`- [${node.title}](${url})${desc}`)

      const page = await content.getPage(node.slug)
      if (page) {
        lines.push('')
        lines.push(page)
        lines.push('')
      }
    }
    lines.push('')
  }

  if (blog.length > 0) {
    lines.push('## Blog')
    lines.push('')
    for (const node of blog) {
      const url = node.url || `${siteUrl}/${node.slug}`
      const desc = node.description ? `: ${node.description}` : ''
      lines.push(`- [${node.title}](${url})${desc}`)

      const page = await content.getPage(node.slug)
      if (page) {
        lines.push('')
        lines.push(page)
        lines.push('')
      }
    }
    lines.push('')
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
})

export { llmsRoutes }
