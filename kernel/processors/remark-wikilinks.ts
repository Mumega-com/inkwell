import type { Root, Text, PhrasingContent } from 'mdast'
import { visit } from 'unist-util-visit'

const WIKILINK_RE = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g

export interface WikilinkOptions {
  basePath?: string
}

export function remarkWikilinks(options?: WikilinkOptions) {
  const basePath = options?.basePath ?? '/'

  return (tree: Root, file: { data: Record<string, unknown> }) => {
    const targets: string[] = []

    visit(tree, 'text', (node: Text, index, parent) => {
      if (index === undefined || !parent) return
      if (!WIKILINK_RE.test(node.value)) return
      WIKILINK_RE.lastIndex = 0

      const children: PhrasingContent[] = []
      let lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = WIKILINK_RE.exec(node.value)) !== null) {
        const [full, target, display] = match
        const before = node.value.slice(lastIndex, match.index)
        if (before) children.push({ type: 'text', value: before })

        const targetSlug = target.trim().toLowerCase().replace(/\s+/g, '-')
        const label = display?.trim() || target.trim()
        children.push({
          type: 'html',
          value: `<a href="${basePath}${encodeURIComponent(targetSlug)}" class="wikilink">${escapeHtml(label)}</a>`,
        })
        targets.push(targetSlug)
        lastIndex = match.index + full.length
      }

      const after = node.value.slice(lastIndex)
      if (after) children.push({ type: 'text', value: after })
      if (children.length > 0) parent.children.splice(index, 1, ...children)
    })

    file.data.wikilinks = targets
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
