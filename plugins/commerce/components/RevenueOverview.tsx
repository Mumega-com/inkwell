import { useState, useEffect, useCallback } from 'react'

interface RevenueData {
  total_revenue_cents: number
  platform_fees_cents: number
  breakdown_by_type: Record<string, { count: number; total_cents: number }>
}

interface Transaction {
  id: string
  amount_cents: number
  currency: string
  tx_type: string
  status: string
  description: string | null
  created_at: string
}

function getApiConfig() {
  return {
    url: localStorage.getItem('inkwell_api_url') ?? '',
    token: localStorage.getItem('inkwell_auth_token') ?? '',
  }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      padding: '1rem 1.25rem', background: 'var(--ink-surface)', border: '1px solid var(--ink-border)',
      borderRadius: '6px', flex: '1 1 180px', minWidth: '160px',
    }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink-text)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--ink-dim)', marginTop: '0.2rem' }}>{sub}</div>}
    </div>
  )
}

const statusColors: Record<string, string> = {
  pending: '#D4A017',
  settled: '#10B981',
  failed: '#EF4444',
  refunded: '#FB923C',
}

export function RevenueOverview() {
  const [revenue, setRevenue] = useState<RevenueData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const load = useCallback(async () => {
    const { url, token } = getApiConfig()
    if (!url) return
    setLoading(true)
    try {
      const [revRes, txRes] = await Promise.all([
        fetch(`${url}/api/glass/revenue?period=${period}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${url}/api/glass/transactions?limit=20`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (revRes.ok) {
        const data = await revRes.json() as RevenueData
        setRevenue(data)
      }
      if (txRes.ok) {
        const data = await txRes.json() as { transactions: Transaction[] }
        setTransactions(data.transactions ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  const netRevenue = revenue ? revenue.total_revenue_cents - revenue.platform_fees_cents : 0
  const txTypes = revenue ? Object.entries(revenue.breakdown_by_type) : []
  const totalTxCount = txTypes.reduce((sum, [, v]) => sum + v.count, 0)

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--ink-muted)' }}>Loading...</div>
  }

  return (
    <div>
      {/* Period selector */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>Period:</label>
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          style={{
            background: 'var(--ink-surface)', border: '1px solid var(--ink-border)',
            borderRadius: '4px', padding: '4px 8px', color: 'var(--ink-text)',
            fontSize: '0.82rem', colorScheme: 'dark',
          }}
        />
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <KPI label="Gross Revenue" value={formatCents(revenue?.total_revenue_cents ?? 0)} sub={`${totalTxCount} transactions`} />
        <KPI label="Net Revenue" value={formatCents(netRevenue)} sub="After platform fees" />
        <KPI label="Platform Fees" value={formatCents(revenue?.platform_fees_cents ?? 0)} sub="5% rate" />
      </div>

      {/* Breakdown by type */}
      {txTypes.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink-text)', marginBottom: '0.5rem' }}>By Type</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {txTypes.map(([type, data]) => (
              <div key={type} style={{
                padding: '0.5rem 0.75rem', background: 'var(--ink-surface)', border: '1px solid var(--ink-border)',
                borderRadius: '4px', fontSize: '0.78rem',
              }}>
                <span style={{ color: 'var(--ink-text)', fontWeight: 600 }}>{type}</span>
                <span style={{ color: 'var(--ink-muted)', marginLeft: '0.5rem' }}>{data.count}x</span>
                <span style={{ color: 'var(--ink-dim)', marginLeft: '0.5rem' }}>{formatCents(data.total_cents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink-text)', marginBottom: '0.5rem' }}>Recent Transactions</div>
      <div style={{ background: 'var(--ink-surface)', border: '1px solid var(--ink-border)', borderRadius: '6px', overflow: 'hidden' }}>
        {transactions.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--ink-dim)', fontSize: '0.78rem' }}>No transactions yet</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--ink-border)' }}>
                {['Type', 'Amount', 'Status', 'Date', 'Description'].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--ink-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id} style={{ borderBottom: '1px solid var(--ink-border)' }}>
                  <td style={{ padding: '0.5rem 0.75rem', color: 'var(--ink-text)' }}>{tx.tx_type}</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: 'var(--ink-text)', fontFamily: 'var(--ink-font-mono, monospace)' }}>{formatCents(tx.amount_cents)}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <span style={{ color: statusColors[tx.status] ?? 'var(--ink-muted)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{tx.status}</span>
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', color: 'var(--ink-dim)' }}>{new Date(tx.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: 'var(--ink-dim)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
