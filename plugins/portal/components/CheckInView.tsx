import { useState, useEffect } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  slug: string
}

interface CheckInData {
  question: string
  answer?: string
  answered: boolean
  date?: string
}

interface HistoryEntry {
  id: string
  question: string
  answer: string
  date: string
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
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CheckInView({ slug }: Props) {
  const [checkin, setCheckin] = useState<CheckInData | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch('/api/portal/checkin').then((r) => r.json()),
      apiFetch('/api/portal/history?limit=3').then((r) => r.json()),
    ])
      .then(([checkinData, historyData]) => {
        if (cancelled) return
        const ci = checkinData as CheckInData
        setCheckin(ci)
        setAnswer(ci.answer ?? '')
        setHistory((historyData as { entries?: HistoryEntry[] }).entries ?? [])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug])

  async function handleSubmit() {
    if (answer.trim().length < 3) return
    setSubmitting(true)
    setError('')
    try {
      const res = await apiFetch('/api/portal/checkin', {
        method: 'POST',
        body: JSON.stringify({ answer: answer.trim() }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'Failed to save. Please try again.')
        return
      }
      const updated = (await res.json()) as CheckInData
      setCheckin(updated)
      setAnswer(updated.answer ?? answer.trim())
      setEditing(false)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '24px 16px', color: 'var(--ink-muted)', fontSize: '14px' }}>
        Loading check-in…
      </div>
    )
  }

  if (!checkin) {
    return (
      <div style={{ padding: '24px 16px', color: 'var(--ink-muted)', fontSize: '14px' }}>
        No check-in available today.
      </div>
    )
  }

  const showForm = !checkin.answered || editing

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
        Daily Check-in
      </h2>

      {/* Main card */}
      <div
        style={{
          background: 'var(--ink-surface)',
          border: '1px solid var(--ink-border)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
        }}
      >
        {/* Question */}
        <p
          style={{
            fontSize: '18px',
            fontWeight: '600',
            color: 'var(--ink-primary)',
            lineHeight: '1.4',
            margin: '0 0 16px',
          }}
        >
          {checkin.question}
        </p>

        {error && (
          <div
            style={{
              background: 'rgba(220,38,38,0.12)',
              border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '13px',
              color: '#f87171',
              marginBottom: '14px',
            }}
          >
            {error}
          </div>
        )}

        {showForm ? (
          <>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here…"
              style={{
                width: '100%',
                minHeight: '80px',
                background: 'var(--ink-bg)',
                border: '1px solid var(--ink-border)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '15px',
                color: 'var(--ink-text)',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: '12px',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleSubmit}
                disabled={submitting || answer.trim().length < 3}
                style={{
                  flex: 1,
                  background: 'var(--ink-primary)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '11px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: submitting || answer.trim().length < 3 ? 'not-allowed' : 'pointer',
                  opacity: submitting || answer.trim().length < 3 ? 0.5 : 1,
                }}
              >
                {submitting ? 'Saving…' : 'Submit'}
              </button>
              {editing && (
                <button
                  onClick={() => { setEditing(false); setAnswer(checkin.answer ?? '') }}
                  style={{
                    padding: '11px 16px',
                    background: 'transparent',
                    border: '1px solid var(--ink-border)',
                    borderRadius: '8px',
                    color: 'var(--ink-muted)',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p
              style={{
                fontSize: '15px',
                color: 'var(--ink-text)',
                lineHeight: '1.5',
                margin: '0 0 16px',
                padding: '12px',
                background: 'var(--ink-bg)',
                borderRadius: '8px',
                border: '1px solid var(--ink-border)',
              }}
            >
              {checkin.answer}
            </p>
            <button
              onClick={() => setEditing(true)}
              style={{
                background: 'transparent',
                border: '1px solid var(--ink-border)',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
                color: 'var(--ink-muted)',
                cursor: 'pointer',
              }}
            >
              Edit answer
            </button>
          </>
        )}
      </div>

      {/* Recent check-ins */}
      {history.length > 0 && (
        <div>
          <h3
            style={{
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--ink-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              margin: '0 0 12px',
            }}
          >
            Recent check-ins
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.map((entry) => (
              <div
                key={entry.id}
                style={{
                  background: 'var(--ink-surface)',
                  border: '1px solid var(--ink-border)',
                  borderRadius: '10px',
                  padding: '14px',
                }}
              >
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--ink-muted)',
                    margin: '0 0 6px',
                    fontStyle: 'italic',
                  }}
                >
                  {entry.question.length > 80 ? entry.question.slice(0, 79) + '…' : entry.question}
                </p>
                <p
                  style={{
                    fontSize: '14px',
                    color: 'var(--ink-text)',
                    margin: '0 0 8px',
                    lineHeight: '1.4',
                  }}
                >
                  {entry.answer}
                </p>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--ink-muted)',
                    fontFamily: 'monospace',
                  }}
                >
                  {relativeTime(entry.date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
