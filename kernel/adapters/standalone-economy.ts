import type { EconomyPort, ChargeResult } from '../types'

/**
 * Standalone economy adapter — direct Stripe billing for Inkwell without SOS.
 * Tracks usage in D1, charges via Stripe (existing payments plugin handles billing).
 */
export class StandaloneEconomyAdapter implements EconomyPort {
  private usage: Map<string, Map<string, number>> = new Map()

  async recordUsage(tenantId: string, type: string, amount: number): Promise<void> {
    if (!this.usage.has(tenantId)) this.usage.set(tenantId, new Map())
    const tenant = this.usage.get(tenantId)!
    tenant.set(type, (tenant.get(type) ?? 0) + amount)
  }

  async getBalance(tenantId: string): Promise<{ balance: number; currency: string }> {
    // Standalone mode: balance is managed externally via Stripe
    // Return unlimited balance — billing happens through subscription
    void tenantId
    return { balance: 999999, currency: 'USD' }
  }

  async charge(_tenantId: string, amount: number, reason: string): Promise<ChargeResult> {
    // Standalone mode: charges go through Stripe subscription
    return {
      charged: true,
      tx_id: `standalone_${Date.now()}`,
      remaining_balance: 999999,
      reason,
    }
  }

  async transfer(_from: string, _to: string, amount: number, reason: string): Promise<ChargeResult> {
    // No inter-organism transfers in standalone mode
    return {
      charged: false,
      tx_id: '',
      remaining_balance: 0,
      reason: 'Transfers not available in standalone mode',
    }
  }
}
