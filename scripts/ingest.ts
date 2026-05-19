/**
 * Inkwell v3 — Content Ingest Script
 * Processes content/inbox/ → content/en/{type}/
 * Validates frontmatter against the Astro content schema.
 */

import { readFileSync, readdirSync, renameSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, basename } from 'path'

const INBOX = join(process.cwd(), 'content/inbox')
const CONTENT_DIR = join(process.cwd(), 'content/en')

// Fields allowed by the Astro Zod schema (content.config.ts)
const ALLOWED_FIELDS = new Set([
  'title', 'date', 'author', 'tags', 'description', 'cover_image',
  'cover_video', 'status', 'toc', 'series', 'series_order', 'related',
  'newsletter', 'access', 'task_id', 'bounty', 'weight', 'contributors',
])

function parseFrontmatter(content: string): { data: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { data: {}, body: content }

  const data: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w[\w_]*)\s*:\s*(.+)/)
    if (m) data[m[1]] = m[2].trim()
  }
  return { data, body: match[2] }
}

function generateSlug(filename: string, title?: string): string {
  const base = title?.replace(/^["']|["']$/g, '') || filename.replace(/\.md$/, '')
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

function autoDescription(body: string): string {
  // Strip markdown formatting characters
  const plain = body
    .replace(/^#{1,6}\s+/gm, '')      // headings
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[[^\]]*\]\([^)]*\)/g, (m) => m.replace(/\[([^\]]*)\]\([^)]*\)/, '$1')) // links -> text
    .replace(/[*_~`>#\-\[\]]/g, '')    // remaining markdown chars
    .replace(/\n+/g, ' ')             // collapse newlines
    .replace(/\s+/g, ' ')             // collapse whitespace
    .trim()

  if (!plain) return ''

  // Take first sentence (ending with . ! or ?) if within 160 chars
  const sentenceMatch = plain.match(/^(.+?[.!?])\s/)
  if (sentenceMatch && sentenceMatch[1].length <= 160) {
    return sentenceMatch[1].replace(/"/g, '\\"')
  }

  // Otherwise take first 160 chars, break at last word boundary
  const truncated = plain.slice(0, 160)
  const lastSpace = truncated.lastIndexOf(' ')
  const result = lastSpace > 80 ? truncated.slice(0, lastSpace) : truncated
  return (result.endsWith('.') ? result : result + '...').replace(/"/g, '\\"')
}

function run() {
  if (!existsSync(INBOX)) {
    console.log('No inbox directory.')
    return
  }

  const files = readdirSync(INBOX).filter(f => f.endsWith('.md') && !f.startsWith('.'))
  if (files.length === 0) {
    console.log('Inbox empty.')
    return
  }

  console.log(`Found ${files.length} file(s).`)

  for (const file of files) {
    const filepath = join(INBOX, file)
    const raw = readFileSync(filepath, 'utf-8')
    const { data, body } = parseFrontmatter(raw)

    // Determine type and remove from frontmatter (type = directory, not a field)
    const type = data.type || 'blog'
    delete data.type

    const targetDir = join(CONTENT_DIR, type)
    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true })

    const slug = generateSlug(file, data.title)
    const now = new Date().toISOString().slice(0, 10)

    // Set defaults
    if (!data.title) data.title = `"${slug.replace(/-/g, ' ')}"`
    if (!data.date) data.date = `"${now}"`
    if (!data.author) data.author = '"Site Author"'
    if (!data.tags) data.tags = '[]'
    if (!data.description || data.description === '""' || data.description === "''") {
      data.description = `"${autoDescription(body)}"`
    }
    if (!data.status) data.status = '"published"'

    // Strip fields not in schema to prevent Zod validation errors
    const cleanData: Record<string, string> = {}
    for (const [key, value] of Object.entries(data)) {
      if (ALLOWED_FIELDS.has(key)) {
        cleanData[key] = value
      } else {
        console.log(`  Stripped unknown field: ${key}`)
      }
    }

    // Ensure numeric fields are not quoted
    if (cleanData.weight) {
      cleanData.weight = cleanData.weight.replace(/^["']|["']$/g, '')
    }
    if (cleanData.bounty) {
      cleanData.bounty = cleanData.bounty.replace(/^["']|["']$/g, '')
    }
    if (cleanData.series_order) {
      cleanData.series_order = cleanData.series_order.replace(/^["']|["']$/g, '')
    }

    // Rebuild frontmatter
    const lines = Object.entries(cleanData).map(([k, v]) => `${k}: ${v}`)
    const output = `---\n${lines.join('\n')}\n---\n${body}`
    const targetPath = join(targetDir, `${slug}.md`)

    writeFileSync(targetPath, output)
    renameSync(filepath, join(INBOX, `.processed-${file}`))
    console.log(`  ${file} → content/en/${type}/${slug}.md`)
  }

  console.log('Done.')
}

run()
