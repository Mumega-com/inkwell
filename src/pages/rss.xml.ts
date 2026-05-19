import type { APIRoute } from 'astro'
import { safeGetCollection } from '../lib/safe-content'
import { config } from '../lib/config'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export const GET: APIRoute = async () => {
  const allPosts = await safeGetCollection('blog', (entry) => entry.data.status === 'published')
  const posts = allPosts.sort(
    (a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime()
  )

  const siteUrl = `https://${config.domain}`

  const items = posts
    .map((post) => {
      const link = `${siteUrl}/blog/${post.id}`
      const pubDate = new Date(post.data.date).toUTCString()

      return `    <item>
      <title>${escapeXml(post.data.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>${escapeXml(post.data.author)}</author>${
        post.data.description
          ? `\n      <description>${escapeXml(post.data.description)}</description>`
          : ''
      }${
        post.data.tags.length > 0
          ? post.data.tags.map((tag) => `\n      <category>${escapeXml(tag)}</category>`).join('')
          : ''
      }
    </item>`
    })
    .join('\n')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(config.name)}</title>
    <description>${escapeXml(config.tagline)}</description>
    <link>${siteUrl}</link>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Inkwell</generator>
${items}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
