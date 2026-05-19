/**
 * KVSessionAdapter — Cloudflare KV implementation of SessionPort.
 *
 * Wraps KV get/put/delete behind the stable SessionPort interface
 * so plugins never import KV types directly.
 */
import type { SessionPort } from '../types'

/** Minimal KV interface — avoids importing @cloudflare/workers-types in kernel. */
interface KVBinding {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

export class KVSessionAdapter implements SessionPort {
  constructor(private readonly kv: KVBinding) {}

  async get(key: string): Promise<string | null> {
    return this.kv.get(key)
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const options = ttlSeconds ? { expirationTtl: ttlSeconds } : undefined
    await this.kv.put(key, value, options)
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key)
  }
}
