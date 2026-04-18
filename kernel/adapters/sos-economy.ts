import type { EconomyPort, ChargeResult } from '../types'

/**
 * SOS Economy adapter — uses SOS Economy REST API for token-based billing.
 * Economy REST is live (SOS v0.5.4+). MCP tools (economy_check, economy_charge)
 * coming in SOS v0.7.3.
 */
export class SOSEconomyAdapter implements EconomyPort {
  constructor(
    private economyUrl: string,
    private token: string,
  ) {}

  async recordUsage(tenantId: string, type: string, amount: number): Promise<void> {
    await this.post('/usage', { tenant_id: tenantId, type, amount })
  }

  async getBalance(tenantId: string): Promise<{ balance: number; currency: string }> {
    const res = await fetch(`${this.economyUrl}/balance/${tenantId}`, {
      headers: { 'Authorization': `Bearer ${this.token}` },
    })
    if (!res.ok) return { balance: 0, currency: 'MIND' }
    return await res.json() as { balance: number; currency: string }
  }

  async charge(tenantId: string, amount: number, reason: string): Promise<ChargeResult> {
    const res = await this.post('/charge', { tenant_id: tenantId, amount, reason })
    return res as ChargeResult
  }

  async transfer(from: string, to: string, amount: number, reason: string): Promise<ChargeResult> {
    const res = await this.post('/transfer', { from, to, amount, reason })
    return res as ChargeResult
  }

  private async post(path: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${this.economyUrl}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Economy ${path} failed: ${res.status} ${text}`)
    }
    return await res.json()
  }
}
