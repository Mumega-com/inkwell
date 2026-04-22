import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface FunnelStep {
  step: string
  total: number
  uniqueVisitors: number
  conversionRate: number
  dropoff: number
}

interface FunnelChartProps {
  steps?: string
  days?: number
  height?: number
}

export function FunnelChart({ steps = 'Page Viewed,Form Started,Form Submitted', days = 30, height = 320 }: FunnelChartProps) {
  const [data, setData] = useState<FunnelStep[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const apiUrl = localStorage.getItem('mumega_api_url') ?? ''
    const token = localStorage.getItem('mumega_auth_token') ?? ''
    fetch(`${apiUrl}/api/analytics/funnel?steps=${encodeURIComponent(steps)}&days=${days}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json: { steps: FunnelStep[] }) => {
        setData(json.steps ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [steps, days])

  const maxVisitors = data.length > 0 ? Math.max(...data.map((d) => d.uniqueVisitors)) : 1

  return (
    <div style={{
      background: 'var(--ink-surface)',
      border: '1px solid var(--ink-border)',
      borderRadius: 'var(--ink-radius, 6px)',
      padding: '1.25rem 1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--ink-text)', fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Conversion Funnel</h3>
        <span style={{ color: 'var(--ink-muted)', fontSize: '0.78rem' }}>Last {days} days</span>
      </div>

      {loading ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>Loading...</span>
        </div>
      ) : error ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>Failed to load data</span>
        </div>
      ) : data.length === 0 ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>No funnel data yet</span>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-border)" strokeOpacity={0.5} horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--ink-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                dataKey="step"
                type="category"
                tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={130}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--ink-surface)',
                  border: '1px solid var(--ink-border)',
                  borderRadius: '4px',
                  color: 'var(--ink-text)',
                  fontSize: '0.82rem',
                }}
                formatter={(value: number, _name: string, props: { payload: FunnelStep }) => [
                  `${value} visitors (${(props.payload.conversionRate * 100).toFixed(1)}%)`,
                  'Unique Visitors',
                ]}
              />
              <Bar dataKey="uniqueVisitors" radius={[0, 3, 3, 0]}>
                {data.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={`rgba(6,182,212,${0.3 + 0.7 * (entry.uniqueVisitors / maxVisitors)})`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            {data.map((step, i) => (
              <div key={i} style={{
                flex: '1 1 120px',
                padding: '0.6rem 0.8rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '4px',
                textAlign: 'center',
              }}>
                <div style={{ color: 'var(--ink-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>
                  {step.step}
                </div>
                <div style={{ color: 'var(--ink-text)', fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--ink-font-mono, monospace)' }}>
                  {(step.conversionRate * 100).toFixed(1)}%
                </div>
                {i > 0 && step.dropoff > 0 && (
                  <div style={{ color: 'var(--ink-danger, #EF4444)', fontSize: '0.72rem', marginTop: '0.15rem' }}>
                    -{step.dropoff} dropped
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
