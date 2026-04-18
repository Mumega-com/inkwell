import type { BusPort, BusMessage } from '../types'

/**
 * SOS bus adapter — communicates via SOS MCP HTTP endpoints.
 * Uses the SOS bus API (send, broadcast, inbox) over HTTP.
 * Subscribe is poll-based (SSE planned for SOS v0.8.x).
 */
export class SOSBusAdapter implements BusPort {
  constructor(
    private busUrl: string,
    private token: string,
    private agentName: string,
  ) {}

  async send(to: string, text: string): Promise<void> {
    const body = { to, text: `${this.agentName} here: ${text}` }
    await this.post('/send', body)
  }

  async broadcast(text: string): Promise<void> {
    await this.post('/broadcast', { text: `${this.agentName} here: ${text}` })
  }

  async subscribe(callback: (msg: BusMessage) => Promise<void>): Promise<{ unsubscribe: () => Promise<void> }> {
    // Poll-based: SOS v0.7.x only supports inbox polling
    // SSE streaming planned for v0.8.x
    let polling = true
    let lastTs = ''

    const poll = async () => {
      while (polling) {
        const messages = await this.inbox(10)
        for (const msg of messages) {
          if (msg.ts > lastTs) {
            lastTs = msg.ts
            await callback(msg)
          }
        }
        await new Promise(r => setTimeout(r, 5000))
      }
    }

    // Start polling in background (non-blocking)
    poll().catch(() => { polling = false })

    return {
      unsubscribe: async () => { polling = false },
    }
  }

  async inbox(limit?: number): Promise<BusMessage[]> {
    const params = limit ? `?limit=${limit}` : ''
    const res = await fetch(`${this.busUrl}/inbox${params}`, {
      headers: { 'Authorization': `Bearer ${this.token}` },
    })
    if (!res.ok) return []
    const data = await res.json() as { messages?: BusMessage[] }
    return data.messages ?? []
  }

  private async post(path: string, body: Record<string, unknown>): Promise<void> {
    await fetch(`${this.busUrl}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }
}
