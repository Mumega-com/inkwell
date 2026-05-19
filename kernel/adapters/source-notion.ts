/**
 * NotionContentSource — Notion database implementation of ContentSourcePort.
 *
 * Fetches pages from a Notion database via the public API, converts blocks
 * to markdown, and returns them as ContentSourceItems. Uses only fetch() —
 * safe for Cloudflare Worker context.
 *
 * Notion API version: 2022-06-28
 */
import type { ContentSourcePort, ContentSourceItem } from '../types'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

interface NotionConfig {
  token: string
  databaseId: string
}

/** Notion rich-text segment */
interface RichText {
  plain_text: string
}

/** Notion block object (simplified — we only read type + content) */
interface NotionBlock {
  id: string
  type: string
  [key: string]: unknown
}

/** Notion page object (simplified) */
interface NotionPage {
  id: string
  url: string
  last_edited_time: string
  last_edited_by?: { id: string }
  properties: Record<string, unknown>
}

/** Notion paginated response */
interface NotionPaginatedResponse<T> {
  results: T[]
  has_more: boolean
  next_cursor: string | null
}

export class NotionContentSource implements ContentSourcePort {
  readonly name = 'notion'
  private readonly token: string
  private readonly databaseId: string

  constructor(config: NotionConfig) {
    this.token = config.token
    this.databaseId = config.databaseId
  }

  async list(): Promise<ContentSourceItem[]> {
    const pages = await this.queryDatabase()
    return this.pagesToItems(pages)
  }

  async sync(since?: string): Promise<ContentSourceItem[]> {
    const filter = since
      ? {
          property: 'last_edited_time',
          last_edited_time: { after: since },
        }
      : undefined
    const pages = await this.queryDatabase(filter)
    return this.pagesToItems(pages)
  }

  // ---------------------------------------------------------------------------
  // Notion API helpers
  // ---------------------------------------------------------------------------

  private async notionFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${NOTION_API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string> | undefined),
      },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Notion API error ${res.status}: ${body}`)
    }

    return res.json() as Promise<T>
  }

  /** Query all pages in the database, handling pagination. */
  private async queryDatabase(filter?: Record<string, unknown>): Promise<NotionPage[]> {
    const pages: NotionPage[] = []
    let cursor: string | undefined

    do {
      const body: Record<string, unknown> = {}
      if (filter) body.filter = filter
      if (cursor) body.start_cursor = cursor

      const resp = await this.notionFetch<NotionPaginatedResponse<NotionPage>>(
        `/databases/${this.databaseId}/query`,
        { method: 'POST', body: JSON.stringify(body) },
      )

      pages.push(...resp.results)
      cursor = resp.has_more ? (resp.next_cursor ?? undefined) : undefined
    } while (cursor)

    return pages
  }

  /** Fetch all child blocks of a page, handling pagination. */
  private async fetchBlocks(pageId: string): Promise<NotionBlock[]> {
    const blocks: NotionBlock[] = []
    let cursor: string | undefined

    do {
      const qs = new URLSearchParams({ page_size: '100' })
      if (cursor) qs.set('start_cursor', cursor)

      const resp = await this.notionFetch<NotionPaginatedResponse<NotionBlock>>(
        `/blocks/${pageId}/children?${qs.toString()}`,
      )

      blocks.push(...resp.results)
      cursor = resp.has_more ? (resp.next_cursor ?? undefined) : undefined
    } while (cursor)

    return blocks
  }

  // ---------------------------------------------------------------------------
  // Page processing
  // ---------------------------------------------------------------------------

  private async pagesToItems(pages: NotionPage[]): Promise<ContentSourceItem[]> {
    const items: ContentSourceItem[] = []

    for (const page of pages) {
      const title = this.extractTitle(page)
      const slug = this.titleToSlug(title)
      const blocks = await this.fetchBlocks(page.id)
      const content = this.blocksToMarkdown(blocks)

      items.push({
        slug,
        title,
        content,
        updatedAt: page.last_edited_time,
        metadata: {
          notionPageId: page.id,
          notionUrl: page.url,
          lastEditedBy: page.last_edited_by?.id ?? null,
        },
      })
    }

    return items
  }

  /** Extract the title from the first title-type property on the page. */
  private extractTitle(page: NotionPage): string {
    for (const prop of Object.values(page.properties)) {
      const p = prop as Record<string, unknown>
      if (p.type === 'title') {
        const titleArray = p.title as RichText[] | undefined
        if (titleArray && titleArray.length > 0) {
          return titleArray.map(t => t.plain_text).join('')
        }
      }
    }
    return 'Untitled'
  }

  /** Convert a title to a URL-safe slug. */
  private titleToSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      || 'untitled'
  }

  // ---------------------------------------------------------------------------
  // Block → Markdown conversion
  // ---------------------------------------------------------------------------

  private blocksToMarkdown(blocks: NotionBlock[]): string {
    const lines: string[] = []
    let numberedIndex = 0

    for (const block of blocks) {
      // Reset numbered list counter when a non-numbered block appears
      if (block.type !== 'numbered_list_item') {
        numberedIndex = 0
      }

      const line = this.blockToMarkdown(block, numberedIndex)
      if (line !== null) {
        if (block.type === 'numbered_list_item') {
          numberedIndex++
        }
        lines.push(line)
      }
    }

    return lines.join('\n\n')
  }

  /** Convert a single Notion block to a markdown string. Returns null to skip. */
  private blockToMarkdown(block: NotionBlock, numberedIndex: number): string | null {
    const data = block[block.type] as Record<string, unknown> | undefined

    switch (block.type) {
      case 'paragraph':
        return this.richTextToPlain(data?.rich_text)

      case 'heading_1':
        return `# ${this.richTextToPlain(data?.rich_text)}`

      case 'heading_2':
        return `## ${this.richTextToPlain(data?.rich_text)}`

      case 'heading_3':
        return `### ${this.richTextToPlain(data?.rich_text)}`

      case 'bulleted_list_item':
        return `- ${this.richTextToPlain(data?.rich_text)}`

      case 'numbered_list_item':
        return `${numberedIndex + 1}. ${this.richTextToPlain(data?.rich_text)}`

      case 'code': {
        const lang = (data?.language as string) ?? ''
        const text = this.richTextToPlain(data?.rich_text)
        return `\`\`\`${lang}\n${text}\n\`\`\``
      }

      case 'quote':
        return `> ${this.richTextToPlain(data?.rich_text)}`

      case 'divider':
        return '---'

      case 'image': {
        const imageData = data as Record<string, unknown> | undefined
        const caption = this.richTextToPlain(imageData?.caption)
        let url = ''
        if (imageData?.type === 'file') {
          url = ((imageData.file as Record<string, unknown>)?.url as string) ?? ''
        } else if (imageData?.type === 'external') {
          url = ((imageData.external as Record<string, unknown>)?.url as string) ?? ''
        }
        return `![${caption}](${url})`
      }

      case 'to_do': {
        const checked = (data?.checked as boolean) ?? false
        const checkbox = checked ? '[x]' : '[ ]'
        return `- ${checkbox} ${this.richTextToPlain(data?.rich_text)}`
      }

      case 'callout': {
        const icon = this.extractIcon(data?.icon)
        const text = this.richTextToPlain(data?.rich_text)
        return `> **${icon}** ${text}`
      }

      default:
        return `<!-- unsupported block: ${block.type} -->`
    }
  }

  /** Concatenate rich_text segments into plain text. */
  private richTextToPlain(richText: unknown): string {
    if (!Array.isArray(richText)) return ''
    return (richText as RichText[]).map(t => t.plain_text).join('')
  }

  /** Extract emoji or icon text from a Notion icon object. */
  private extractIcon(icon: unknown): string {
    if (!icon || typeof icon !== 'object') return ''
    const iconObj = icon as Record<string, unknown>
    if (iconObj.type === 'emoji') return (iconObj.emoji as string) ?? ''
    return ''
  }
}
