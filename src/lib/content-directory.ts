import { safeGetCollection } from './safe-content'

export const contentCollections = ['blog', 'topics', 'labs', 'tools', 'products'] as const
export type ContentCollection = (typeof contentCollections)[number]

export const contentCollectionLabels: Record<ContentCollection, string> = {
  blog: 'Blog post',
  topics: 'Topic',
  labs: 'Lab',
  tools: 'Tool',
  products: 'Product',
}

export const contentCollectionRoutes: Record<ContentCollection, (id: string) => string> = {
  blog: (id) => `/blog/${id}`,
  topics: (id) => `/topics/${id}`,
  labs: (id) => `/labs/${id}`,
  tools: (id) => `/tools/${id}`,
  products: (id) => `/products/${id}`,
}

const staticRoutes: Record<string, { href: string; title: string; label: string }> = {
  about: { href: '/about', title: 'About', label: 'Page' },
  explore: { href: '/explore', title: 'Explore', label: 'Page' },
  privacy: { href: '/privacy', title: 'Privacy', label: 'Page' },
  search: { href: '/search', title: 'Search', label: 'Page' },
  subscribe: { href: '/subscribe', title: 'Subscribe', label: 'Page' },
  terms: { href: '/terms', title: 'Terms', label: 'Page' },
  vision: { href: '/vision', title: 'Vision', label: 'Page' },
  whitepaper: { href: '/whitepaper', title: 'Whitepaper', label: 'Page' },
}

type DirectoryEntrySource = {
  id: string
  data: {
    title: string
    description?: string
    tags?: string[]
    date?: Date
    updated?: Date
    status?: string
  }
}

export interface DirectoryEntry {
  collection: ContentCollection
  id: string
  title: string
  description?: string
  tags: string[]
  date?: Date
  updated?: Date
  status?: string
}

export interface ContentDirectory {
  entries: DirectoryEntry[]
  tagIndex: Map<string, DirectoryEntry[]>
  byRef: Map<string, DirectoryEntry>
  blog: DirectoryEntry[]
  topics: DirectoryEntry[]
  labs: DirectoryEntry[]
  tools: DirectoryEntry[]
  products: DirectoryEntry[]
}

export interface ResolvedReference {
  ref: string
  href: string
  title: string
  label: string
  collection?: ContentCollection
  description?: string
  external: boolean
}

function toEntry(collection: ContentCollection, item: DirectoryEntrySource): DirectoryEntry {
  return {
    collection,
    id: item.id,
    title: item.data.title,
    description: item.data.description,
    tags: item.data.tags ?? [],
    date: item.data.date,
    updated: item.data.updated,
    status: item.data.status,
  }
}

export function routeFor(collection: ContentCollection, id: string): string {
  return contentCollectionRoutes[collection](id)
}

export function labelFor(collection: ContentCollection): string {
  return contentCollectionLabels[collection]
}

export function entryTimestamp(entry: DirectoryEntry): number {
  const stamp = entry.updated ?? entry.date
  return stamp ? new Date(stamp).getTime() : 0
}

export function sortDirectoryEntries(entries: DirectoryEntry[]): DirectoryEntry[] {
  return [...entries].sort((a, b) => entryTimestamp(b) - entryTimestamp(a))
}

export async function loadContentDirectory(): Promise<ContentDirectory> {
  const [blog, topics, labs, tools, products] = await Promise.all([
    safeGetCollection('blog'),
    safeGetCollection('topics'),
    safeGetCollection('labs'),
    safeGetCollection('tools'),
    safeGetCollection('products'),
  ])

  const entries = [
    ...blog.map((item) => toEntry('blog', item)),
    ...topics.map((item) => toEntry('topics', item)),
    ...labs.map((item) => toEntry('labs', item)),
    ...tools.map((item) => toEntry('tools', item)),
    ...products.map((item) => toEntry('products', item)),
  ]

  const byRef = new Map<string, DirectoryEntry>()
  const tagIndex = new Map<string, DirectoryEntry[]>()

  for (const entry of entries) {
    byRef.set(entry.id, entry)
    byRef.set(`${entry.collection}:${entry.id}`, entry)
    byRef.set(entry.title.toLowerCase(), entry)

    for (const rawTag of entry.tags) {
      const tag = rawTag.trim()
      if (!tag) continue
      const items = tagIndex.get(tag) ?? []
      items.push(entry)
      tagIndex.set(tag, items)
    }
  }

  for (const [tag, items] of tagIndex.entries()) {
    tagIndex.set(tag, sortDirectoryEntries(items))
  }

  return {
    entries: sortDirectoryEntries(entries),
    tagIndex,
    byRef,
    blog: sortDirectoryEntries(entries.filter((entry) => entry.collection === 'blog')),
    topics: sortDirectoryEntries(entries.filter((entry) => entry.collection === 'topics')),
    labs: sortDirectoryEntries(entries.filter((entry) => entry.collection === 'labs')),
    tools: sortDirectoryEntries(entries.filter((entry) => entry.collection === 'tools')),
    products: sortDirectoryEntries(entries.filter((entry) => entry.collection === 'products')),
  }
}

export function resolveReference(ref: string, directory: ContentDirectory): ResolvedReference | null {
  const value = ref.trim()
  if (!value) return null

  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value)
    return {
      ref: value,
      href: value,
      title: url.hostname.replace(/^www\./i, ''),
      label: 'External',
      external: true,
    }
  }

  const staticRoute = staticRoutes[value.replace(/^\//, '')]
  if (staticRoute) {
    return {
      ref: value,
      href: staticRoute.href,
      title: staticRoute.title,
      label: staticRoute.label,
      external: false,
    }
  }

  const tagMatch = value.match(/^tag:(.+)$/i)
  if (tagMatch) {
    const tag = tagMatch[1].trim()
    return {
      ref: value,
      href: `/tag/${encodeURIComponent(tag)}`,
      title: `#${tag}`,
      label: 'Tag',
      external: false,
    }
  }

  const collectionMatch = value.match(/^(blog|topics|labs|tools|products):(.+)$/i)
  if (collectionMatch) {
    const collection = collectionMatch[1].toLowerCase() as ContentCollection
    const id = collectionMatch[2].trim()
    const entry = directory.byRef.get(`${collection}:${id}`) ?? directory.byRef.get(id)
    if (entry) {
      return {
        ref: value,
        href: routeFor(entry.collection, entry.id),
        title: entry.title,
        description: entry.description,
        label: labelFor(entry.collection),
        collection: entry.collection,
        external: false,
      }
    }
  }

  const staticPath = value.startsWith('/') ? value : `/${value}`
  if (staticRoutes[staticPath.replace(/^\//, '')]) {
    const route = staticRoutes[staticPath.replace(/^\//, '')]
    return {
      ref: value,
      href: route.href,
      title: route.title,
      label: route.label,
      external: false,
    }
  }

  const entry = directory.byRef.get(value) ?? directory.byRef.get(value.toLowerCase())
  if (entry) {
    return {
      ref: value,
      href: routeFor(entry.collection, entry.id),
      title: entry.title,
      description: entry.description,
      label: labelFor(entry.collection),
      collection: entry.collection,
      external: false,
    }
  }

  return null
}

export function resolveReferences(refs: string[] | undefined, directory: ContentDirectory): ResolvedReference[] {
  if (!refs || refs.length === 0) return []

  const seen = new Set<string>()
  const resolved: ResolvedReference[] = []

  for (const ref of refs) {
    const item = resolveReference(ref, directory)
    if (!item) continue
    if (seen.has(item.href)) continue
    seen.add(item.href)
    resolved.push(item)
  }

  return resolved
}
