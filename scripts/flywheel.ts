/**
 * Content flywheel — monitors RSS feeds for trending topics
 * and generates content briefs scored by relevance to our tags.
 *
 * Usage: npm run flywheel
 */

const FEEDS = [
  { url: 'https://hnrss.org/newest?q=ai+agents', name: 'HN AI Agents' },
  { url: 'https://hnrss.org/newest?q=cms', name: 'HN CMS' },
]

const OUR_TAGS = ['ai-agents', 'cms', 'workforce', 'solana', 'cloudflare', 'economy']

/** Normalised keywords derived from each tag (lowercase, no hyphens). */
const TAG_KEYWORDS = OUR_TAGS.map((t) => t.replace(/-/g, ' '))

interface FeedItem {
  source: string
  title: string
  link: string
  matchedTags: string[]
  score: number
}

/** Extract <item> blocks from RSS XML using simple regex. */
function parseItems(xml: string, sourceName: string): FeedItem[] {
  const items: FeedItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match: RegExpExecArray | null

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const title = block.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/)
    const link = block.match(/<link>(.*?)<\/link>/)

    const titleText = title?.[1] ?? title?.[2] ?? '(no title)'
    const linkText = link?.[1] ?? ''

    const lower = titleText.toLowerCase()
    const matched: string[] = []
    for (let i = 0; i < OUR_TAGS.length; i++) {
      if (lower.includes(TAG_KEYWORDS[i])) {
        matched.push(OUR_TAGS[i])
      }
    }

    items.push({
      source: sourceName,
      title: titleText,
      link: linkText,
      matchedTags: matched,
      score: matched.length,
    })
  }

  return items
}

function suggestAngle(title: string): string {
  const lower = title.toLowerCase()
  if (lower.includes('launch') || lower.includes('release'))
    return 'How our decentralized approach differs from centralized marketplaces'
  if (lower.includes('open source') || lower.includes('oss'))
    return 'Why open-source infrastructure matters for sovereign AI'
  if (lower.includes('raise') || lower.includes('funding') || lower.includes('valuation'))
    return 'Building sustainable AI without VC dependency'
  if (lower.includes('agent') || lower.includes('autonomous'))
    return 'Lessons from running multi-agent teams in production'
  return 'Industry context and what it means for decentralized AI infrastructure'
}

function suggestType(score: number): string {
  if (score >= 3) return 'deep-dive'
  if (score >= 2) return 'reaction'
  return 'quick-take'
}

async function main() {
  const allItems: FeedItem[] = []

  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url)
      if (!res.ok) {
        process.stderr.write(`Failed to fetch ${feed.name}: ${res.status}\n`)
        continue
      }
      const xml = await res.text()
      const items = parseItems(xml, feed.name)
      allItems.push(...items)
    } catch (err) {
      process.stderr.write(`Error fetching ${feed.name}: ${err}\n`)
    }
  }

  // Sort by score descending, then by title alphabetically for stability
  allItems.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))

  const top = allItems.slice(0, 5)

  if (top.length === 0) {
    process.stdout.write('No items found in feeds.\n')
    return
  }

  for (const item of top) {
    const tagLine =
      item.matchedTags.length > 0
        ? `${item.score}/${OUR_TAGS.length} tags match (${item.matchedTags.join(', ')})`
        : '0 tags match'

    process.stdout.write(
      [
        '=== Content Brief ===',
        `Source: ${item.source}`,
        `Title: "${item.title}"`,
        `URL: ${item.link}`,
        `Relevance: ${tagLine}`,
        `Suggested angle: ${suggestAngle(item.title)}`,
        `Suggested type: ${suggestType(item.score)}`,
        '===',
        '',
      ].join('\n'),
    )
  }
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`)
  process.exit(1)
})
