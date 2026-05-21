import { useState, useEffect } from 'react'
import { formatters } from '../../../src/lib/formatters'

interface Cohort {
  name: string
  count: number
  percentage: number
  description: string
}

interface SourceAttribution {
  source: string
  visitors: number
}

interface CohortData {
  cohorts: Cohort[]
  topSources: SourceAttribution[]
  days: number
  totalVisitors: number
}

interface CohortTableProps {
  days?: number
}

const cohortColors: Record<string, { bg: string; text: string }> = {
  power_users: { bg: 'rgba(16,185,129,0.15)', text: '#10B981' },
  returning:   { bg: 'rgba(6,182,212,0.15)',  text: '#06B6D4' },
  new:         { bg: 'rgba(212,160,23,0.15)', text: '#D4A017' },
  at_risk:     { bg: 'rgba(239,68,68,0.15)',  text: '#EF4444' },
}

export function CohortTable({ days = 30 }: CohortTableProps) {
  const [data, setData] = useState<CohortData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const apiUrl = localStorage.getItem('inkwell_api_url') ?? ''
    const token = localStorage.getItem('inkwell_auth_token') ?? ''
    fetch(`${apiUrl}/api/analytics/cohorts?days=${days}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json: CohortData) => {
        setData(json)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [days])

  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      {/* Cohorts */}
      <div style={{
        flex: '2 1 400px',
        background: 'var(--ink-surface)',
        border: '1px solid var(--ink-border)',
        borderRadius: 'var(--ink-radius, 6px)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid var(--ink-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ color: 'var(--ink-text)', fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Behavioral Cohorts</h3>
          <span style={{ color: 'var(--ink-muted)', fontSize: '0.78rem' }}>Last {days} days</span>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.85rem' }}>Loading...</div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.85rem' }}>Failed to load data</div>
        ) : !data || data.cohorts.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.85rem' }}>No cohort data yet</div>
        ) : (
          <div>
            {/* Total visitors header */}
            <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid var(--ink-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--ink-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Visitors</span>
              <span style={{ color: 'var(--ink-text)', fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--ink-font-mono, monospace)' }}>
                {/* ⚡ Bolt: Use cached formatter for performance */}
                {formatters.compactCAD0.format(data.totalVisitors)}
              </span>
            </div>

            {data.cohorts.map((cohort, i) => {
              const colors = cohortColors[cohort.name] ?? { bg: 'rgba(255,255,255,0.08)', text: 'var(--ink-muted)' }
              return (
                <div
                  key={cohort.name}
                  style={{
                    padding: '0.85rem 1.5rem',
                    borderBottom: i < data.cohorts.length - 1 ? '1px solid var(--ink-border)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                  }}
                >
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background: colors.bg,
                    color: colors.text,
                    minWidth: '90px',
                    textAlign: 'center',
                  }}>
                    {cohort.name.replace(/_/g, ' ')}
                  </span>

                  <div style={{ flex: 1 }}>
                    <div style={{
                      height: '6px',
                      background: 'var(--ink-border)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(cohort.percentage, 100)}%`,
                        background: colors.text,
                        borderRadius: '3px',
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>

                  <span style={{ color: 'var(--ink-text)', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--ink-font-mono, monospace)', minWidth: '50px', textAlign: 'right' }}>
                    {cohort.count}
                  </span>
                  <span style={{ color: 'var(--ink-muted)', fontSize: '0.78rem', minWidth: '45px', textAlign: 'right' }}>
                    {cohort.percentage.toFixed(1)}%
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Top Sources */}
      <div style={{
        flex: '1 1 240px',
        background: 'var(--ink-surface)',
        border: '1px solid var(--ink-border)',
        borderRadius: 'var(--ink-radius, 6px)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid var(--ink-border)' }}>
          <h3 style={{ color: 'var(--ink-text)', fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Top Sources</h3>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.85rem' }}>Loading...</div>
        ) : !data || data.topSources.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.85rem' }}>No UTM data yet</div>
        ) : (
          <div>
            {data.topSources.map((src, i) => (
              <div
                key={src.source}
                style={{
                  padding: '0.7rem 1.5rem',
                  borderBottom: i < data.topSources.length - 1 ? '1px solid var(--ink-border)' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: 'var(--ink-text)', fontSize: '0.85rem' }}>{src.source}</span>
                <span style={{ color: 'var(--ink-muted)', fontSize: '0.82rem', fontFamily: 'var(--ink-font-mono, monospace)' }}>{src.visitors}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
