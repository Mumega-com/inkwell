import type { EconomyPort, ChargeResult } from '../types'

/**
 * SOS Economy adapter — uses SOS Economy REST API (:6062).
 * Real endpoints: /balance/:id, /debit, /credit, /usage, /budget/can-spend
 * Note: Economy uses user_id (not tenant_id), /debit (not /charge), no /transfer.
 */
export class SOSEconomyAdapter implements EconomyPort {
  constructor(
    private economyUrl: string,
    private token: string,
  ) {}

  async recordUsage(tenantId: string, type: string, amount: number): Promise<void> {
    // Economy expects UsageEventRequest schema — map our simple interface
    await this.post('/usage', {
      tenant: tenantId,
      provider: 'inkwell',
      model: type,
      input_tokens: 0,
      output_tokens: 0,
      cost_micros: amount * 10000,  // cents → micros
      metadata: { source: 'inkwell', type },
    })
  }

  async getBalance(tenantId: string): Promise<{ balance: number; currency: string }> {
    const res = await fetch(`${this.economyUrl}/balance/${tenantId}`, {
      headers: { 'Authorization': `Bearer ${this.token}` },
    })
    if (!res.ok) return { balance: 0, currency: 'RU' }
    const data = await res.json() as { balance?: number; currency?: string }
    return { balance: data.balance ?? 0, currency: data.currency ?? 'RU' }
  }

  async charge(tenantId: string, amount: number, reason: string): Promise<ChargeResult> {
    // Economy uses /debit, not /charge
    try {
      const data = await this.post('/debit', { user_id: tenantId, amount, reason })
      const result = data as Record<string, unknown>
      return {
        charged: true,
        tx_id: (result.tx_id as string) ?? `tx_${Date.now()}`,
        remaining_balance: (result.balance as number) ?? 0,
        reason,
      }
    } catch (err) {
      return {
        charged: false,
        tx_id: '',
        remaining_balance: 0,
        reason: err instanceof Error ? err.message : 'debit failed',
      }
    }
  }

  async transfer(from: string, to: string, amount: number, reason: string): Promise<ChargeResult> {
    // No native transfer — implement as debit + credit
    const debit = await this.charge(from, amount, `transfer to ${to}: ${reason}`)
    if (!debit.charged) return debit

    try {
      await this.post('/credit', { user_id: to, amount, reason: `transfer from ${from}: ${reason}` })
      return debit
    } catch (err) {
      // Debit succeeded but credit failed — refund
      await this.post('/credit', { user_id: from, amount, reason: `refund: transfer to ${to} failed` }).catch(() => {})
      return {
        charged: false,
        tx_id: '',
        remaining_balance: 0,
        reason: err instanceof Error ? err.message : 'credit leg failed',
      }
    }
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
