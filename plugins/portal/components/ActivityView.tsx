import { useState, useEffect } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  slug: string
}

interface ActivityEvent {
  id: string
  text: string
  source: string
  timestamp: string
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
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ActivityView({ slug }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/portal/activity')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setEvents((data as { events?: ActivityEvent[] }).events ?? [])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug])

  if (loading) {
    return (
      <div style={{ padding: '24px 16px', color: 'var(--ink-muted)', fontSize: '14px' }}>
        Loading activity…
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
        Agent Activity
      </h2>

      {events.length === 0 ? (
        <div
          style={{
            background: 'var(--ink-surface)',
            border: '1px solid var(--ink-border)',
            borderRadius: '12px',
            padding: '32px 20px',
            textAlign: 'center',
          }}
        >
          <p style={{ color: 'var(--ink-muted)', fontSize: '15px', margin: '0' }}>
            No activity recorded yet — check back soon.
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '24px' }}>
          {/* Vertical timeline line */}
          <div
            style={{
              position: 'absolute',
              left: '7px',
              top: '8px',
              bottom: '8px',
              width: '2px',
              background: 'var(--ink-border)',
              borderRadius: '1px',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {events.map((event, index) => (
              <div
                key={event.id}
                style={{
                  position: 'relative',
                  paddingBottom: index < events.length - 1 ? '20px' : '0',
                }}
              >
                {/* Timeline dot */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-20px',
                    top: '6px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: 'var(--ink-primary)',
                    border: '2px solid var(--ink-bg)',
                    flexShrink: 0,
                  }}
                />

                {/* Event card */}
                <div
                  style={{
                    background: 'var(--ink-surface)',
                    border: '1px solid var(--ink-border)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '14px',
                        color: 'var(--ink-text)',
                        lineHeight: '1.4',
                        flex: 1,
                      }}
                    >
                      {event.text}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: '600',
                        color: 'var(--ink-muted)',
                        border: '1px solid var(--ink-border)',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.07em',
                        flexShrink: 0,
                        whiteSpace: 'nowrap' as const,
                      }}
                    >
                      {event.source}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--ink-muted)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {relativeTime(event.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
