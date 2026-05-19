/**
 * GitHubContentSource — GitHub REST API implementation of ContentSourcePort.
 *
 * Fetches markdown files from a GitHub repository via the Trees, Blobs,
 * and Commits APIs. Uses only fetch() — runs in Cloudflare Workers.
 *
 * Usage:
 *   const source = new GitHubContentSource({
 *     owner: 'acme',
 *     repo: 'docs',
 *     path: 'content',
 *     token: env.GITHUB_TOKEN,  // optional, for private repos
 *   })
 *   const items = await source.list()
 */
import type { ContentSourcePort, ContentSourceItem } from '../types'

export interface GitHubContentSourceConfig {
  owner: string
  repo: string
  branch?: string
  path?: string
  token?: string
}

/** GitHub Trees API response shape (subset we use). */
interface GitTreeResponse {
  sha: string
  tree: Array<{
    path: string
    mode: string
    type: 'blob' | 'tree'
    sha: string
    size?: number
  }>
}

/** GitHub Blob API response shape (subset we use). */
interface GitBlobResponse {
  sha: string
  content: string
  encoding: 'base64' | 'utf-8'
  size: number
}

/** GitHub Commits API response shape (subset we use). */
interface GitCommitResponse {
  sha: string
  commit: {
    committer: {
      date: string
    }
  }
}

/** GitHub Commit detail (for listing changed files). */
interface GitCommitDetailResponse {
  sha: string
  commit: {
    committer: {
      date: string
    }
  }
  files?: Array<{
    filename: string
    status: string
    sha: string
  }>
}

/**
 * Extract title from YAML frontmatter.
 *
 * Minimal parser: splits on `---` delimiters, scans for a `title:` line.
 * Handles quoted and unquoted values. Returns null if no frontmatter or
 * no title field found.
 */
function extractFrontmatterTitle(content: string): string | null {
  // Frontmatter must start at the very beginning of the file
  if (!content.startsWith('---')) return null

  const endIndex = content.indexOf('---', 3)
  if (endIndex === -1) return null

  const frontmatter = content.slice(3, endIndex)
  const lines = frontmatter.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('title:')) {
      let value = trimmed.slice(6).trim()
      // Strip surrounding quotes (single or double)
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      return value || null
    }
  }

  return null
}

/**
 * Derive a human-readable title from a filename.
 * `getting-started.md` → `getting-started`
 */
function titleFromFilename(filePath: string): string {
  const parts = filePath.split('/')
  const filename = parts[parts.length - 1] ?? filePath
  return filename.replace(/\.mdx?$/, '')
}

/**
 * Convert a file path to a slug relative to the configured path prefix.
 * Strips the prefix and the `.md`/`.mdx` extension.
 *
 * Example: path prefix = `content/`, file = `content/docs/getting-started.md`
 *   → slug = `docs/getting-started`
 */
function toSlug(filePath: string, pathPrefix: string): string {
  let relative = filePath
  if (pathPrefix && relative.startsWith(pathPrefix)) {
    relative = relative.slice(pathPrefix.length)
  }
  // Strip leading slash if present
  if (relative.startsWith('/')) {
    relative = relative.slice(1)
  }
  return relative.replace(/\.mdx?$/, '')
}

export class GitHubContentSource implements ContentSourcePort {
  readonly name = 'github'

  private readonly owner: string
  private readonly repo: string
  private readonly branch: string
  private readonly path: string
  private readonly token: string | undefined
  private readonly pathPrefix: string

  constructor(config: GitHubContentSourceConfig) {
    this.owner = config.owner
    this.repo = config.repo
    this.branch = config.branch ?? 'main'
    this.path = config.path ?? ''
    this.token = config.token

    // Normalise path prefix for slug derivation (ensure trailing slash or empty)
    this.pathPrefix = this.path ? (this.path.endsWith('/') ? this.path : this.path + '/') : ''
  }

  // ── Public API ──────────────────────────────────────────────────────────

  async list(): Promise<ContentSourceItem[]> {
    const tree = await this.fetchTree()

    // Filter to .md/.mdx blobs under the configured path
    const mdFiles = tree.tree.filter(
      (entry) =>
        entry.type === 'blob' &&
        /\.mdx?$/.test(entry.path) &&
        this.isUnderPath(entry.path),
    )

    // Fetch content for each file in parallel (bounded)
    const items = await this.fetchBlobsBatched(
      mdFiles.map((f) => ({ path: f.path, sha: f.sha })),
    )

    return items
  }

  async sync(since?: string): Promise<ContentSourceItem[]> {
    if (!since) {
      return this.list()
    }

    // Find commits since the given timestamp that touch our path
    const commits = await this.fetchCommitsSince(since)

    if (commits.length === 0) return []

    // Collect unique changed .md file paths with their latest SHA
    const changedFiles = await this.collectChangedFiles(commits)

    if (changedFiles.size === 0) return []

    // Fetch content for changed files
    const entries = Array.from(changedFiles.entries()).map(([path, sha]) => ({
      path,
      sha,
    }))

    return this.fetchBlobsBatched(entries)
  }

  // ── GitHub API helpers ──────────────────────────────────────────────────

  private async ghFetch<T>(url: string): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'inkwell-content-source',
      'X-GitHub-Api-Version': '2022-11-28',
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(url, { headers })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(
        `GitHub API error ${response.status} for ${url}: ${body}`,
      )
    }

    return response.json() as Promise<T>
  }

  private async fetchTree(): Promise<GitTreeResponse> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/git/trees/${this.branch}?recursive=1`
    return this.ghFetch<GitTreeResponse>(url)
  }

  private async fetchBlob(sha: string): Promise<GitBlobResponse> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/git/blobs/${sha}`
    return this.ghFetch<GitBlobResponse>(url)
  }

  private async fetchCommitsSince(since: string): Promise<GitCommitResponse[]> {
    const params = new URLSearchParams({ since })
    if (this.path) {
      params.set('path', this.path)
    }
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/commits?${params.toString()}`
    return this.ghFetch<GitCommitResponse[]>(url)
  }

  private async fetchCommitDetail(sha: string): Promise<GitCommitDetailResponse> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/commits/${sha}`
    return this.ghFetch<GitCommitDetailResponse>(url)
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private isUnderPath(filePath: string): boolean {
    if (!this.pathPrefix) return true
    return filePath.startsWith(this.pathPrefix) || filePath === this.path
  }

  /**
   * Fetch blob contents in parallel, capped at 10 concurrent requests
   * to avoid hitting GitHub rate limits too aggressively.
   */
  private async fetchBlobsBatched(
    files: Array<{ path: string; sha: string }>,
  ): Promise<ContentSourceItem[]> {
    const BATCH_SIZE = 10
    const results: ContentSourceItem[] = []

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(
        batch.map((file) => this.fetchAndConvert(file.path, file.sha)),
      )
      for (const item of batchResults) {
        if (item) results.push(item)
      }
    }

    return results
  }

  /**
   * Fetch a single blob and convert it to a ContentSourceItem.
   * Returns null if the blob can't be decoded (shouldn't happen for .md).
   */
  private async fetchAndConvert(
    filePath: string,
    sha: string,
  ): Promise<ContentSourceItem | null> {
    const blob = await this.fetchBlob(sha)

    let content: string
    if (blob.encoding === 'base64') {
      content = decodeBase64(blob.content)
    } else {
      content = blob.content
    }

    const title =
      extractFrontmatterTitle(content) ?? titleFromFilename(filePath)
    const slug = toSlug(filePath, this.pathPrefix)

    return {
      slug,
      title,
      content,
      // Blobs don't carry timestamps — use current time.
      // sync() callers can cross-reference with commit dates if needed.
      updatedAt: new Date().toISOString(),
      metadata: {
        repo: `${this.owner}/${this.repo}`,
        branch: this.branch,
        filePath,
        sha,
      },
    }
  }

  /**
   * Walk commit details to collect unique changed .md files under our path.
   * Returns a Map of filePath → latest SHA.
   */
  private async collectChangedFiles(
    commits: GitCommitResponse[],
  ): Promise<Map<string, string>> {
    const changed = new Map<string, string>()

    // Fetch commit details in parallel (bounded)
    const BATCH_SIZE = 10
    for (let i = 0; i < commits.length; i += BATCH_SIZE) {
      const batch = commits.slice(i, i + BATCH_SIZE)
      const details = await Promise.all(
        batch.map((c) => this.fetchCommitDetail(c.sha)),
      )

      for (const detail of details) {
        if (!detail.files) continue
        for (const file of detail.files) {
          if (
            /\.mdx?$/.test(file.filename) &&
            this.isUnderPath(file.filename) &&
            file.status !== 'removed'
          ) {
            // Later commits overwrite earlier — we keep the latest SHA
            changed.set(file.filename, file.sha)
          }
        }
      }
    }

    return changed
  }
}

/**
 * Decode a base64 string to UTF-8 text.
 * Uses atob() which is available in Cloudflare Workers.
 * GitHub base64 content may contain newlines — strip them first.
 */
function decodeBase64(encoded: string): string {
  const cleaned = encoded.replace(/\n/g, '')
  const binary = atob(cleaned)

  // Handle multi-byte UTF-8: decode via TextDecoder
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}
