/**
 * Inkwell v2 — Knowledge graph builder
 *
 * Transforms the content directory into graph data (nodes + edges)
 * for the KnowledgeGraph visualization component.
 */

import { loadContentDirectory, routeFor } from './content-directory'
import type { DirectoryEntry } from './content-directory'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GraphNode {
  slug: string
  title: string
  tags: string[]
  url: string
}

export interface GraphEdge {
  source: string
  target: string
  type: 'tag' | 'wikilink'
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ─── Builder ─────────────────────────────────────────────────────────────────

export async function buildGraphData(): Promise<GraphData> {
  const directory = await loadContentDirectory()
  const entries = directory.entries

  // Build nodes
  const nodes: GraphNode[] = entries.map((entry: DirectoryEntry) => ({
    slug: `${entry.collection}:${entry.id}`,
    title: entry.title,
    tags: entry.tags.filter((tag) => tag.toLowerCase() !== 'beta'),
    url: routeFor(entry.collection, entry.id),
  }))

  // Build edges
  const edges: GraphEdge[] = []
  const seen = new Set<string>()

  for (const item of entries) {
    const itemTags = item.tags.filter((tag) => tag.toLowerCase() !== 'beta')
    if (itemTags.length === 0) continue

    for (const other of entries) {
      if (item.collection === other.collection && item.id === other.id) continue

      const otherTags = other.tags.filter((tag) => tag.toLowerCase() !== 'beta')
      const sharedTags = itemTags.filter((tag) => otherTags.includes(tag))
      
      // Need 2+ tags to create a meaningful relationship
      if (sharedTags.length < 2) continue

      const source = `${item.collection}:${item.id}`
      const target = `${other.collection}:${other.id}`
      
      const key = [source, target].sort().join('::')
      if (seen.has(key)) continue
      seen.add(key)
      
      edges.push({ source, target, type: 'tag' })
    }
  }

  return { nodes, edges }
}
