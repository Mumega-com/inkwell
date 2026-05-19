/**
 * Cache all built HTML from dist/ to Cloudflare KV for edge reads.
 *
 * Usage: npm run cache
 *
 * Env:
 *   CLOUDFLARE_API_TOKEN
 *   CLOUDFLARE_ACCOUNT_ID
 *   KV_NAMESPACE_ID
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { cacheContent } from '../src/lib/kv-cache.js'

function walkHtml(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      results.push(...walkHtml(full))
    } else if (entry.endsWith('.html')) {
      results.push(full)
    }
  }
  return results
}

function pathToSlug(filePath: string, distDir: string): string {
  let slug = relative(distDir, filePath)
    .replace(/\\/g, '/') // normalise Windows separators
    .replace(/\/index\.html$/, '') // dir/index.html -> dir
    .replace(/\.html$/, '') // page.html -> page

  // Root index.html becomes "index"
  if (slug === '' || slug === 'index') return 'index'
  return slug
}

async function main() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const kvNamespaceId = process.env.KV_NAMESPACE_ID

  if (!apiToken || !accountId || !kvNamespaceId) {
    process.stderr.write(
      'Missing env vars. Required: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, KV_NAMESPACE_ID\n',
    )
    process.exit(1)
  }

  const config = { accountId, kvNamespaceId, apiToken }
  const distDir = join(process.cwd(), 'dist')

  let files: string[]
  try {
    files = walkHtml(distDir)
  } catch {
    process.stderr.write(`Cannot read dist/ directory. Run "astro build" first.\n`)
    process.exit(1)
  }

  if (files.length === 0) {
    process.stdout.write('No HTML files found in dist/.\n')
    return
  }

  process.stdout.write(`Caching ${files.length} pages to KV...\n`)

  let success = 0
  let failed = 0

  for (const file of files) {
    const slug = pathToSlug(file, distDir)
    const html = readFileSync(file, 'utf-8')
    const metadata: Record<string, unknown> = {
      slug,
      cachedAt: new Date().toISOString(),
      sizeBytes: Buffer.byteLength(html, 'utf-8'),
    }

    try {
      await cacheContent(config, slug, html, metadata)
      process.stdout.write(`  cached: ${slug}\n`)
      success++
    } catch (err) {
      process.stderr.write(`  FAILED: ${slug} — ${err}\n`)
      failed++
    }
  }

  process.stdout.write(`\nDone: ${success} cached, ${failed} failed.\n`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`)
  process.exit(1)
})
