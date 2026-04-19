/**
 * RedisSessionAdapter — Redis implementation of SessionPort.
 *
 * Accepts any client implementing the RedisClient interface below.
 * Compatible with:
 *   - ioredis
 *   - @upstash/redis (edge-compatible)
 *   - redis (Node.js)
 *   - Any Redis-compatible store (KeyDB, DragonflyDB, Valkey)
 */
import type { SessionPort } from '../types'

/** Minimal Redis client interface — keeps adapter agnostic. */
export interface RedisClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, options?: { ex?: number }): Promise<unknown>
  del(key: string): Promise<unknown>
}

export class RedisSessionAdapter implements SessionPort {
  constructor(private readonly redis: RedisClient) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key)
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.redis.set(key, value, ttlSeconds ? { ex: ttlSeconds } : undefined)
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key)
  }
}
