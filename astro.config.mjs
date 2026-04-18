import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
// sitemap handled by custom src/pages/sitemap.xml.ts
import mdx from '@astrojs/mdx'
import cloudflare from '@astrojs/cloudflare'
import remarkWikilinks from './src/lib/remark-wikilinks'
import remarkBlocks from './src/lib/remark-blocks'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

export default defineConfig({
  site: process.env.SITE_URL || 'https://example.com',
  // Auth handled at the edge by Cloudflare Access (JWT injection via inkwell-api Worker).
  // auth-astro removed — CF Access replaces the need for OAuth/magic-link flows.
  integrations: [react(), mdx()],
  image: { remotePatterns: [{ protocol: 'https' }] },
  markdown: {
    remarkPlugins: [remarkWikilinks, remarkBlocks, remarkMath],
    rehypePlugins: [rehypeKatex],
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
    routing: { prefixDefaultLocale: false },
  },
})