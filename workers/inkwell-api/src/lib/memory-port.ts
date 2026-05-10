// workers/inkwell-api/src/lib/memory-port.ts
// MemoryPort — wraps Mirror's REST interface for fire-and-forget content storage and recall.
// Mirror outage must never block a non-memory operation (publish, bus send).

export interface ContentEngram {
  slug: string
  title: string
  description: string
  tags: string[]
  type: string
  publishedAt: string
  url: string
}

export interface RecallResult {
  id: string
  text: string
  score: number
  metadata: Record<string, unknown>
}

export class MemoryPort {
  private readonly busUrl: string
  private readonly token: string

  constructor(busUrl: string, token: string) {
    this.busUrl = busUrl.replace(/\/$/, '')
    this.token = token
  }

  async storeContent(engram: ContentEngram): Promise<void> {
    const body = {
      agent: 'inkwell',
      context_id: `content:${engram.slug}`,
      text: `${engram.title}. ${engram.description}. Tags: ${engram.tags.join(', ')}`,
      project: 'mumega-com',
      epistemic_truths: engram.tags,
      core_concepts: [engram.title, ...engram.tags],
      metadata: {
        slug: engram.slug,
        url: engram.url,
        type: engram.type,
        published_at: engram.publishedAt,
      },
    }
    const res = await fetch(`${this.busUrl}/remember`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`MemoryPort.storeContent failed: ${res.status}`)
  }

  async recallContent(query: string, limit = 5): Promise<RecallResult[]> {
    const res = await fetch(`${this.busUrl}/recall`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ query, limit }),
    })
    if (!res.ok) return []
    const data = await res.json() as { results?: RecallResult[] }
    return data.results ?? []
  }
}

export function makeMemoryPort(
  sosUrl: string | undefined,
  token: string | undefined,
): MemoryPort | null {
  if (!sosUrl || !token) return null
  return new MemoryPort(sosUrl, token)
}
