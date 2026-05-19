import type { MemoryPort, MemoryResult } from '../types'

/**
 * SOS Mirror memory adapter — workspace-isolated vector memory via Mirror API (:8844).
 *
 * Mirror v2 contract (2026-04-22):
 *   POST /store  — store engram; workspace isolation enforced by Bearer token server-side
 *   POST /search — semantic search; results scoped to token's workspace
 *   GET  /recent/{agent} — recent engrams by agent series
 *
 * No prefix workaround needed — the token determines the workspace boundary.
 * Issue resolved: was prefixing `[tenantId]` as soft isolation (SOS v0.8.0 gap).
 */
export class SOSMemoryAdapter implements MemoryPort {
  constructor(
    private mirrorUrl: string,
    private token: string,
    private agentId: string = 'inkwell',
  ) {}

  async remember(content: string, metadata?: Record<string, unknown>): Promise<string> {
    const contextId = `ink_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const res = await fetch(`${this.mirrorUrl}/store`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context_id: contextId,
        agent: this.agentId,
        text: content,
        epistemic_truths: [],
        core_concepts: [],
        affective_vibe: 'Neutral',
        energy_level: 'Balanced',
        next_attractor: '',
        metadata: metadata ?? {},
      }),
    })

    if (!res.ok) throw new Error(`Mirror store failed: ${res.status}`)
    const data = await res.json() as { context_id?: string }
    return data.context_id ?? contextId
  }

  async recall(query: string, limit = 10): Promise<MemoryResult[]> {
    return this.search(query, { limit })
  }

  async search(query: string, filters?: Record<string, unknown>): Promise<MemoryResult[]> {
    const topK = typeof filters?.limit === 'number' ? filters.limit : 10
    const threshold = typeof filters?.threshold === 'number' ? filters.threshold : 0.5

    const res = await fetch(`${this.mirrorUrl}/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, top_k: topK, threshold }),
    })

    if (!res.ok) return []

    const rows = await res.json() as Array<{
      id?: string
      context_id?: string
      text?: string
      similarity?: number
      timestamp?: string
    }>

    return rows.map(r => ({
      id: r.id ?? r.context_id ?? '',
      content: r.text ?? '',
      score: r.similarity,
      createdAt: r.timestamp ?? new Date().toISOString(),
    }))
  }
}
