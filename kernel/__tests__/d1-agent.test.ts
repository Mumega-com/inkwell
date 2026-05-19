import { describe, it, expect, beforeEach } from 'vitest'
import { D1AgentAdapter } from '../adapters/d1-agent'
import type { DatabasePort, AgentUsage } from '../types'

// In-memory DatabasePort mock
function createMockDb(): DatabasePort {
  const tables: Record<string, Record<string, unknown>[]> = {
    agent_configs: [],
    agent_usage: [],
  }

  return {
    async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
      const table = sql.includes('agent_configs') ? 'agent_configs' : 'agent_usage'
      let rows = [...tables[table]]

      // Simple WHERE clause matching
      if (params && params.length > 0) {
        if (sql.includes('tenant_id = ?')) {
          rows = rows.filter(r => r['tenant_id'] === params![0])
        }
        if (sql.includes('date >= ?') && sql.includes('date <= ?')) {
          const from = params![1] as string
          const to = params![2] as string
          rows = rows.filter(r => (r['date'] as string) >= from && (r['date'] as string) <= to)
        }
      }
      return rows as T[]
    },
    async queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
      const results = await this.query<T>(sql, params)
      return results[0] ?? null
    },
    async execute(sql: string, params?: unknown[]): Promise<{ changes: number }> {
      if (sql.includes('INSERT INTO agent_configs')) {
        const existing = tables['agent_configs'].findIndex(r => r['tenant_id'] === params![0])
        const row: Record<string, unknown> = {
          tenant_id: params![0], model: params![1], system_prompt: params![2],
          mcp_servers: params![3], tools: params![4], budget_per_day: params![5],
          budget_per_month: params![6], status: params![7], anthropic_agent_id: params![8],
          created_at: params![9], updated_at: params![10],
        }
        if (existing >= 0) {
          tables['agent_configs'][existing] = row
        } else {
          tables['agent_configs'].push(row)
        }
        return { changes: 1 }
      }
      if (sql.includes('INSERT INTO agent_usage')) {
        const existing = tables['agent_usage'].findIndex(
          r => r['tenant_id'] === params![0] && r['date'] === params![1]
        )
        if (existing >= 0) {
          const r = tables['agent_usage'][existing]
          r['session_hours'] = (r['session_hours'] as number) + (params![2] as number)
          r['input_tokens'] = (r['input_tokens'] as number) + (params![3] as number)
          r['output_tokens'] = (r['output_tokens'] as number) + (params![4] as number)
          r['cost_cents'] = (r['cost_cents'] as number) + (params![5] as number)
        } else {
          tables['agent_usage'].push({
            tenant_id: params![0], date: params![1], session_hours: params![2],
            input_tokens: params![3], output_tokens: params![4], cost_cents: params![5],
          })
        }
        return { changes: 1 }
      }
      if (sql.includes('UPDATE agent_configs')) {
        const tenantId = params![params!.length - 1]
        const row = tables['agent_configs'].find(r => r['tenant_id'] === tenantId)
        if (row) {
          // Parse SET clauses from params
          let paramIdx = 0
          if (sql.includes('model = ?')) row['model'] = params![paramIdx++]
          if (sql.includes('system_prompt = ?')) row['system_prompt'] = params![paramIdx++]
          if (sql.includes('status = ?')) row['status'] = params![paramIdx++]
          row['updated_at'] = params![params!.length - 2]
        }
        return { changes: row ? 1 : 0 }
      }
      return { changes: 0 }
    },
    async batch(): Promise<void> {},
  }
}

describe('D1AgentAdapter', () => {
  let adapter: D1AgentAdapter
  let db: DatabasePort

  beforeEach(() => {
    db = createMockDb()
    adapter = new D1AgentAdapter(db)
  })

  describe('provision', () => {
    it('creates a new agent config', async () => {
      const config = await adapter.provision({
        tenantId: 'test-tenant',
        model: 'haiku',
        systemPrompt: 'Test prompt',
        mcpServers: [{ url: 'https://mcp.test.com/sse' }],
        tools: ['publish_content'],
        budgetPerDay: 500,
        budgetPerMonth: 10000,
      })

      expect(config.tenantId).toBe('test-tenant')
      expect(config.model).toBe('haiku')
      expect(config.status).toBe('provisioning')
      expect(config.createdAt).toBeTruthy()
    })
  })

  describe('getConfig', () => {
    it('returns null for non-existent tenant', async () => {
      const config = await adapter.getConfig('nonexistent')
      expect(config).toBeNull()
    })

    it('returns config after provision', async () => {
      await adapter.provision({
        tenantId: 'test-tenant',
        model: 'sonnet',
        systemPrompt: 'Test',
        mcpServers: [],
        tools: [],
        budgetPerDay: 500,
        budgetPerMonth: 10000,
      })

      const config = await adapter.getConfig('test-tenant')
      expect(config).not.toBeNull()
      expect(config!.model).toBe('sonnet')
    })
  })

  describe('recordUsage + getUsage', () => {
    it('records and retrieves usage', async () => {
      const usage: AgentUsage = {
        tenantId: 'test-tenant',
        date: '2026-04-18',
        sessionHours: 0.5,
        inputTokens: 1000,
        outputTokens: 500,
        costCents: 10,
      }

      await adapter.recordUsage(usage)
      const results = await adapter.getUsage('test-tenant', '2026-04-01', '2026-04-30')

      expect(results.length).toBe(1)
      expect(results[0].costCents).toBe(10)
    })

    it('accumulates usage on the same date', async () => {
      await adapter.recordUsage({
        tenantId: 'test-tenant', date: '2026-04-18',
        sessionHours: 0.5, inputTokens: 1000, outputTokens: 500, costCents: 10,
      })
      await adapter.recordUsage({
        tenantId: 'test-tenant', date: '2026-04-18',
        sessionHours: 0.3, inputTokens: 800, outputTokens: 400, costCents: 8,
      })

      const results = await adapter.getUsage('test-tenant', '2026-04-01', '2026-04-30')
      expect(results.length).toBe(1)
      expect(results[0].costCents).toBe(18)
      expect(results[0].inputTokens).toBe(1800)
    })
  })

  describe('checkBudget', () => {
    it('returns not allowed when no agent configured', async () => {
      const result = await adapter.checkBudget('nonexistent')
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('No agent configured')
    })

    it('returns allowed for active agent with budget', async () => {
      await adapter.provision({
        tenantId: 'test-tenant', model: 'haiku', systemPrompt: 'Test',
        mcpServers: [], tools: [], budgetPerDay: 500, budgetPerMonth: 10000,
      })
      // Manually set status to active
      await adapter.updateConfig('test-tenant', { status: 'active' })

      const result = await adapter.checkBudget('test-tenant')
      expect(result.allowed).toBe(true)
      expect(result.remainingCents).toBeGreaterThan(0)
    })
  })
})

describe('Standalone adapters', () => {
  it('StandaloneBusAdapter is no-op', async () => {
    const { StandaloneBusAdapter } = await import('../adapters/standalone-bus')
    const bus = new StandaloneBusAdapter()
    await bus.send('test', 'hello')
    await bus.broadcast('hello')
    const msgs = await bus.inbox()
    expect(msgs).toEqual([])
    const sub = await bus.subscribe(async () => {})
    await sub.unsubscribe()
  })

  it('StandaloneMemoryAdapter stores and recalls', async () => {
    const { StandaloneMemoryAdapter } = await import('../adapters/standalone-memory')
    const mem = new StandaloneMemoryAdapter()
    const id = await mem.remember('test memory', { tag: 'test' })
    expect(id).toBeTruthy()
    const results = await mem.recall('test')
    expect(results.length).toBe(1)
    expect(results[0].content).toBe('test memory')
  })

  it('StandaloneEconomyAdapter returns unlimited balance', async () => {
    const { StandaloneEconomyAdapter } = await import('../adapters/standalone-economy')
    const econ = new StandaloneEconomyAdapter()
    const balance = await econ.getBalance('test')
    expect(balance.balance).toBe(999999)
    const charge = await econ.charge('test', 100, 'test charge')
    expect(charge.charged).toBe(true)
    const transfer = await econ.transfer('a', 'b', 50, 'test')
    expect(transfer.charged).toBe(false)
  })
})
