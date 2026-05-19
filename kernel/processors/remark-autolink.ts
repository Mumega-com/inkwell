import type { Root, Text, PhrasingContent, Parent } from 'mdast'
import { visit } from 'unist-util-visit'

export interface AutolinkPage {
  slug: string
  title: string
  url: string
}

export interface AutolinkOptions {
  pages: AutolinkPage[]
  currentSlug?: string
  maxLinksPerSection?: number
}

/**
 * Wikipedia-style auto-linking: scans text nodes, matches entity mentions
 * against known pages, injects contextual links on first occurrence.
 *
 * Rules:
 * - Max N auto-links per ~500 words (default 3)
 * - Never auto-links inside headings, existing links, or code blocks
 * - Case-insensitive match, preserves original casing in display text
 * - Never links to the current page (self-link prevention)
 * - Only links the FIRST mention of each entity per document
 */
export function remarkAutolink(options: AutolinkOptions) {
  const { pages, currentSlug, maxLinksPerSection = 3 } = options

  // Filter out self-links and sort by title length descending so longer
  // titles match first (prevents "AI" matching inside "AI Agents")
  const candidates = pages
    .filter((p) => p.slug !== currentSlug)
    .sort((a, b) => b.title.length - a.title.length)

  if (candidates.length === 0) {
    return (_tree: Root) => {
      /* nothing to link */
    }
  }

  return (tree: Root) => {
    // Track which entities have already been linked (first-mention only)
    const linked = new Set<string>()
    // Track total links inserted and word count for density control
    let totalLinks = 0
    let totalWords = 0

    visit(tree, 'text', (node: Text, index, parent) => {
      if (index === undefined || !parent) return

      // Skip nodes inside headings, links, or code
      if (isInsideExcludedParent(parent, tree)) return

      const wordCount = countWords(node.value)
      totalWords += wordCount

      // Check density: max N links per 500 words
      const maxAllowed = Math.max(maxLinksPerSection, Math.floor((totalWords / 500) * maxLinksPerSection))
      if (totalLinks >= maxAllowed) return

      const children: PhrasingContent[] = []
      let remaining = node.value
      let didReplace = false

      for (const page of candidates) {
        if (linked.has(page.slug)) continue
        if (totalLinks >= maxAllowed) break

        const matchIndex = remaining.toLowerCase().indexOf(page.title.toLowerCase())
        if (matchIndex === -1) continue

        // Verify it's a word boundary match (not matching inside another word)
        if (!isWordBoundary(remaining, matchIndex, page.title.length)) continue

        // Split: before + link + after
        const before = remaining.slice(0, matchIndex)
        const matchedText = remaining.slice(matchIndex, matchIndex + page.title.length)
        const after = remaining.slice(matchIndex + page.title.length)

        if (before) children.push({ type: 'text', value: before })

        children.push({
          type: 'html',
          value: `<a href="${escapeAttr(page.url)}" class="autolink">${escapeHtml(matchedText)}</a>`,
        })

        linked.add(page.slug)
        totalLinks++
        remaining = after
        didReplace = true
      }

      if (didReplace) {
        if (remaining) children.push({ type: 'text', value: remaining })
        parent.children.splice(index, 1, ...children)
      }
    })
  }
}

/** Check if a match sits on word boundaries (not inside a larger word) */
function isWordBoundary(text: string, index: number, length: number): boolean {
  const before = index > 0 ? text[index - 1] : ' '
  const after = index + length < text.length ? text[index + length] : ' '
  const wordChar = /\w/
  return !wordChar.test(before) && !wordChar.test(after)
}

/** Walk ancestors to check if this text node is inside a heading, link, or code block */
function isInsideExcludedParent(parent: Parent, tree: Root): boolean {
  const excluded = new Set(['heading', 'link', 'linkReference', 'code', 'inlineCode'])

  // Check immediate parent
  if (excluded.has(parent.type)) return true

  // Walk the tree to find ancestors — use a stack-based search
  const ancestors: Parent[] = []
  findAncestors(tree, parent, ancestors)

  return ancestors.some((a) => excluded.has(a.type))
}

/** Recursively find the ancestor chain for a target node */
function findAncestors(current: Parent, target: Parent, ancestors: Parent[]): boolean {
  for (const child of current.children) {
    if (child === target) {
      ancestors.push(current)
      return true
    }
    if ('children' in child) {
      if (findAncestors(child as Parent, target, ancestors)) {
        ancestors.push(current)
        return true
      }
    }
  }
  return false
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
