import { useState, useEffect, useCallback } from 'react'

interface QAEntry {
  id: string
  question_index: number
  question_text: string
  answer: string | null
  answered_at: string | null
  sent_at: string
  channel: string
}

interface TodayQuestion {
  question_index: number
  question_text: string
  already_sent: boolean
  answered: boolean
  answer: string | null
}

function getApiConfig() {
  return {
    url: localStorage.getItem('inkwell_api_url') ?? '',
    token: localStorage.getItem('inkwell_auth_token') ?? '',
  }
}

function KPI({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      padding: '1rem 1.25rem', background: 'var(--ink-surface)', border: '1px solid var(--ink-border)',
      borderRadius: '6px', flex: '1 1 140px', minWidth: '120px',
    }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: color ?? 'var(--ink-text)' }}>{value}</div>
    </div>
  )
}

export function QuestionnairePanel() {
  const [history, setHistory] = useState<QAEntry[]>([])
  const [meta, setMeta] = useState<{ total: number; answered: number; pending: number }>({ total: 0, answered: 0, pending: 0 })
  const [today, setToday] = useState<TodayQuestion | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { url, token } = getApiConfig()
    if (!url) return
    setLoading(true)
    try {
      const [histRes, todayRes] = await Promise.all([
        fetch(`${url}/api/questionnaire/history?limit=20`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${url}/api/questionnaire/today`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (histRes.ok) {
        const data = await histRes.json() as { history: QAEntry[]; meta: typeof meta }
        setHistory(data.history ?? [])
        setMeta(data.meta ?? { total: 0, answered: 0, pending: 0 })
      }
      if (todayRes.ok) {
        const data = await todayRes.json() as TodayQuestion
        setToday(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--ink-muted)' }}>Loading...</div>
  }

  const responseRate = meta.total > 0 ? Math.round((meta.answered / meta.total) * 100) : 0

  return (
    <div>
      {/* Today's Question */}
      {today && (
        <div style={{
          padding: '1rem 1.25rem', background: 'rgba(6,182,212,0.08)', border: '1px solid var(--ink-border)',
          borderRadius: '6px', marginBottom: '1.25rem',
        }}>
          <div style={{ fontSize: '0.72rem', color: '#06B6D4', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.3rem' }}>
            Today's Question
          </div>
          <div style={{ fontSize: '0.92rem', color: 'var(--ink-text)', fontWeight: 500, marginBottom: '0.3rem' }}>
            {today.question_text}
          </div>
          {today.answered ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
              Answer: {today.answer}
            </div>
          ) : (
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-dim)' }}>
              {today.already_sent ? 'Sent, awaiting answer' : 'Not sent yet'}
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <KPI label="Total Questions" value={meta.total} />
        <KPI label="Answered" value={meta.answered} color="#10B981" />
        <KPI label="Pending" value={meta.pending} color={meta.pending > 0 ? '#D4A017' : 'var(--ink-text)'} />
        <KPI label="Response Rate" value={`${responseRate}%`} color={responseRate >= 80 ? '#10B981' : responseRate >= 50 ? '#D4A017' : '#EF4444'} />
      </div>

      {/* History */}
      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink-text)', marginBottom: '0.5rem' }}>Recent History</div>
      <div style={{ background: 'var(--ink-surface)', border: '1px solid var(--ink-border)', borderRadius: '6px', overflow: 'hidden' }}>
        {history.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--ink-dim)', fontSize: '0.78rem' }}>No questionnaire data yet</div>
        ) : (
          history.map((entry, i) => (
            <div key={entry.id} style={{
              padding: '0.6rem 0.8rem', borderBottom: i < history.length - 1 ? '1px solid var(--ink-border)' : 'none',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '0.5rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--ink-text)', fontWeight: 500 }}>{entry.question_text}</div>
                  {entry.answer ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: '0.2rem', fontStyle: 'italic' }}>
                      {entry.answer}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.72rem', color: '#D4A017', marginTop: '0.2rem' }}>Unanswered</div>
                  )}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--ink-dim)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <div>{new Date(entry.sent_at).toLocaleDateString()}</div>
                  <div style={{ textTransform: 'uppercase' }}>{entry.channel}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
