import type { AgentPort, AgentConfig, AgentUsage, DatabasePort } from '../types'

export class D1AgentAdapter implements AgentPort {
  constructor(private db: DatabasePort) {}

  async provision(config: Omit<AgentConfig, 'status' | 'createdAt' | 'updatedAt'>): Promise<AgentConfig> {
    const now = new Date().toISOString()
    const full: AgentConfig = {
      ...config,
      status: 'provisioning',
      createdAt: now,
      updatedAt: now,
    }

    await this.db.execute(
      `INSERT INTO agent_configs (tenant_id, model, system_prompt, mcp_servers, tools, budget_per_day, budget_per_month, status, anthropic_agent_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id) DO UPDATE SET
         model = excluded.model,
         system_prompt = excluded.system_prompt,
         mcp_servers = excluded.mcp_servers,
         tools = excluded.tools,
         budget_per_day = excluded.budget_per_day,
         budget_per_month = excluded.budget_per_month,
         status = excluded.status,
         anthropic_agent_id = excluded.anthropic_agent_id,
         updated_at = excluded.updated_at`,
      [
        full.tenantId, full.model, full.systemPrompt,
        JSON.stringify(full.mcpServers), JSON.stringify(full.tools),
        full.budgetPerDay, full.budgetPerMonth,
        full.status, full.anthropicAgentId ?? null,
        full.createdAt, full.updatedAt,
      ],
    )

    return full
  }

  async getConfig(tenantId: string): Promise<AgentConfig | null> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM agent_configs WHERE tenant_id = ?',
      [tenantId],
    )
    return row ? this.rowToConfig(row) : null
  }

  async updateConfig(
    tenantId: string,
    updates: Partial<Pick<AgentConfig, 'model' | 'systemPrompt' | 'mcpServers' | 'tools' | 'budgetPerDay' | 'budgetPerMonth' | 'status'>>,
  ): Promise<AgentConfig> {
    const sets: string[] = []
    const params: unknown[] = []

    if (updates.model !== undefined) { sets.push('model = ?'); params.push(updates.model) }
    if (updates.systemPrompt !== undefined) { sets.push('system_prompt = ?'); params.push(updates.systemPrompt) }
    if (updates.mcpServers !== undefined) { sets.push('mcp_servers = ?'); params.push(JSON.stringify(updates.mcpServers)) }
    if (updates.tools !== undefined) { sets.push('tools = ?'); params.push(JSON.stringify(updates.tools)) }
    if (updates.budgetPerDay !== undefined) { sets.push('budget_per_day = ?'); params.push(updates.budgetPerDay) }
    if (updates.budgetPerMonth !== undefined) { sets.push('budget_per_month = ?'); params.push(updates.budgetPerMonth) }
    if (updates.status !== undefined) { sets.push('status = ?'); params.push(updates.status) }

    sets.push('updated_at = ?')
    params.push(new Date().toISOString())
    params.push(tenantId)

    await this.db.execute(
      `UPDATE agent_configs SET ${sets.join(', ')} WHERE tenant_id = ?`,
      params,
    )

    const config = await this.getConfig(tenantId)
    if (!config) throw new Error(`Agent config not found for tenant ${tenantId}`)
    return config
  }

  async recordUsage(usage: AgentUsage): Promise<void> {
    await this.db.execute(
      `INSERT INTO agent_usage (tenant_id, date, session_hours, input_tokens, output_tokens, cost_cents)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, date) DO UPDATE SET
         session_hours = agent_usage.session_hours + excluded.session_hours,
         input_tokens = agent_usage.input_tokens + excluded.input_tokens,
         output_tokens = agent_usage.output_tokens + excluded.output_tokens,
         cost_cents = agent_usage.cost_cents + excluded.cost_cents`,
      [usage.tenantId, usage.date, usage.sessionHours, usage.inputTokens, usage.outputTokens, usage.costCents],
    )
  }

  async getUsage(tenantId: string, from: string, to: string): Promise<AgentUsage[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT * FROM agent_usage WHERE tenant_id = ? AND date >= ? AND date <= ? ORDER BY date DESC',
      [tenantId, from, to],
    )
    return rows.map(this.rowToUsage)
  }

  async checkBudget(tenantId: string): Promise<{ allowed: boolean; remainingCents: number; reason?: string }> {
    const config = await this.getConfig(tenantId)
    if (!config) return { allowed: false, remainingCents: 0, reason: 'No agent configured' }
    if (config.status !== 'active') return { allowed: false, remainingCents: 0, reason: `Agent status: ${config.status}` }

    const today = new Date().toISOString().slice(0, 10)
    const todayUsage = await this.db.queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(cost_cents), 0) as total FROM agent_usage WHERE tenant_id = ? AND date = ?',
      [tenantId, today],
    )

    const dailySpent = todayUsage?.total ?? 0
    const dailyRemaining = config.budgetPerDay - dailySpent

    if (dailyRemaining <= 0) {
      return { allowed: false, remainingCents: 0, reason: 'Daily budget exhausted' }
    }

    // Check monthly budget
    const monthStart = today.slice(0, 7) + '-01'
    const monthUsage = await this.db.queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(cost_cents), 0) as total FROM agent_usage WHERE tenant_id = ? AND date >= ?',
      [tenantId, monthStart],
    )

    const monthlySpent = monthUsage?.total ?? 0
    const monthlyRemaining = config.budgetPerMonth - monthlySpent

    if (monthlyRemaining <= 0) {
      return { allowed: false, remainingCents: 0, reason: 'Monthly budget exhausted' }
    }

    return { allowed: true, remainingCents: Math.min(dailyRemaining, monthlyRemaining) }
  }

  private rowToConfig(row: Record<string, unknown>): AgentConfig {
    return {
      tenantId: row['tenant_id'] as string,
      model: row['model'] as AgentConfig['model'],
      systemPrompt: row['system_prompt'] as string,
      mcpServers: JSON.parse(row['mcp_servers'] as string || '[]'),
      tools: JSON.parse(row['tools'] as string || '[]'),
      budgetPerDay: row['budget_per_day'] as number,
      budgetPerMonth: row['budget_per_month'] as number,
      status: row['status'] as AgentConfig['status'],
      anthropicAgentId: row['anthropic_agent_id'] as string | undefined,
      createdAt: row['created_at'] as string,
      updatedAt: row['updated_at'] as string,
    }
  }

  private rowToUsage(row: Record<string, unknown>): AgentUsage {
    return {
      tenantId: row['tenant_id'] as string,
      date: row['date'] as string,
      sessionHours: row['session_hours'] as number,
      inputTokens: row['input_tokens'] as number,
      outputTokens: row['output_tokens'] as number,
      costCents: row['cost_cents'] as number,
    }
  }
}
