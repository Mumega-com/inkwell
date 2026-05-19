/**
 * R2StorageAdapter — Cloudflare R2 implementation of StoragePort.
 *
 * Wraps R2 get/put/delete/list behind the stable StoragePort interface
 * so plugins never import R2 types directly.
 */
import type { StoragePort } from '../types'

/** Minimal R2 interface — avoids importing @cloudflare/workers-types in kernel. */
interface R2Binding {
  get(key: string): Promise<R2Object | null>
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string } }): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string }): Promise<{ objects: Array<{ key: string }> }>
}

interface R2Object {
  body: ReadableStream
  httpMetadata?: { contentType?: string }
}

export class R2StorageAdapter implements StoragePort {
  constructor(private readonly r2: R2Binding) {}

  async get(key: string): Promise<{ body: ReadableStream; contentType: string } | null> {
    const obj = await this.r2.get(key)
    if (!obj) return null
    return {
      body: obj.body,
      contentType: obj.httpMetadata?.contentType ?? 'application/octet-stream',
    }
  }

  async put(key: string, data: ReadableStream | ArrayBuffer | string, contentType?: string): Promise<void> {
    await this.r2.put(key, data, contentType ? { httpMetadata: { contentType } } : undefined)
  }

  async delete(key: string): Promise<void> {
    await this.r2.delete(key)
  }

  async list(prefix?: string): Promise<string[]> {
    const result = await this.r2.list(prefix ? { prefix } : undefined)
    return result.objects.map(o => o.key)
  }
}
