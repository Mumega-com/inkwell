import type { BusPort, BusMessage } from '../types'

/**
 * SOS bus adapter — communicates via the bus bridge REST API (:6380).
 * The bridge exposes /send, /inbox, /broadcast, /peers as plain HTTP.
 * Subscribe is poll-based (SSE planned for SOS v0.8.x).
 *
 * NOTE: SOS_BUS_URL should point to the bus bridge (e.g. http://localhost:6380
 * or the nginx proxy), NOT the MCP SSE server (:6070).
 */
export class SOSBusAdapter implements BusPort {
  constructor(
    private busUrl: string,
    private token: string,
    private agentName: string,
  ) {}

  async send(to: string, text: string): Promise<void> {
    // Bus bridge expects { from, to, text }
    const body = { from: this.agentName, to, text: `${this.agentName} here: ${text}` }
    await this.post('/send', body)
  }

  async broadcast(text: string): Promise<void> {
    await this.post('/broadcast', { from: this.agentName, text: `${this.agentName} here: ${text}` })
  }

  async subscribe(callback: (msg: BusMessage) => Promise<void>): Promise<{ unsubscribe: () => Promise<void> }> {
    // Poll-based: SOS v0.7.x only supports inbox polling
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

    poll().catch(() => { polling = false })

    return {
      unsubscribe: async () => { polling = false },
    }
  }

  async inbox(limit?: number): Promise<BusMessage[]> {
    // Bus bridge expects ?agent=<name>&limit=<n>
    const params = `?agent=${encodeURIComponent(this.agentName)}&limit=${limit ?? 10}`
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
