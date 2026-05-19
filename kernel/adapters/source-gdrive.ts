/**
 * GoogleDriveSourceAdapter — Google Drive implementation of ContentSourcePort.
 *
 * Fetches Google Docs and .md files from a Drive folder via the Drive API v3.
 * Uses only `fetch()` — safe for Cloudflare Worker context.
 */
import type { ContentSourcePort, ContentSourceItem } from '../types'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const FIELDS = 'files(id,name,mimeType,modifiedTime,webViewLink),nextPageToken'
const GDOC_MIME = 'application/vnd.google-apps.document'

interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  webViewLink?: string
}

interface DriveListResponse {
  files: DriveFile[]
  nextPageToken?: string
}

interface GDriveConfig {
  accessToken: string
  folderId: string
}

/** Derive a URL-safe slug from a filename: lowercase, hyphens, no extension. */
function toSlug(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')        // strip extension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')    // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, '')        // trim leading/trailing hyphens
}

/** Wrap plain text content with frontmatter. */
function withFrontmatter(title: string, content: string): string {
  return `---\ntitle: ${title}\nsource: google-drive\n---\n\n${content}`
}

export class GoogleDriveSourceAdapter implements ContentSourcePort {
  readonly name = 'google-drive'
  private readonly accessToken: string
  private readonly folderId: string

  constructor(config: GDriveConfig) {
    this.accessToken = config.accessToken
    this.folderId = config.folderId
  }

  async list(): Promise<ContentSourceItem[]> {
    const files = await this.listFiles()
    return this.fetchContents(files)
  }

  async sync(since?: string): Promise<ContentSourceItem[]> {
    const files = await this.listFiles(since)
    return this.fetchContents(files)
  }

  // ── Private ────────────────────────────────────────────────────────────

  /** List all Google Docs and .md files in the configured folder, handling pagination. */
  private async listFiles(since?: string): Promise<DriveFile[]> {
    const files: DriveFile[] = []
    let pageToken: string | undefined

    do {
      const q = this.buildQuery(since)
      const url = new URL(`${DRIVE_API}/files`)
      url.searchParams.set('q', q)
      url.searchParams.set('fields', FIELDS)
      url.searchParams.set('pageSize', '100')
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken)
      }

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Drive API list failed (${res.status}): ${body}`)
      }

      const data = (await res.json()) as DriveListResponse
      files.push(...(data.files ?? []))
      pageToken = data.nextPageToken
    } while (pageToken)

    return files
  }

  /** Build the Drive API query string. Filters to Google Docs and .md files. */
  private buildQuery(since?: string): string {
    const clauses: string[] = [
      `'${this.folderId}' in parents`,
      'trashed = false',
      `(mimeType = '${GDOC_MIME}' or name contains '.md')`,
    ]

    if (since) {
      clauses.push(`modifiedTime > '${since}'`)
    }

    return clauses.join(' and ')
  }

  /** Fetch content for each file — export Google Docs as plain text, download .md files. */
  private async fetchContents(files: DriveFile[]): Promise<ContentSourceItem[]> {
    const items: ContentSourceItem[] = []

    for (const file of files) {
      const content = await this.fetchFileContent(file)
      if (content === null) continue

      items.push({
        slug: toSlug(file.name),
        title: file.name.replace(/\.[^.]+$/, ''),
        content: withFrontmatter(file.name.replace(/\.[^.]+$/, ''), content),
        updatedAt: file.modifiedTime,
        metadata: {
          driveFileId: file.id,
          mimeType: file.mimeType,
          webViewLink: file.webViewLink ?? null,
        },
      })
    }

    return items
  }

  /** Fetch a single file's text content from Drive. */
  private async fetchFileContent(file: DriveFile): Promise<string | null> {
    const isGDoc = file.mimeType === GDOC_MIME
    const url = isGDoc
      ? `${DRIVE_API}/files/${file.id}/export?mimeType=text/plain`
      : `${DRIVE_API}/files/${file.id}?alt=media`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    })

    if (!res.ok) {
      // Skip files that fail to download rather than crashing the entire sync
      return null
    }

    return res.text()
  }
}
