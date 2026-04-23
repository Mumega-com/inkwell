import { useState, useEffect } from 'react'
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface BarChartProps {
  title: string
  endpoint: string
  dataKey: string
  xKey?: string
  color?: string
  height?: number
  horizontal?: boolean
}

export function BarChart({ title, endpoint, dataKey, xKey = 'label', color, height = 280, horizontal = false }: BarChartProps) {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const barColor = color ?? 'var(--ink-primary)'

  useEffect(() => {
    const apiBase = (window as unknown as Record<string, string>).__INKWELL_API__ ?? ''
    fetch(`${apiBase}${endpoint}`)
      .then((r) => r.json())
      .then((json: unknown) => {
        const rows = Array.isArray(json) ? json : (json as Record<string, unknown>).data as Record<string, unknown>[]
        setData(rows ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [endpoint])

  return (
    <div style={{
      background: 'var(--ink-surface)',
      border: '1px solid var(--ink-border)',
      borderRadius: 'var(--ink-radius, 6px)',
      padding: '1.25rem 1.5rem',
    }}>
      <h3 style={{ color: 'var(--ink-text)', fontSize: '0.95rem', fontWeight: 600, margin: '0 0 1rem' }}>{title}</h3>

      {loading ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>Loading…</span>
        </div>
      ) : error ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>Failed to load data</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <ReBarChart
            data={data}
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 4, right: 8, left: 0, bottom: horizontal ? 0 : 16 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-border)" strokeOpacity={0.5} />
            {horizontal ? (
              <>
                <XAxis type="number" tick={{ fill: 'var(--ink-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey={xKey} type="category" tick={{ fill: 'var(--ink-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
              </>
            ) : (
              <>
                <XAxis
                  dataKey={xKey}
                  tick={{ fill: 'var(--ink-muted)', fontSize: 10 }}
                  axisLine={{ stroke: 'var(--ink-border)' }}
                  tickLine={false}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
              </>
            )}
            <Tooltip
              contentStyle={{
                background: 'var(--ink-surface)',
                border: '1px solid var(--ink-border)',
                borderRadius: '4px',
                color: 'var(--ink-text)',
                fontSize: '0.82rem',
              }}
            />
            <Bar dataKey={dataKey} fill={barColor} radius={[3, 3, 0, 0]} />
          </ReBarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
