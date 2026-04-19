/**
 * FileContentAdapter — Filesystem implementation of ContentPort.
 *
 * Stores content as files on disk. Designed for Node.js/Deno/Bun
 * environments where a filesystem is available (not Cloudflare Workers).
 *
 * Pass a FileSystem interface to keep this adapter portable.
 */
import type { ContentPort } from '../types'

/** Minimal filesystem interface — works with Node.js fs/promises or any compatible impl. */
export interface FileSystem {
  readFile(path: string, encoding: 'utf-8'): Promise<string>
  writeFile(path: string, data: string): Promise<void>
  readdir(path: string): Promise<string[]>
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
  stat(path: string): Promise<{ isFile(): boolean }>
}

export class FileContentAdapter implements ContentPort {
  constructor(
    private readonly fs: FileSystem,
    private readonly baseDir: string,
  ) {}

  private keyToPath(key: string): string {
    // Sanitize key to prevent path traversal
    const safe = key.replace(/\.\./g, '').replace(/^\//, '')
    return `${this.baseDir}/${safe}.html`
  }

  async getPage(key: string): Promise<string | null> {
    try {
      return await this.fs.readFile(this.keyToPath(key), 'utf-8')
    } catch {
      return null
    }
  }

  async putPage(key: string, html: string): Promise<void> {
    const path = this.keyToPath(key)
    // Ensure parent directory exists
    const dir = path.slice(0, path.lastIndexOf('/'))
    await this.fs.mkdir(dir, { recursive: true })
    await this.fs.writeFile(path, html)
  }

  async listPages(prefix: string): Promise<string[]> {
    try {
      const dir = prefix ? `${this.baseDir}/${prefix}` : this.baseDir
      const files = await this.fs.readdir(dir)
      return files
        .filter(f => f.endsWith('.html'))
        .map(f => (prefix ? `${prefix}/${f}` : f).replace(/\.html$/, ''))
    } catch {
      return []
    }
  }
}
