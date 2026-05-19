import { useState, useEffect, useCallback } from 'react'

interface SquadHealth {
  squad_id: string
  name: string
  conductance: number
  force: number
  coherence: number
  severity: 'INFO' | 'WARNING' | 'ACTION_REQUIRED'
  narrative: string
  tasks_completed: number
  tasks_failed: number
  success_rate: number
  idle_days: number
  snapshot_date: string
}

interface Alert {
  id: string
  squad_id: string
  severity: string
  narrative: string
  acknowledged: number
  created_at: string
}

function getApiConfig() {
  return {
    url: localStorage.getItem('inkwell_api_url') ?? '',
    token: localStorage.getItem('inkwell_auth_token') ?? '',
  }
}

const severityColors: Record<string, { bg: string; text: string }> = {
  INFO:            { bg: 'rgba(16,185,129,0.12)', text: '#10B981' },
  WARNING:         { bg: 'rgba(212,160,23,0.15)', text: '#D4A017' },
  ACTION_REQUIRED: { bg: 'rgba(239,68,68,0.12)',  text: '#EF4444' },
}

function MetricBar({ label, value, max }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / (max ?? 1)) * 100)
  const color = pct >= 70 ? '#10B981' : pct >= 40 ? '#D4A017' : '#EF4444'
  return (
    <div style={{ marginBottom: '0.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '2px' }}>
        <span style={{ color: 'var(--ink-muted)' }}>{label}</span>
        <span style={{ color: 'var(--ink-text)', fontFamily: 'var(--ink-font-mono, monospace)' }}>{value.toFixed(2)}</span>
      </div>
      <div style={{ height: '4px', background: 'var(--ink-border)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

export function HealthPanel() {
  const [squads, setSquads] = useState<SquadHealth[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { url, token } = getApiConfig()
    if (!url) return
    setLoading(true)
    try {
      const [healthRes, alertRes] = await Promise.all([
        fetch(`${url}/api/diagnostics/health`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${url}/api/diagnostics/alerts`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (healthRes.ok) {
        const data = await healthRes.json() as { squads: SquadHealth[] }
        setSquads(data.squads ?? [])
      }
      if (alertRes.ok) {
        const data = await alertRes.json() as { alerts: Alert[] }
        setAlerts(data.alerts ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const acknowledgeAlert = async (alertId: string) => {
    const { url, token } = getApiConfig()
    await fetch(`${url}/api/diagnostics/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    load()
  }

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--ink-muted)' }}>Loading...</div>
  }

  const actionRequired = squads.filter(s => s.severity === 'ACTION_REQUIRED').length
  const warnings = squads.filter(s => s.severity === 'WARNING').length
  const healthy = squads.filter(s => s.severity === 'INFO').length

  return (
    <div>
      {/* Summary KPIs */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div style={{ padding: '1rem 1.25rem', background: 'var(--ink-surface)', border: '1px solid var(--ink-border)', borderRadius: '6px', flex: '1 1 140px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Squads</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink-text)' }}>{squads.length}</div>
        </div>
        <div style={{ padding: '1rem 1.25rem', background: 'rgba(16,185,129,0.08)', border: '1px solid var(--ink-border)', borderRadius: '6px', flex: '1 1 140px' }}>
          <div style={{ fontSize: '0.72rem', color: '#10B981', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Healthy</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10B981' }}>{healthy}</div>
        </div>
        <div style={{ padding: '1rem 1.25rem', background: 'rgba(212,160,23,0.08)', border: '1px solid var(--ink-border)', borderRadius: '6px', flex: '1 1 140px' }}>
          <div style={{ fontSize: '0.72rem', color: '#D4A017', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Warning</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#D4A017' }}>{warnings}</div>
        </div>
        <div style={{ padding: '1rem 1.25rem', background: 'rgba(239,68,68,0.08)', border: '1px solid var(--ink-border)', borderRadius: '6px', flex: '1 1 140px' }}>
          <div style={{ fontSize: '0.72rem', color: '#EF4444', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Critical</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#EF4444' }}>{actionRequired}</div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink-text)', marginBottom: '0.5rem' }}>Active Alerts</div>
          {alerts.map(a => {
            const colors = severityColors[a.severity] ?? severityColors.INFO
            return (
              <div key={a.id} style={{
                padding: '0.6rem 0.8rem', background: colors.bg, border: '1px solid var(--ink-border)',
                borderRadius: '6px', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '0.5rem',
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: colors.text, textTransform: 'uppercase', marginBottom: '0.2rem' }}>{a.severity} - {a.squad_id}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--ink-text)' }}>{a.narrative}</div>
                </div>
                <button
                  onClick={() => acknowledgeAlert(a.id)}
                  style={{
                    padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--ink-border)',
                    background: 'transparent', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: '0.68rem', whiteSpace: 'nowrap',
                  }}
                >
                  Dismiss
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Squad Cards */}
      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink-text)', marginBottom: '0.5rem' }}>Squad Health</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
        {squads.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--ink-dim)', fontSize: '0.78rem' }}>No squad data</div>
        ) : squads.map(s => {
          const colors = severityColors[s.severity] ?? severityColors.INFO
          return (
            <div key={s.squad_id} style={{
              padding: '0.8rem 1rem', background: 'var(--ink-surface)', border: '1px solid var(--ink-border)',
              borderRadius: '6px', borderLeft: `3px solid ${colors.text}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--ink-text)', fontSize: '0.85rem' }}>{s.name}</span>
                <span style={{
                  padding: '1px 6px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 600,
                  background: colors.bg, color: colors.text, textTransform: 'uppercase',
                }}>{s.severity.replace('_', ' ')}</span>
              </div>
              <MetricBar label="Conductance" value={s.conductance} />
              <MetricBar label="Force" value={s.force} />
              <MetricBar label="Coherence" value={s.coherence} />
              <div style={{ fontSize: '0.72rem', color: 'var(--ink-dim)', marginTop: '0.3rem' }}>
                {s.tasks_completed} done / {s.tasks_failed} failed / {s.idle_days}d idle
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: '0.2rem', fontStyle: 'italic' }}>{s.narrative}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
