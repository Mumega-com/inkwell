import { describe, it, expect } from 'vitest'
import type { ContentSourcePort, ContentSourceItem } from '../types'

// ── Mock adapter for testing the port contract ──────────────────────────────

class MockContentSource implements ContentSourcePort {
  name = 'mock'
  private items: ContentSourceItem[]

  constructor(items: ContentSourceItem[]) {
    this.items = items
  }

  async list(): Promise<ContentSourceItem[]> {
    return this.items
  }

  async sync(since?: string): Promise<ContentSourceItem[]> {
    if (!since) return this.items
    const threshold = new Date(since).getTime()
    return this.items.filter(item => new Date(item.updatedAt).getTime() > threshold)
  }
}

describe('ContentSourcePort contract', () => {
  const items: ContentSourceItem[] = [
    {
      slug: 'getting-started',
      title: 'Getting Started',
      content: '---\ntitle: Getting Started\n---\n\n# Getting Started\n\nWelcome.',
      updatedAt: '2026-04-18T10:00:00Z',
      metadata: { filePath: 'docs/getting-started.md' },
    },
    {
      slug: 'api-reference',
      title: 'API Reference',
      content: '---\ntitle: API Reference\n---\n\n# API Reference\n\nEndpoints.',
      updatedAt: '2026-04-17T08:00:00Z',
      metadata: { filePath: 'docs/api-reference.md' },
    },
    {
      slug: 'changelog',
      title: 'Changelog',
      content: '# Changelog\n\n## v1.0\n\nInitial release.',
      updatedAt: '2026-04-15T12:00:00Z',
    },
  ]

  it('list() returns all items', async () => {
    const source = new MockContentSource(items)
    const result = await source.list()
    expect(result).toHaveLength(3)
    expect(result[0].slug).toBe('getting-started')
  })

  it('sync() without since returns all items', async () => {
    const source = new MockContentSource(items)
    const result = await source.sync()
    expect(result).toHaveLength(3)
  })

  it('sync(since) filters by updatedAt', async () => {
    const source = new MockContentSource(items)
    const result = await source.sync('2026-04-17T00:00:00Z')
    expect(result).toHaveLength(2)
    expect(result.map(i => i.slug)).toContain('getting-started')
    expect(result.map(i => i.slug)).toContain('api-reference')
    expect(result.map(i => i.slug)).not.toContain('changelog')
  })

  it('sync(since) returns empty when nothing changed', async () => {
    const source = new MockContentSource(items)
    const result = await source.sync('2026-04-19T00:00:00Z')
    expect(result).toHaveLength(0)
  })

  it('items have required fields', async () => {
    const source = new MockContentSource(items)
    const result = await source.list()
    for (const item of result) {
      expect(item.slug).toBeTruthy()
      expect(item.title).toBeTruthy()
      expect(item.content).toBeTruthy()
      expect(item.updatedAt).toBeTruthy()
      expect(new Date(item.updatedAt).getTime()).toBeGreaterThan(0)
    }
  })

  it('metadata is optional', async () => {
    const source = new MockContentSource(items)
    const result = await source.list()
    expect(result[0].metadata).toBeDefined()
    expect(result[2].metadata).toBeUndefined()
  })

  it('name identifies the source', () => {
    const source = new MockContentSource(items)
    expect(source.name).toBe('mock')
  })
})

describe('ObsidianSourceAdapter', () => {
  it('parses frontmatter title and builds slug from path', async () => {
    const { ObsidianSourceAdapter } = await import('../adapters/source-obsidian')

    const mockFS = {
      listFiles: async () => ['notes/hello-world.md', 'deep/nested/page.md'],
      readFile: async (path: string) => {
        if (path === 'notes/hello-world.md') {
          return '---\ntitle: Hello World\ntags: [test]\n---\n\n# Hello\n\nContent here.'
        }
        return '# No Frontmatter\n\nJust content.'
      },
      stat: async () => ({ mtimeMs: Date.now() }),
    }

    const adapter = new ObsidianSourceAdapter(mockFS, { vaultPath: '/vault' })
    expect(adapter.name).toBe('obsidian')

    const items = await adapter.list()
    expect(items).toHaveLength(2)
    expect(items[0].slug).toBe('notes/hello-world')
    expect(items[0].title).toBe('Hello World')
    expect(items[1].slug).toBe('deep/nested/page')
  })

  it('sync(since) filters by mtime', async () => {
    const { ObsidianSourceAdapter: Adapter } = await import('../adapters/source-obsidian')
    const now = Date.now()
    const oldTime = now - 86_400_000 * 2

    const mockFS = {
      listFiles: async () => ['new.md', 'old.md'],
      readFile: async () => '# Page\n\nContent.',
      stat: async (path: string) => ({
        mtimeMs: path === 'new.md' ? now : oldTime,
      }),
    }

    const adapter = new Adapter(mockFS, { vaultPath: '/vault' })
    const since = new Date(now - 86_400_000).toISOString() // 1 day ago
    const items = await adapter.sync(since)
    expect(items).toHaveLength(1)
    expect(items[0].slug).toBe('new')
  })
})

describe('GitHubContentSource', () => {
  it('exports correctly and has name', async () => {
    const { GitHubContentSource } = await import('../adapters/source-github')
    const source = new GitHubContentSource({ owner: 'test', repo: 'test' })
    expect(source.name).toBe('github')
  })
})

describe('NotionContentSource', () => {
  it('exports correctly and has name', async () => {
    const { NotionContentSource } = await import('../adapters/source-notion')
    const source = new NotionContentSource({ token: 'test', databaseId: 'test' })
    expect(source.name).toBe('notion')
  })
})

describe('GoogleDriveSourceAdapter', () => {
  it('exports correctly and has name', async () => {
    const { GoogleDriveSourceAdapter } = await import('../adapters/source-gdrive')
    const source = new GoogleDriveSourceAdapter({ accessToken: 'test', folderId: 'test' })
    expect(source.name).toBe('google-drive')
  })
})
