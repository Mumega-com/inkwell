import { getCollection, getEntry } from 'astro:content'

type CollectionName =
  | 'blog'
  | 'books'
  | 'docs'
  | 'labs'
  | 'pages'
  | 'products'
  | 'team'
  | 'tools'
  | 'topics'

const contentModules: Record<CollectionName, Record<string, unknown>> = {
  blog: import.meta.glob('../../content/en/blog/**/*.{md,mdx}'),
  books: import.meta.glob('../../content/en/books/**/*.{md,mdx}'),
  docs: import.meta.glob('../../content/en/docs/**/*.{md,mdx}'),
  labs: import.meta.glob('../../content/en/labs/**/*.{md,mdx}'),
  pages: import.meta.glob('../../content/en/pages/**/*.{md,mdx}'),
  products: import.meta.glob('../../content/en/products/**/*.{md,mdx}'),
  team: import.meta.glob('../../content/en/team/**/*.{md,mdx}'),
  tools: import.meta.glob('../../content/en/tools/**/*.{md,mdx}'),
  topics: import.meta.glob('../../content/en/topics/**/*.{md,mdx}'),
}

function hasContent(collection: CollectionName): boolean {
  return Object.keys(contentModules[collection]).length > 0
}

export async function safeGetCollection(collection: CollectionName, filter?: (entry: any) => boolean): Promise<any[]> {
  if (!hasContent(collection)) return []
  return getCollection(collection as any, filter as any)
}

export async function safeGetEntry(collection: CollectionName, id: string): Promise<any | undefined> {
  if (!hasContent(collection)) return undefined
  return getEntry(collection as any, id as any)
}
