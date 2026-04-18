import type { MemoryPort, MemoryResult } from '../types'

/**
 * SOS Mirror memory adapter — vector memory via Mirror API (:8844).
 * Mirror endpoints: POST /store, POST /search (not /remember, /recall).
 * Note: Mirror is NOT tenant-scoped yet (SOS v0.8.0 planned).
 * Inkwell prefixes content with tenant ID for soft isolation.
 */
export class SOSMemoryAdapter implements MemoryPort {
  constructor(
    private mirrorUrl: string,
    private token: string,
    private tenantId: string,
  ) {}

  async remember(content: string, metadata?: Record<string, unknown>): Promise<string> {
    const res = await fetch(`${this.mirrorUrl}/store`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: `[${this.tenantId}] ${content}`,
        metadata: { ...metadata, tenant: this.tenantId },
      }),
    })
    if (!res.ok) throw new Error(`Mirror store failed: ${res.status}`)
    const data = await res.json() as { id?: string }
    return data.id ?? `mem_${Date.now()}`
  }

  async recall(query: string, limit = 10): Promise<MemoryResult[]> {
    const res = await fetch(`${this.mirrorUrl}/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `[${this.tenantId}] ${query}`,
        limit,
      }),
    })
    if (!res.ok) return []
    const data = await res.json() as { results?: MemoryResult[] }
    return data.results ?? []
  }

  async search(query: string, filters?: Record<string, unknown>): Promise<MemoryResult[]> {
    return this.recall(query, (filters?.limit as number) ?? 10)
  }
}
