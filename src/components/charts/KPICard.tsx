import { useState, useEffect } from 'react'

interface KPICardProps {
  title: string
  endpoint: string
  field: string
  format?: 'number' | 'currency' | 'percent'
  icon?: string
  trend?: boolean
}

// Cache formatters to avoid recreation overhead on each render
const currencyFormatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
const compactFormatter = new Intl.NumberFormat('en-CA', { notation: 'compact', maximumFractionDigits: 1 })

function formatValue(value: number, format: KPICardProps['format']): string {
  if (value === null || value === undefined) return '—'
  switch (format) {
    case 'currency':
      return currencyFormatter.format(value)
    case 'percent':
      return `${value.toFixed(1)}%`
    default:
      return compactFormatter.format(value)
  }
}

export function KPICard({ title, endpoint, field, format = 'number', icon, trend = true }: KPICardProps) {
  const [value, setValue] = useState<number | null>(null)
  const [change, setChange] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const apiBase = (window as unknown as Record<string, string>).__INKWELL_API__ ?? ''
    fetch(`${apiBase}${endpoint}`)
      .then((r) => r.json())
      .then((data: Record<string, unknown>) => {
        setValue(data[field] as number ?? null)
        if (trend && data[`${field}_change`] !== undefined) {
          setChange(data[`${field}_change`] as number)
        }
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [endpoint, field, trend])

  const isPositive = change !== null && change >= 0

  return (
    <div style={{
      background: 'var(--ink-surface)',
      border: '1px solid var(--ink-border)',
      borderRadius: 'var(--ink-radius, 6px)',
      padding: '1.25rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--ink-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          {title}
        </span>
        {icon && <span style={{ fontSize: '1.1rem', opacity: 0.6 }}>{icon}</span>}
      </div>

      {loading ? (
        <div style={{ height: '2rem', background: 'var(--ink-border)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
      ) : error ? (
        <span style={{ color: 'var(--ink-muted)', fontSize: '1.5rem', fontWeight: 700 }}>—</span>
      ) : (
        <span style={{ color: 'var(--ink-text)', fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--ink-font-mono, monospace)', lineHeight: 1 }}>
          {formatValue(value!, format)}
        </span>
      )}

      {trend && change !== null && !loading && !error && (
        <span style={{ fontSize: '0.78rem', color: isPositive ? 'var(--ink-accent, #10B981)' : 'var(--ink-danger, #EF4444)', fontWeight: 500 }}>
          {isPositive ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% vs last period
        </span>
      )}
    </div>
  )
}
