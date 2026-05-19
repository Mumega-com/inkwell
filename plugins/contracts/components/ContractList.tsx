import { useState, useEffect, useCallback } from 'react'

interface Contract {
  id: string
  reference: string
  status: string
  customer_name: string
  customer_email: string | null
  vehicle_description: string | null
  origin: string | null
  destination: string | null
  service_type: string | null
  rate: number | null
  currency: string | null
  signed_at: string | null
  created_at: string
}

function getApiConfig() {
  return {
    url: localStorage.getItem('inkwell_api_url') ?? '',
    token: localStorage.getItem('inkwell_auth_token') ?? '',
  }
}

const statusColors: Record<string, { bg: string; text: string }> = {
  draft:     { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.5)' },
  sent:      { bg: 'rgba(6,182,212,0.15)',   text: '#06B6D4' },
  viewed:    { bg: 'rgba(212,160,23,0.15)',  text: '#D4A017' },
  signed:    { bg: 'rgba(16,185,129,0.15)',  text: '#10B981' },
  delivered: { bg: 'rgba(16,185,129,0.25)',  text: '#059669' },
}

function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] ?? statusColors.draft
  return (
    <span style={{
      display: 'inline-block', padding: '1px 8px', borderRadius: '10px',
      fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.04em', background: colors.bg, color: colors.text,
    }}>
      {status}
    </span>
  )
}

function KPI({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      padding: '1rem 1.25rem', background: 'var(--ink-surface)', border: '1px solid var(--ink-border)',
      borderRadius: '6px', flex: '1 1 140px', minWidth: '120px',
    }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink-text)' }}>{value}</div>
    </div>
  )
}

export function ContractList() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')

  const load = useCallback(async () => {
    const { url, token } = getApiConfig()
    if (!url) return
    setLoading(true)
    try {
      const params = filter ? `?status=${filter}` : ''
      const res = await fetch(`${url}/api/contracts${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json() as { contracts: Contract[]; total: number }
        setContracts(data.contracts ?? [])
        setTotal(data.total ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  const signed = contracts.filter(c => c.status === 'signed' || c.status === 'delivered').length
  const pending = contracts.filter(c => c.status === 'draft' || c.status === 'sent' || c.status === 'viewed').length
  const signRate = contracts.length > 0 ? Math.round((signed / contracts.length) * 100) : 0

  const statuses = ['', 'draft', 'sent', 'viewed', 'signed', 'delivered']

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--ink-muted)' }}>Loading...</div>
  }

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <KPI label="Total Contracts" value={total} />
        <KPI label="Signed" value={signed} />
        <KPI label="Pending" value={pending} />
        <KPI label="Sign Rate" value={`${signRate}%`} />
      </div>

      {/* Filter */}
      <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: '4px 12px', borderRadius: '4px', border: '1px solid var(--ink-border)',
              background: filter === s ? 'rgba(6,182,212,0.15)' : 'transparent',
              color: filter === s ? '#06B6D4' : 'var(--ink-muted)',
              cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize',
            }}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Contract List */}
      <div style={{ background: 'var(--ink-surface)', border: '1px solid var(--ink-border)', borderRadius: '6px', overflow: 'hidden' }}>
        {contracts.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--ink-dim)', fontSize: '0.78rem' }}>No contracts found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--ink-border)' }}>
                {['Reference', 'Customer', 'Route', 'Type', 'Rate', 'Status', 'Created'].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--ink-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--ink-border)' }}>
                  <td style={{ padding: '0.5rem 0.75rem', color: '#06B6D4', fontFamily: 'var(--ink-font-mono, monospace)', fontWeight: 600 }}>{c.reference}</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: 'var(--ink-text)' }}>{c.customer_name}</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: 'var(--ink-dim)', fontSize: '0.72rem' }}>
                    {c.origin && c.destination ? `${c.origin} → ${c.destination}` : '-'}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', color: 'var(--ink-muted)', textTransform: 'capitalize' }}>{c.service_type ?? '-'}</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: 'var(--ink-text)', fontFamily: 'var(--ink-font-mono, monospace)' }}>
                    {c.rate ? `$${c.rate.toLocaleString()} ${c.currency ?? 'CAD'}` : '-'}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}><StatusBadge status={c.status} /></td>
                  <td style={{ padding: '0.5rem 0.75rem', color: 'var(--ink-dim)' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
