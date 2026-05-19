/**
 * Inkwell v3 — OG Image Generator
 * Generates 1200x630 Open Graph images for each blog post using Playwright.
 * Output: public/media/og/{slug}.png
 */

import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join, basename } from 'path'
import { chromium } from 'playwright'
import { config } from '../inkwell.config'

const BLOG_DIR = join(process.cwd(), 'content/en/blog')
const OUT_DIR = join(process.cwd(), 'public/media/og')

interface PostMeta {
  slug: string
  title: string
  author: string
  date: string
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const data: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w[\w_]*)\s*:\s*(.+)/)
    if (m) data[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return data
}

function collectPosts(): PostMeta[] {
  if (!existsSync(BLOG_DIR)) {
    console.error(`Blog directory not found: ${BLOG_DIR}`)
    return []
  }

  const files = readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'))
  return files.map(file => {
    const raw = readFileSync(join(BLOG_DIR, file), 'utf-8')
    const data = parseFrontmatter(raw)
    const slug = basename(file, '.md')
    return {
      slug,
      title: data.title || slug.replace(/-/g, ' '),
      author: data.author || (config.seo?.defaultAuthor?.name ?? 'Site Author'),
      date: data.date || '',
    }
  })
}

function buildHtml(post: PostMeta): string {
  const escaped = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: 1200px;
    height: 630px;
    background: #0A0A10;
    font-family: 'JetBrains Mono', monospace;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 72px 80px 56px;
    overflow: hidden;
  }

  .top-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .accent-line {
    width: 48px;
    height: 3px;
    background: #D4A017;
    border-radius: 2px;
  }

  .label {
    font-size: 14px;
    color: #D4A017;
    text-transform: uppercase;
    letter-spacing: 3px;
    font-weight: 700;
  }

  .title {
    color: #D4A017;
    font-size: ${post.title.length > 60 ? '36' : post.title.length > 40 ? '42' : '48'}px;
    font-weight: 700;
    line-height: 1.2;
    max-height: 300px;
    overflow: hidden;
  }

  .bottom {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .author {
    font-size: 18px;
    color: #E0E0E0;
    font-weight: 400;
  }

  .date {
    font-size: 14px;
    color: #666;
  }

  .domain {
    font-size: 16px;
    color: #444;
    letter-spacing: 1px;
  }

  .grid {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image:
      linear-gradient(rgba(212, 160, 23, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(212, 160, 23, 0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }
</style>
</head>
<body>
  <div class="grid"></div>
  <div>
    <div class="top-bar">
      <div class="accent-line"></div>
      <span class="label">Blog</span>
    </div>
    <div class="title">${escaped(post.title)}</div>
  </div>
  <div class="bottom">
    <div class="meta">
      <div class="author">${escaped(post.author)}</div>
      ${post.date ? `<div class="date">${escaped(post.date)}</div>` : ''}
    </div>
    <div class="domain">${escaped(config.domain)}</div>
  </div>
</body>
</html>`
}

async function run() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

  const posts = collectPosts()
  if (posts.length === 0) {
    console.log('No blog posts found.')
    return
  }

  console.log(`Generating OG images for ${posts.length} post(s)...`)

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
  })

  for (const post of posts) {
    const page = await context.newPage()
    const html = buildHtml(post)
    await page.setContent(html, { waitUntil: 'networkidle' })
    const outPath = join(OUT_DIR, `${post.slug}.png`)
    await page.screenshot({ path: outPath, type: 'png' })
    await page.close()
    console.log(`  ${post.slug}.png`)
  }

  await browser.close()
  console.log('Done.')
}

run().catch((err) => {
  console.error('OG generation failed:', err)
  process.exit(1)
})
