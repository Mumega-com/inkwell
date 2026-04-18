/**
 * ObsidianSourceAdapter — Reads markdown from an Obsidian vault directory.
 *
 * Platform-agnostic: accepts a VaultFS interface so it works with
 * local filesystem (CLI/dev), R2, KV, or any storage backend.
 *
 * Implements ContentSourcePort from kernel/types.ts.
 */
import type { ContentSourcePort, ContentSourceItem } from '../types'

// ---------------------------------------------------------------------------
// Abstract file system — inject the right one per environment
// ---------------------------------------------------------------------------

/** Minimal FS interface the adapter needs. No Node.js dependencies. */
export interface VaultFS {
  /** List files matching a glob pattern, returning relative paths */
  listFiles(glob: string): Promise<string[]>
  /** Read a file's UTF-8 content by relative path */
  readFile(path: string): Promise<string>
  /** Get file metadata by relative path */
  stat(path: string): Promise<{ mtimeMs: number }>
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface ObsidianSourceConfig {
  /** Absolute path or logical root of the vault (for metadata only — VaultFS handles actual access) */
  vaultPath: string
  /** Glob pattern for markdown files. Default: `**\/*.md` */
  glob?: string
}

// ---------------------------------------------------------------------------
// YAML frontmatter parser (minimal — no external deps)
// ---------------------------------------------------------------------------

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/

/**
 * Extract the `title` field from YAML frontmatter.
 * Only parses the title line to avoid pulling in a full YAML library.
 */
function extractFrontmatterTitle(raw: string): string | undefined {
  const match = FRONTMATTER_RE.exec(raw)
  if (!match) return undefined

  const yaml = match[1]
  for (const line of yaml.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('title:')) {
      let value = trimmed.slice('title:'.length).trim()
      // Strip surrounding quotes (single or double)
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      return value || undefined
    }
  }
  return undefined
}

/**
 * Derive a URL-safe slug from a relative file path.
 * `notes/my-page.md` → `notes/my-page`
 */
function pathToSlug(relativePath: string): string {
  return relativePath.replace(/\.md$/i, '').replace(/\\/g, '/')
}

/**
 * Derive a human-readable title from a filename.
 * `my-page.md` → `my page`
 */
function filenameToTitle(relativePath: string): string {
  const basename = relativePath.split('/').pop() ?? relativePath
  return basename.replace(/\.md$/i, '').replace(/[-_]/g, ' ')
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class ObsidianSourceAdapter implements ContentSourcePort {
  readonly name = 'obsidian'
  private readonly fs: VaultFS
  private readonly vaultPath: string
  private readonly glob: string

  constructor(fs: VaultFS, config: ObsidianSourceConfig) {
    this.fs = fs
    this.vaultPath = config.vaultPath
    this.glob = config.glob ?? '**/*.md'
  }

  async list(): Promise<ContentSourceItem[]> {
    const files = await this.fs.listFiles(this.glob)
    const items: ContentSourceItem[] = []

    for (const filePath of files) {
      const item = await this.readItem(filePath)
      items.push(item)
    }

    return items
  }

  async sync(since?: string): Promise<ContentSourceItem[]> {
    if (!since) return this.list()

    const sinceMs = new Date(since).getTime()
    const files = await this.fs.listFiles(this.glob)
    const items: ContentSourceItem[] = []

    for (const filePath of files) {
      const { mtimeMs } = await this.fs.stat(filePath)
      if (mtimeMs > sinceMs) {
        const item = await this.readItem(filePath)
        items.push(item)
      }
    }

    return items
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private async readItem(filePath: string): Promise<ContentSourceItem> {
    const content = await this.fs.readFile(filePath)
    const { mtimeMs } = await this.fs.stat(filePath)

    const frontmatterTitle = extractFrontmatterTitle(content)
    const title = frontmatterTitle ?? filenameToTitle(filePath)
    const slug = pathToSlug(filePath)

    return {
      slug,
      title,
      content,
      updatedAt: new Date(mtimeMs).toISOString(),
      metadata: {
        filePath,
        vaultPath: this.vaultPath,
      },
    }
  }
}
