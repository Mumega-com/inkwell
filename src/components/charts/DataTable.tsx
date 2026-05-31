import { useState, useEffect } from 'react'

interface Column {
  key: string
  label: string
  format?: 'number' | 'currency' | 'percent' | 'url' | 'status'
  align?: 'left' | 'right' | 'center'
  width?: string
}

interface DataTableProps {
  title: string
  endpoint: string
  columns: Column[]
  limit?: number
  emptyMessage?: string
}

const compactFormatter = new Intl.NumberFormat('en-CA', { notation: 'compact', maximumFractionDigits: 1 })
const currencyFormatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })

function formatCell(value: unknown, format: Column['format']): string {
  if (value === null || value === undefined) return '—'
  switch (format) {
    case 'number':
      return compactFormatter.format(value as number)
    case 'currency':
      return currencyFormatter.format(value as number)
    case 'percent':
      return `${(value as number).toFixed(1)}%`
    default:
      return String(value)
  }
}

function StatusBadge({ value }: { value: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    active:    { bg: 'rgba(16,185,129,0.15)', text: '#10B981' },
    new:       { bg: 'rgba(6,182,212,0.15)',  text: '#06B6D4' },
    contacted: { bg: 'rgba(212,160,23,0.15)', text: '#D4A017' },
    closed:    { bg: 'rgba(239,68,68,0.15)',  text: '#EF4444' },
    paused:    { bg: 'rgba(255,255,255,0.08)', text: 'var(--ink-muted)' },
  }
  const style = colors[value?.toLowerCase()] ?? colors.paused
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '0.72rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      background: style.bg,
      color: style.text,
    }}>
      {value}
    </span>
  )
}

export function DataTable({ title, endpoint, columns, limit, emptyMessage = 'No data' }: DataTableProps) {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const apiBase = (window as unknown as Record<string, string>).__INKWELL_API__ ?? ''
    fetch(`${apiBase}${endpoint}`)
      .then((r) => r.json())
      .then((json: unknown) => {
        const rows = Array.isArray(json) ? json : (json as Record<string, unknown>).data as Record<string, unknown>[]
        setData(limit ? (rows ?? []).slice(0, limit) : (rows ?? []))
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [endpoint, limit])

  return (
    <div style={{
      background: 'var(--ink-surface)',
      border: '1px solid var(--ink-border)',
      borderRadius: 'var(--ink-radius, 6px)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid var(--ink-border)' }}>
        <h3 style={{ color: 'var(--ink-text)', fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>{title}</h3>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.85rem' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.85rem' }}>Failed to load data</div>
      ) : data.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.85rem' }}>{emptyMessage}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--ink-border)' }}>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={{
                      padding: '0.65rem 1.5rem',
                      textAlign: col.align ?? 'left',
                      color: 'var(--ink-muted)',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                      width: col.width,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: i < data.length - 1 ? '1px solid var(--ink-border)' : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: '0.75rem 1.5rem',
                        textAlign: col.align ?? 'left',
                        color: 'var(--ink-text)',
                        maxWidth: col.format === 'url' ? '240px' : undefined,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: col.format === 'url' ? 'nowrap' : undefined,
                      }}
                    >
                      {col.format === 'status' ? (
                        <StatusBadge value={String(row[col.key] ?? '')} />
                      ) : col.format === 'url' ? (
                        <a
                          href={String(row[col.key])}
                          style={{ color: 'var(--ink-secondary)', textDecoration: 'none', fontFamily: 'monospace', fontSize: '0.8rem' }}
                          title={String(row[col.key])}
                        >
                          {String(row[col.key] ?? '—')}
                        </a>
                      ) : (
                        formatCell(row[col.key], col.format)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
