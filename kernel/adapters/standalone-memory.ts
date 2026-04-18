import type { MemoryPort, MemoryResult } from '../types'

/**
 * Standalone memory adapter — KV-backed memory for Inkwell without SOS.
 * Uses ContentPort-style KV storage. Simple keyword search (no vectors).
 */
export class StandaloneMemoryAdapter implements MemoryPort {
  private memories: Map<string, { content: string; metadata?: Record<string, unknown>; createdAt: string }> = new Map()
  private counter = 0

  async remember(content: string, metadata?: Record<string, unknown>): Promise<string> {
    const id = `mem_${++this.counter}_${Date.now()}`
    this.memories.set(id, { content, metadata, createdAt: new Date().toISOString() })
    return id
  }

  async recall(query: string, limit = 10): Promise<MemoryResult[]> {
    return this.search(query, { limit })
  }

  async search(query: string, filters?: Record<string, unknown>): Promise<MemoryResult[]> {
    const limit = (filters?.limit as number) ?? 10
    const queryLower = query.toLowerCase()
    const results: MemoryResult[] = []

    for (const [id, mem] of this.memories) {
      if (mem.content.toLowerCase().includes(queryLower)) {
        results.push({
          id,
          content: mem.content,
          metadata: mem.metadata,
          score: 1.0,
          createdAt: mem.createdAt,
        })
      }
      if (results.length >= limit) break
    }

    return results
  }
}
