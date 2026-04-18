/**
 * Lightweight MDX compiler for Workers runtime.
 *
 * Processes raw MDX/markdown source into HTML with:
 * - YAML frontmatter extraction
 * - Wikilink resolution
 * - Block syntax rendering (::type[arg]{props} ... ::)
 *
 * This is a simplified pipeline for runtime/API ingestion.
 * Full MDX compilation (JSX, imports, components) happens at
 * build time via Astro.
 */

const WIKILINK_RE = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g
const BLOCK_OPEN_RE = /^::(\w+)(?:\[([^\]]*)\])?(?:\{([^}]*)\})?\s*$/
const BLOCK_CLOSE_RE = /^::$/
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/

export interface CompileResult {
  html: string
  wikilinks: string[]
  frontmatter: Record<string, unknown>
}

export interface CompileOptions {
  basePath?: string
  tenant?: string
}

export function compileMdx(source: string, options?: CompileOptions): CompileResult {
  const basePath = options?.basePath ?? '/'

  // 1. Extract frontmatter
  const { frontmatter, body } = extractFrontmatter(source)

  // 2. Extract and replace wikilinks
  const wikilinks: string[] = []
  const withLinks = body.replace(WIKILINK_RE, (_full, target: string, display?: string) => {
    const targetSlug = target.trim().toLowerCase().replace(/\s+/g, '-')
    const label = display?.trim() || target.trim()
    wikilinks.push(targetSlug)
    return `<a href="${basePath}${encodeURIComponent(targetSlug)}" class="wikilink">${escapeHtml(label)}</a>`
  })

  // 3. Process block syntax
  const html = processBlockSyntax(withLinks)

  return { html, wikilinks, frontmatter }
}

function extractFrontmatter(source: string): {
  frontmatter: Record<string, unknown>
  body: string
} {
  const match = FRONTMATTER_RE.exec(source)
  if (!match) {
    return { frontmatter: {}, body: source }
  }

  const yamlBlock = match[1]
  const body = source.slice(match[0].length).trim()
  const frontmatter = parseYaml(yamlBlock)

  return { frontmatter, body }
}

/**
 * Minimal YAML parser for frontmatter.
 * Handles: scalar values, quoted strings, arrays (inline and list syntax), booleans, numbers.
 * Does NOT handle: nested objects, multi-line strings, anchors, or other advanced YAML.
 */
function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = yaml.split('\n')
  let currentKey = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // List item continuation (  - value)
    if (trimmed.startsWith('- ') && currentKey) {
      const existing = result[currentKey]
      const itemValue = parseScalar(trimmed.slice(2).trim())
      if (Array.isArray(existing)) {
        existing.push(itemValue)
      } else {
        result[currentKey] = [itemValue]
      }
      continue
    }

    // Key: value pair
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue

    const key = trimmed.slice(0, colonIdx).trim()
    const rawValue = trimmed.slice(colonIdx + 1).trim()

    if (!key) continue
    currentKey = key

    if (rawValue === '') {
      // Might be followed by list items
      result[key] = []
      continue
    }

    // Inline array: [item1, item2]
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const inner = rawValue.slice(1, -1)
      result[key] = inner
        .split(',')
        .map((item) => parseScalar(item.trim()))
        .filter((item) => item !== '')
      continue
    }

    result[key] = parseScalar(rawValue)
  }

  return result
}

function parseScalar(value: string): unknown {
  if (!value) return ''

  // Quoted string
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  // Boolean
  if (value === 'true') return true
  if (value === 'false') return false

  // Null
  if (value === 'null' || value === '~') return null

  // Number
  const num = Number(value)
  if (!isNaN(num) && value !== '') return num

  // Date-like strings (ISO format) — keep as string
  return value
}

/**
 * Line-by-line state machine for block syntax.
 * Processes ::type[arg]{props} ... :: blocks into HTML.
 * Wraps non-block lines in <p> tags.
 */
function processBlockSyntax(input: string): string {
  const lines = input.split('\n')
  const output: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()

    // Check for block open
    const openMatch = BLOCK_OPEN_RE.exec(line)
    if (openMatch) {
      const blockType = openMatch[1]
      const arg = openMatch[2] ?? ''
      const rawProps = openMatch[3] ?? ''
      const props = parseProps(rawProps)

      // Single-line blocks (embed, metric)
      if (isSingleLineBlock(blockType)) {
        const html = renderBlock({ type: blockType, arg, props, content: '' })
        if (html) output.push(html)
        i++
        continue
      }

      // Multi-line: collect until closing ::
      const contentLines: string[] = []
      i++
      while (i < lines.length) {
        if (BLOCK_CLOSE_RE.test(lines[i].trim())) {
          i++
          break
        }
        contentLines.push(lines[i])
        i++
      }

      const content = contentLines.join('\n').trim()
      const html = renderBlock({ type: blockType, arg, props, content })
      if (html) output.push(html)
      continue
    }

    // Regular content — wrap non-empty lines in paragraphs
    if (line) {
      // Collect consecutive non-empty, non-block lines into one paragraph
      const paraLines: string[] = [line]
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim()
        if (!nextLine || BLOCK_OPEN_RE.test(nextLine)) break
        paraLines.push(nextLine)
        i++
      }
      output.push(`<p>${paraLines.join(' ')}</p>`)
    }

    i++
  }

  return output.join('\n')
}

// --- Block rendering (mirrors remark-blocks.ts) ---

interface BlockMatch {
  type: string
  arg: string
  props: Record<string, string>
  content: string
}

function isSingleLineBlock(type: string): boolean {
  return type === 'embed' || type === 'metric'
}

function renderBlock(block: BlockMatch): string | null {
  switch (block.type) {
    case 'tldr':
      return `<div class="ink-tldr"><span class="ink-tldr-label">TL;DR</span><p>${escapeHtml(block.content)}</p></div>`
    case 'pullquote':
      return `<blockquote class="ink-pullquote"><p>${escapeHtml(block.content)}</p></blockquote>`
    case 'callout': {
      const validTypes = ['info', 'warning', 'tip', 'danger']
      const ct = validTypes.includes(block.arg) ? block.arg : 'info'
      return `<div class="ink-callout ink-callout-${ct}"><p>${escapeHtml(block.content)}</p></div>`
    }
    case 'figure': {
      const src = escapeHtml(block.arg)
      const caption = escapeHtml(block.content)
      return `<figure class="ink-figure"><img src="${src}" alt="${caption}" loading="lazy"><figcaption>${caption}</figcaption></figure>`
    }
    case 'embed':
      return renderEmbed(block.arg.trim())
    case 'metric': {
      const value = escapeHtml(block.props.value || '0')
      const label = escapeHtml(block.props.label || '')
      const trend = block.props.trend || ''
      const arrows: Record<string, string> = { up: '\u2191', down: '\u2193', neutral: '\u2192' }
      const trendHtml = arrows[trend]
        ? `<span class="ink-metric-trend ink-metric-trend--${trend}">${arrows[trend]}</span>`
        : ''
      return `<div class="ink-metric"><span class="ink-metric-value">${value}</span><span class="ink-metric-label">${label}</span>${trendHtml}</div>`
    }
    case 'cta': {
      const url = escapeHtml(block.props.url || '#')
      const button = escapeHtml(block.props.button || 'Learn more')
      return `<div class="ink-cta"><p class="ink-cta-text">${escapeHtml(block.content)}</p><a href="${url}" class="ink-cta-button">${button}</a></div>`
    }
    case 'stats': {
      const rows = parseTableRows(block.content)
      const items = rows.map(([value, label]) =>
        `<div class="ink-stat"><span class="ink-stat-value">${escapeHtml(value.trim())}</span><span class="ink-stat-label">${escapeHtml(label.trim())}</span></div>`
      )
      return `<div class="ink-stats">${items.join('')}</div>`
    }
    case 'faq': {
      const pairs = parseFaqPairs(block.content)
      const items = pairs.map(([q, a]) =>
        `<details><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`
      )
      return `<div class="ink-faq">${items.join('')}</div>`
    }
    case 'chart': {
      const chartType = escapeHtml(block.arg || 'bar')
      const title = escapeHtml(block.props.title || '')
      const rows = parseTableRows(block.content)
      if (rows.length === 0) {
        return `<div class="ink-chart" data-type="${chartType}" data-title="${title}" data-values="[]"></div>`
      }
      const headers = rows[0].map((h) => h.trim())
      const dataRows = rows.slice(1)
      const values = dataRows.map((row) => {
        const obj: Record<string, string | number> = {}
        headers.forEach((header, idx) => {
          const raw = (row[idx] ?? '').trim()
          const num = Number(raw)
          obj[header] = isNaN(num) ? raw : num
        })
        return obj
      })
      const jsonData = JSON.stringify(values).replace(/"/g, '&quot;')
      return `<div class="ink-chart" data-type="${chartType}" data-title="${title}" data-values="${jsonData}"></div>`
    }
    case 'mermaid':
      return `<div class="ink-mermaid"><pre class="mermaid">${block.content}</pre></div>`
    case 'comparison': {
      const compTitle = block.props.title || ''
      const rows = parseTableRows(block.content)
      if (rows.length === 0) return `<div class="ink-comparison"></div>`
      const headers = rows[0]
      const headerCells = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
      let dataRows = rows.slice(1)
      let verdict = ''
      if (dataRows.length > 0) {
        const lastRow = dataRows[dataRows.length - 1]
        if (lastRow[0].trim().toLowerCase().startsWith('verdict')) {
          const verdictCells = lastRow.slice(1).map((c) => c.trim()).filter(Boolean)
          verdict = verdictCells.length > 0
            ? lastRow[0].trim() + ': ' + verdictCells.join(', ')
            : lastRow[0].trim()
          dataRows = dataRows.slice(0, -1)
        }
      }
      const bodyRows = dataRows
        .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
        .join('')
      const titleHtml = compTitle ? `<h4 class="ink-comparison-title">${escapeHtml(compTitle)}</h4>` : ''
      const verdictHtml = verdict ? `<p class="ink-comparison-verdict">${escapeHtml(verdict)}</p>` : ''
      return `<div class="ink-comparison">${titleHtml}<table class="ink-comparison-table"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>${verdictHtml}</div>`
    }
    case 'timeline': {
      const tLines = block.content.split('\n').map((l) => l.trim()).filter(Boolean)
      const items = tLines.map((tl) => {
        const parts = tl.split('|').map((p) => p.trim())
        return `<div class="ink-timeline-item"><span class="ink-timeline-date">${escapeHtml(parts[0] || '')}</span><span class="ink-timeline-dot"></span><div class="ink-timeline-content"><strong>${escapeHtml(parts[1] || '')}</strong><span>${escapeHtml(parts[2] || '')}</span></div></div>`
      })
      return `<div class="ink-timeline">${items.join('')}</div>`
    }
    case 'before-after': {
      const baLines = block.content.split('\n').map((l) => l.trim()).filter(Boolean)
      let beforeText = ''
      let afterText = ''
      for (const bl of baLines) {
        if (bl.toLowerCase().startsWith('before:')) beforeText = bl.slice(7).trim()
        else if (bl.toLowerCase().startsWith('after:')) afterText = bl.slice(6).trim()
      }
      return `<div class="ink-before-after"><div class="ink-before"><span class="ink-ba-label">Before</span><p>${escapeHtml(beforeText)}</p></div><div class="ink-after"><span class="ink-ba-label">After</span><p>${escapeHtml(afterText)}</p></div></div>`
    }
    default:
      return null
  }
}

function renderEmbed(url: string): string {
  const ytMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/
  )
  if (ytMatch) {
    return `<div class="ink-embed"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen loading="lazy" style="aspect-ratio:16/9;width:100%"></iframe></div>`
  }

  const twitterMatch = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/)
  if (twitterMatch) {
    return `<div class="ink-embed"><blockquote class="twitter-tweet"><a href="${escapeHtml(url)}"></a></blockquote><script async src="https://platform.twitter.com/widgets.js"></script></div>`
  }

  const codepenMatch = url.match(/codepen\.io\/([^/]+)\/pen\/([a-zA-Z0-9]+)/)
  if (codepenMatch) {
    const [, user, pen] = codepenMatch
    return `<div class="ink-embed"><iframe src="https://codepen.io/${user}/embed/${pen}?default-tab=result" frameborder="0" allowfullscreen loading="lazy" style="aspect-ratio:16/9;width:100%"></iframe></div>`
  }

  return `<div class="ink-embed"><iframe src="${escapeHtml(url)}" frameborder="0" allowfullscreen loading="lazy" style="aspect-ratio:16/9;width:100%"></iframe></div>`
}

// --- Shared helpers ---

function parseProps(raw: string): Record<string, string> {
  const props: Record<string, string> = {}
  const re = /(\w+)\s*=\s*"([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    props[m[1]] = m[2]
  }
  return props
}

function parseTableRows(content: string): string[][] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim())
    )
}

function parseFaqPairs(content: string): [string, string][] {
  const pairs: [string, string][] = []
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean)
  let currentQ = ''
  let currentA = ''

  for (const line of lines) {
    if (line.startsWith('Q:')) {
      if (currentQ && currentA) pairs.push([currentQ, currentA])
      currentQ = line.slice(2).trim()
      currentA = ''
    } else if (line.startsWith('A:')) {
      currentA = line.slice(2).trim()
    } else if (currentA) {
      currentA += ' ' + line
    } else if (currentQ) {
      currentQ += ' ' + line
    }
  }
  if (currentQ && currentA) pairs.push([currentQ, currentA])
  return pairs
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
