/**
 * KVContentAdapter — Cloudflare KV implementation of ContentPort.
 *
 * Wraps KV get/put/list behind the stable ContentPort interface
 * so plugins never import KV types directly.
 */
import type { ContentPort } from '../types'

/** Minimal KV interface — avoids importing @cloudflare/workers-types in kernel. */
interface KVBinding {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
  list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }>
}

export class KVContentAdapter implements ContentPort {
  constructor(private readonly kv: KVBinding) {}

  async getPage(key: string): Promise<string | null> {
    return this.kv.get(key)
  }

  async putPage(key: string, html: string): Promise<void> {
    await this.kv.put(key, html)
  }

  async listPages(prefix: string): Promise<string[]> {
    const result = await this.kv.list({ prefix })
    return result.keys.map(k => k.name)
  }
}
