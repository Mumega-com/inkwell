import { useState, useEffect } from 'react'
import {
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface LineChartProps {
  title: string
  endpoint: string
  dataKey: string | string[]
  xKey?: string
  colors?: string[]
  height?: number
}

export function LineChart({ title, endpoint, dataKey, xKey = 'date', colors, height = 280 }: LineChartProps) {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const keys = Array.isArray(dataKey) ? dataKey : [dataKey]
  const defaultColors = ['var(--ink-primary)', 'var(--ink-secondary)', '#10B981', '#8B5CF6']
  const lineColors = colors ?? defaultColors

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
          <ReLineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-border)" />
            <XAxis
              dataKey={xKey}
              tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--ink-border)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--ink-surface)',
                border: '1px solid var(--ink-border)',
                borderRadius: '4px',
                color: 'var(--ink-text)',
                fontSize: '0.82rem',
              }}
            />
            {keys.length > 1 && <Legend wrapperStyle={{ color: 'var(--ink-muted)', fontSize: '0.8rem' }} />}
            {keys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={lineColors[i % lineColors.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: lineColors[i % lineColors.length] }}
              />
            ))}
          </ReLineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
