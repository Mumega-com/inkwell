import { useState, useEffect } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  slug: string
}

interface HistoryEntry {
  id: string
  question: string
  answer: string
  date: string
}

interface Insight {
  id: string
  title: string
  body: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    credentials: 'include',
  })
}

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HistoryView({ slug }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set())

  const LIMIT = 20

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch(`/api/portal/history?limit=${LIMIT}&offset=0`).then((r) => r.json()),
      apiFetch('/api/portal/insights').then((r) => r.json()),
    ])
      .then(([histData, insightData]) => {
        if (cancelled) return
        const hist = histData as { entries?: HistoryEntry[]; total?: number }
        const fetched = hist.entries ?? []
        setEntries(fetched)
        setOffset(fetched.length)
        setHasMore(fetched.length === LIMIT)
        setInsights(
          ((insightData as { insights?: Insight[] }).insights ?? []).slice(0, 3)
        )
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug])

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const res = await apiFetch(`/api/portal/history?limit=${LIMIT}&offset=${offset}`)
      const data = (await res.json()) as { entries?: HistoryEntry[] }
      const more = data.entries ?? []
      setEntries((prev) => [...prev, ...more])
      setOffset((prev) => prev + more.length)
      setHasMore(more.length === LIMIT)
    } catch {
      // Non-fatal
    } finally {
      setLoadingMore(false)
    }
  }

  function toggleInsight(id: string) {
    setExpandedInsights((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div style={{ padding: '24px 16px', color: 'var(--ink-muted)', fontSize: '14px' }}>
        Loading history…
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 16px 16px' }}>
      <h2
        style={{
          fontSize: '16px',
          fontWeight: '600',
          color: 'var(--ink-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          margin: '0 0 20px',
        }}
      >
        Check-in History
      </h2>

      {/* History entries */}
      {entries.length === 0 ? (
        <p style={{ color: 'var(--ink-muted)', fontSize: '14px' }}>No check-ins recorded yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                background: 'var(--ink-surface)',
                border: '1px solid var(--ink-border)',
                borderRadius: '10px',
                padding: '16px',
              }}
            >
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--ink-muted)',
                  fontStyle: 'italic',
                  margin: '0 0 8px',
                  lineHeight: '1.4',
                }}
              >
                {entry.question}
              </p>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--ink-text)',
                  margin: '0 0 10px',
                  lineHeight: '1.5',
                }}
              >
                {entry.answer}
              </p>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '11px',
                  color: 'var(--ink-muted)',
                  background: 'var(--ink-bg)',
                  border: '1px solid var(--ink-border)',
                  borderRadius: '4px',
                  padding: '2px 7px',
                  fontFamily: 'monospace',
                }}
              >
                {relativeTime(entry.date)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid var(--ink-border)',
            borderRadius: '8px',
            padding: '11px',
            fontSize: '14px',
            color: 'var(--ink-muted)',
            cursor: loadingMore ? 'not-allowed' : 'pointer',
            marginBottom: '28px',
          }}
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}

      {/* Insights section */}
      {insights.length > 0 && (
        <div>
          <h3
            style={{
              fontSize: '11px',
              fontWeight: '700',
              color: 'var(--ink-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              margin: '0 0 12px',
            }}
          >
            AI Summary · What your team knows
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {insights.map((insight) => {
              const expanded = expandedInsights.has(insight.id)
              return (
                <div
                  key={insight.id}
                  style={{
                    background: 'var(--ink-surface)',
                    border: '1px solid var(--ink-border)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={() => toggleInsight(insight.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 16px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--ink-text)' }}>
                      {insight.title}
                    </span>
                    <span style={{ fontSize: '16px', color: 'var(--ink-muted)', marginLeft: '8px' }}>
                      {expanded ? '▲' : '▼'}
                    </span>
                  </button>
                  {expanded && (
                    <div
                      style={{
                        padding: '0 16px 16px',
                        fontSize: '14px',
                        color: 'var(--ink-text)',
                        lineHeight: '1.5',
                        borderTop: '1px solid var(--ink-border)',
                        paddingTop: '12px',
                      }}
                    >
                      {insight.body}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
