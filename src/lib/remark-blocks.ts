import type { Root, Paragraph, Text } from 'mdast'
import { visit } from 'unist-util-visit'

/**
 * Remark plugin that transforms ::type[arg]{props} blocks into
 * HTML that Inkwell Astro components can render.
 *
 * Syntax:
 *   ::type[arg]{key="value"}
 *   content lines
 *   ::
 *
 * Single-line (no closing ::) for embeds:
 *   ::embed[https://youtube.com/watch?v=abc]
 */
export default function remarkBlocks() {
  return (tree: Root) => {
    // Collect all raw text to find block boundaries
    const rawLines = flattenToLines(tree)
    if (!rawLines.length) return

    // Process the tree — replace paragraph sequences that form blocks
    processBlocks(tree)
  }
}

const BLOCK_OPEN_RE = /^::(\w+)(?:\[([^\]]*)\])?(?:\{([^}]*)\})?\s*$/
const BLOCK_CLOSE_RE = /^::$/

interface BlockMatch {
  type: string
  arg: string
  props: Record<string, string>
  content: string
}

function processBlocks(tree: Root): void {
  const children = tree.children
  let i = 0

  while (i < children.length) {
    const node = children[i]
    const text = getNodeText(node)

    if (!text) {
      i++
      continue
    }

    const lines = text.split('\n')
    const firstLine = lines[0].trim()
    const openMatch = BLOCK_OPEN_RE.exec(firstLine)

    if (!openMatch) {
      i++
      continue
    }

    const blockType = openMatch[1]
    const arg = openMatch[2] ?? ''
    const rawProps = openMatch[3] ?? ''
    const props = parseProps(rawProps)

    // Check if this is a self-closing single-line block (like ::embed[url])
    if (lines.length === 1 && isSingleLineBlock(blockType)) {
      const html = renderBlock({ type: blockType, arg, props, content: '' })
      if (html) {
        children.splice(i, 1, { type: 'html', value: html })
      }
      i++
      continue
    }

    // Multi-line: collect content until we find a closing ::
    const contentLines: string[] = []
    let closingNodeIndex = -1
    let closingLineInNode = -1

    // Content might be in the same node after the first line
    if (lines.length > 1) {
      for (let li = 1; li < lines.length; li++) {
        if (BLOCK_CLOSE_RE.test(lines[li].trim())) {
          closingNodeIndex = i
          closingLineInNode = li
          break
        }
        contentLines.push(lines[li])
      }
    }

    // If not closed in the same node, look at subsequent nodes
    if (closingNodeIndex === -1) {
      for (let j = i + 1; j < children.length; j++) {
        const sibText = getNodeText(children[j])
        if (!sibText) continue

        const sibLines = sibText.split('\n')
        let foundClose = false

        for (let li = 0; li < sibLines.length; li++) {
          if (BLOCK_CLOSE_RE.test(sibLines[li].trim())) {
            closingNodeIndex = j
            closingLineInNode = li
            foundClose = true
            break
          }
          contentLines.push(sibLines[li])
        }

        if (foundClose) break
      }
    }

    if (closingNodeIndex === -1) {
      // No closing tag found — treat as single-line or skip
      if (isSingleLineBlock(blockType)) {
        const remainingContent = lines.slice(1).join('\n')
        const html = renderBlock({ type: blockType, arg, props, content: remainingContent })
        if (html) {
          children.splice(i, 1, { type: 'html', value: html })
        }
      }
      i++
      continue
    }

    const content = contentLines.join('\n').trim()
    const html = renderBlock({ type: blockType, arg, props, content })

    if (html) {
      const removeCount = closingNodeIndex - i + 1
      children.splice(i, removeCount, { type: 'html', value: html })
    }

    i++
  }

  // Recurse into children that have their own children arrays
  for (const child of tree.children) {
    if ('children' in child && Array.isArray(child.children)) {
      processBlocks(child as unknown as Root)
    }
  }
}

function isSingleLineBlock(type: string): boolean {
  return type === 'embed' || type === 'metric'
}

function renderBlock(block: BlockMatch): string | null {
  switch (block.type) {
    case 'tldr':
      return renderTldr(block)
    case 'pullquote':
      return renderPullquote(block)
    case 'callout':
      return renderCallout(block)
    case 'figure':
      return renderFigure(block)
    case 'stats':
      return renderStats(block)
    case 'faq':
      return renderFaq(block)
    case 'embed':
      return renderEmbed(block)
    case 'chart':
      return renderChart(block)
    case 'mermaid':
      return renderMermaid(block)
    case 'comparison':
      return renderComparison(block)
    case 'timeline':
      return renderTimeline(block)
    case 'metric':
      return renderMetric(block)
    case 'cta':
      return renderCta(block)
    case 'before-after':
      return renderBeforeAfter(block)
    default:
      return null
  }
}

function renderTldr(block: BlockMatch): string {
  const inner = escapeHtml(block.content)
  return `<div class="ink-tldr"><span class="ink-tldr-label">TL;DR</span><p>${inner}</p></div>`
}

function renderPullquote(block: BlockMatch): string {
  const inner = escapeHtml(block.content)
  return `<blockquote class="ink-pullquote"><p>${inner}</p></blockquote>`
}

function renderCallout(block: BlockMatch): string {
  const validTypes = ['info', 'warning', 'tip', 'danger'] as const
  const calloutType = validTypes.includes(block.arg as typeof validTypes[number])
    ? block.arg
    : 'info'
  const inner = escapeHtml(block.content)
  return `<div class="ink-callout ink-callout-${calloutType}"><p>${inner}</p></div>`
}

function renderFigure(block: BlockMatch): string {
  const src = escapeHtml(block.arg)
  const caption = escapeHtml(block.content)
  return `<figure class="ink-figure"><img src="${src}" alt="${caption}" loading="lazy"><figcaption>${caption}</figcaption></figure>`
}

function renderStats(block: BlockMatch): string {
  const rows = parseTableRows(block.content)
  const items = rows.map(([value, label]) => {
    const v = escapeHtml(value.trim())
    const l = escapeHtml(label.trim())
    return `<div class="ink-stat"><span class="ink-stat-value">${v}</span><span class="ink-stat-label">${l}</span></div>`
  })
  return `<div class="ink-stats">${items.join('')}</div>`
}

function renderFaq(block: BlockMatch): string {
  const pairs = parseFaqPairs(block.content)
  const items = pairs.map(([q, a]) => {
    const question = escapeHtml(q)
    const answer = escapeHtml(a)
    return `<details><summary>${question}</summary><p>${answer}</p></details>`
  })
  return `<div class="ink-faq">${items.join('')}</div>`
}

function renderEmbed(block: BlockMatch): string {
  const url = block.arg.trim()

  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/
  )
  if (ytMatch) {
    const videoId = ytMatch[1]
    return `<div class="ink-embed"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen loading="lazy" style="aspect-ratio:16/9;width:100%"></iframe></div>`
  }

  // Twitter/X
  const twitterMatch = url.match(
    /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/
  )
  if (twitterMatch) {
    return `<div class="ink-embed"><blockquote class="twitter-tweet"><a href="${escapeHtml(url)}"></a></blockquote><script async src="https://platform.twitter.com/widgets.js"></script></div>`
  }

  // CodePen
  const codepenMatch = url.match(
    /codepen\.io\/([^/]+)\/pen\/([a-zA-Z0-9]+)/
  )
  if (codepenMatch) {
    const [, user, pen] = codepenMatch
    return `<div class="ink-embed"><iframe src="https://codepen.io/${user}/embed/${pen}?default-tab=result" frameborder="0" allowfullscreen loading="lazy" style="aspect-ratio:16/9;width:100%"></iframe></div>`
  }

  // Generic iframe fallback
  return `<div class="ink-embed"><iframe src="${escapeHtml(url)}" frameborder="0" allowfullscreen loading="lazy" style="aspect-ratio:16/9;width:100%"></iframe></div>`
}

function renderChart(block: BlockMatch): string {
  const chartType = escapeHtml(block.arg || 'bar')
  const title = escapeHtml(block.props.title || '')
  const rows = parseTableRows(block.content)

  if (rows.length === 0) {
    return `<div class="ink-chart" data-type="${chartType}" data-title="${title}" data-values="[]"></div>`
  }

  // First row is headers
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

function renderMermaid(block: BlockMatch): string {
  // Mermaid content must not be HTML-escaped — the library parses the raw diagram syntax
  return `<div class="ink-mermaid"><pre class="mermaid">${block.content}</pre></div>`
}

function renderComparison(block: BlockMatch): string {
  const title = block.props.title || ''
  const rows = parseTableRows(block.content)

  if (rows.length === 0) {
    return `<div class="ink-comparison"></div>`
  }

  // First row = headers
  const headers = rows[0]
  const headerCells = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')

  // Check if last row starts with "Verdict"
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

  const titleHtml = title
    ? `<h4 class="ink-comparison-title">${escapeHtml(title)}</h4>`
    : ''
  const verdictHtml = verdict
    ? `<p class="ink-comparison-verdict">${escapeHtml(verdict)}</p>`
    : ''

  return `<div class="ink-comparison">${titleHtml}<table class="ink-comparison-table"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>${verdictHtml}</div>`
}

function renderTimeline(block: BlockMatch): string {
  const lines = block.content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const items = lines.map((line) => {
    const parts = line.split('|').map((p) => p.trim())
    const date = escapeHtml(parts[0] || '')
    const title = escapeHtml(parts[1] || '')
    const desc = escapeHtml(parts[2] || '')
    return `<div class="ink-timeline-item"><span class="ink-timeline-date">${date}</span><span class="ink-timeline-dot"></span><div class="ink-timeline-content"><strong>${title}</strong><span>${desc}</span></div></div>`
  })

  return `<div class="ink-timeline">${items.join('')}</div>`
}

function renderMetric(block: BlockMatch): string {
  const value = escapeHtml(block.props.value || '0')
  const label = escapeHtml(block.props.label || '')
  const trend = block.props.trend || ''
  const validTrends = ['up', 'down', 'neutral'] as const
  const trendValue = validTrends.includes(trend as typeof validTrends[number]) ? trend : ''

  const arrows: Record<string, string> = { up: '\u2191', down: '\u2193', neutral: '\u2192' }
  const trendHtml = trendValue
    ? `<span class="ink-metric-trend ink-metric-trend--${trendValue}">${arrows[trendValue]}</span>`
    : ''

  return `<div class="ink-metric"><span class="ink-metric-value">${value}</span><span class="ink-metric-label">${label}</span>${trendHtml}</div>`
}

function renderCta(block: BlockMatch): string {
  const url = escapeHtml(block.props.url || '#')
  const button = escapeHtml(block.props.button || 'Learn more')
  const text = escapeHtml(block.content)
  return `<div class="ink-cta"><p class="ink-cta-text">${text}</p><a href="${url}" class="ink-cta-button">${button}</a></div>`
}

function renderBeforeAfter(block: BlockMatch): string {
  const lines = block.content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  let beforeText = ''
  let afterText = ''

  for (const line of lines) {
    if (line.toLowerCase().startsWith('before:')) {
      beforeText = line.slice(7).trim()
    } else if (line.toLowerCase().startsWith('after:')) {
      afterText = line.slice(6).trim()
    }
  }

  return `<div class="ink-before-after"><div class="ink-before"><span class="ink-ba-label">Before</span><p>${escapeHtml(beforeText)}</p></div><div class="ink-after"><span class="ink-ba-label">After</span><p>${escapeHtml(afterText)}</p></div></div>`
}

// --- Helpers ---

function getNodeText(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null
  const n = node as Record<string, unknown>

  if (n.type === 'text' && typeof n.value === 'string') return n.value
  if (n.type === 'paragraph' && Array.isArray(n.children)) {
    return (n.children as Array<Record<string, unknown>>)
      .map((c) => {
        if (c.type === 'text' && typeof c.value === 'string') return c.value
        return ''
      })
      .join('')
  }
  return null
}

function flattenToLines(tree: Root): string[] {
  const lines: string[] = []
  visit(tree, 'text', (node: Text) => {
    lines.push(...node.value.split('\n'))
  })
  return lines
}

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
      if (currentQ && currentA) {
        pairs.push([currentQ, currentA])
      }
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

  if (currentQ && currentA) {
    pairs.push([currentQ, currentA])
  }

  return pairs
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
