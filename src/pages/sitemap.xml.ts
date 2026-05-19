import type { APIRoute } from 'astro'
import { safeGetCollection } from '../lib/safe-content'
import { config } from '../lib/config'

export const GET: APIRoute = async () => {
  const blog = await safeGetCollection('blog', (p) => p.data.status === 'published')
  const topics = await safeGetCollection('topics')
  const labs = await safeGetCollection('labs')
  const tools = await safeGetCollection('tools')
  const team = await safeGetCollection('team')
  const products = await safeGetCollection('products')
  const docs = await safeGetCollection('docs')

  const SITE = `https://${config.domain}`

  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/docs', priority: '0.9', changefreq: 'daily' },
    { url: '/topics', priority: '0.9', changefreq: 'daily' },
    { url: '/labs', priority: '0.8', changefreq: 'weekly' },
    { url: '/tools', priority: '0.8', changefreq: 'weekly' },
    { url: '/blog', priority: '0.8', changefreq: 'daily' },
    { url: '/team', priority: '0.7', changefreq: 'weekly' },
    { url: '/products', priority: '0.7', changefreq: 'weekly' },
    { url: '/vision', priority: '0.9', changefreq: 'monthly' },
    { url: '/about', priority: '0.8', changefreq: 'monthly' },
    { url: '/explore', priority: '0.6', changefreq: 'weekly' },
    { url: '/search', priority: '0.5', changefreq: 'monthly' },
    { url: '/privacy', priority: '0.3', changefreq: 'yearly' },
    { url: '/terms', priority: '0.3', changefreq: 'yearly' },
  ]

  const today = new Date().toISOString().split('T')[0]
  const allPages = [
    ...staticPages.map(p => ({ ...p, lastmod: today })),
    ...blog.map((p) => ({ url: `/blog/${p.id}`, priority: '0.7', changefreq: 'weekly' as const, lastmod: p.data.date ? new Date(p.data.date).toISOString().split('T')[0] : today })),
    ...topics.map((t) => ({ url: `/topics/${t.id}`, priority: '0.9', changefreq: 'daily' as const, lastmod: today })),
    ...labs.map((l) => ({ url: `/labs/${l.id}`, priority: '0.8', changefreq: 'weekly' as const, lastmod: today })),
    ...tools.map((t) => ({ url: `/tools/${t.id}`, priority: '0.8', changefreq: 'weekly' as const, lastmod: today })),
    ...team.map((m) => ({ url: `/team/${m.id}`, priority: '0.7', changefreq: 'weekly' as const, lastmod: today })),
    ...products.map((p) => ({ url: `/products/${p.id}`, priority: '0.7', changefreq: 'weekly' as const, lastmod: today })),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map((page) => `  <url>
    <loc>${SITE}${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
