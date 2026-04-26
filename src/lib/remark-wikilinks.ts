import type { Root, Text, PhrasingContent } from 'mdast'
import { visit } from 'unist-util-visit'

/**
 * Build-time map of source slug → target slugs found in wikilinks.
 * Populated during markdown processing. Use this to compute backlinks.
 */
export const wikilinkMap = new Map<string, string[]>()

const WIKILINK_RE = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g

export type ResolveLink = (targetSlug: string) => string

export interface RemarkWikilinksOptions {
  /**
   * Map a target slug to a URL path. Default: `/blog/{slug}`.
   * Forks with multiple content collections (e.g. papers, concepts) should
   * pass a resolver that routes by slug pattern or collection lookup.
   */
  resolveLink?: ResolveLink
}

const defaultResolveLink: ResolveLink = (slug) => `/blog/${encodeURIComponent(slug)}`

/**
 * Remark plugin that converts [[target]] and [[target|display]] wikilinks
 * into HTML anchor tags and tracks the link graph for backlink computation.
 */
export default function remarkWikilinks(options: RemarkWikilinksOptions = {}) {
  const resolveLink = options.resolveLink ?? defaultResolveLink
  return (tree: Root, file: { data: Record<string, unknown> }) => {
    const slug = typeof file.data.slug === 'string' ? file.data.slug : ''
    const targets: string[] = []

    visit(tree, 'text', (node: Text, index, parent) => {
      if (index === undefined || !parent) return
      if (!WIKILINK_RE.test(node.value)) return

      // Reset regex state
      WIKILINK_RE.lastIndex = 0

      const children: PhrasingContent[] = []
      let lastIndex = 0

      let match: RegExpExecArray | null
      while ((match = WIKILINK_RE.exec(node.value)) !== null) {
        const [full, target, display] = match
        const before = node.value.slice(lastIndex, match.index)

        if (before) {
          children.push({ type: 'text', value: before })
        }

        const targetSlug = target.trim().toLowerCase().replace(/\s+/g, '-')
        const label = display?.trim() || target.trim()

        children.push({
          type: 'html',
          value: `<a href="${resolveLink(targetSlug)}" class="wikilink">${escapeHtml(label)}</a>`,
        })

        targets.push(targetSlug)
        lastIndex = match.index + full.length
      }

      const after = node.value.slice(lastIndex)
      if (after) {
        children.push({ type: 'text', value: after })
      }

      if (children.length > 0) {
        parent.children.splice(index, 1, ...children)
      }
    })

    if (slug && targets.length > 0) {
      const existing = wikilinkMap.get(slug) ?? []
      wikilinkMap.set(slug, [...existing, ...targets])
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
