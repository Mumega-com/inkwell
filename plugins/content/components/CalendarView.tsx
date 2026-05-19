import { useState, useEffect, useCallback } from 'react'

interface CalendarEntry {
  slug: string
  title: string
  status: string
  scheduled_at: string | null
  published_at: string
  channel: string
  campaign_id: string | null
  priority: string
  seo_keyword: string | null
  assignee: string | null
  author: string
  type: string
}

type ViewMode = 'calendar' | 'pipeline'

const statusColors: Record<string, { bg: string; text: string }> = {
  idea:      { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.5)' },
  draft:     { bg: 'rgba(212,160,23,0.15)',  text: '#D4A017' },
  review:    { bg: 'rgba(251,146,60,0.15)',  text: '#FB923C' },
  scheduled: { bg: 'rgba(6,182,212,0.15)',   text: '#06B6D4' },
  published: { bg: 'rgba(16,185,129,0.15)',  text: '#10B981' },
  archived:  { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.35)' },
  killed:    { bg: 'rgba(239,68,68,0.1)',    text: '#EF4444' },
}

const priorityIcons: Record<string, string> = { high: '!', medium: '-', low: '.' }

function getApiConfig() {
  return {
    url: localStorage.getItem('inkwell_api_url') ?? '',
    token: localStorage.getItem('inkwell_auth_token') ?? '',
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] ?? statusColors.idea
  return (
    <span style={{
      display: 'inline-block', padding: '1px 8px', borderRadius: '10px',
      fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.04em', background: colors.bg, color: colors.text,
    }}>
      {status}
    </span>
  )
}

function EntryCard({ entry, onStatusChange }: { entry: CalendarEntry; onStatusChange: () => void }) {
  const [changing, setChanging] = useState(false)

  const changeStatus = async (newStatus: string) => {
    setChanging(true)
    const { url, token } = getApiConfig()
    try {
      await fetch(`${url}/api/content/${entry.slug}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      onStatusChange()
    } finally {
      setChanging(false)
    }
  }

  const nextStatus: Record<string, string> = {
    idea: 'draft', draft: 'review', review: 'scheduled', scheduled: 'published',
  }
  const next = nextStatus[entry.status]

  return (
    <div style={{
      padding: '0.6rem 0.8rem', background: 'var(--ink-surface)', border: '1px solid var(--ink-border)',
      borderRadius: '6px', marginBottom: '0.4rem', borderLeft: `3px solid ${(statusColors[entry.status] ?? statusColors.idea).text}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '0.5rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.title}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem', flexWrap: 'wrap' }}>
            <StatusBadge status={entry.status} />
            <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>{entry.channel}</span>
            {entry.seo_keyword && <span style={{ fontSize: '0.68rem', color: 'var(--ink-secondary)', fontFamily: 'var(--ink-font-mono, monospace)' }}>{entry.seo_keyword}</span>}
            {entry.assignee && <span style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>{entry.assignee}</span>}
            <span style={{ fontSize: '0.68rem', color: 'var(--ink-dim)' }}>{priorityIcons[entry.priority] ?? '-'} {entry.priority}</span>
          </div>
        </div>
        {next && !changing && (
          <button
            onClick={() => changeStatus(next)}
            style={{
              padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--ink-border)',
              background: 'transparent', color: 'var(--ink-muted)', cursor: 'pointer',
              fontSize: '0.68rem', whiteSpace: 'nowrap', transition: 'color 0.15s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = 'var(--ink-text)')}
            onMouseOut={(e) => (e.currentTarget.style.color = 'var(--ink-muted)')}
          >
            {next}
          </button>
        )}
      </div>
    </div>
  )
}

export function CalendarView() {
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [pipeline, setPipeline] = useState<Record<string, CalendarEntry[]>>({})
  const [view, setView] = useState<ViewMode>('calendar')
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const load = useCallback(async () => {
    const { url, token } = getApiConfig()
    if (!url) return
    setLoading(true)

    try {
      if (view === 'calendar') {
        const from = new Date(month.year, month.month, 1).toISOString().slice(0, 10)
        const to = new Date(month.year, month.month + 1, 0).toISOString().slice(0, 10)
        const res = await fetch(`${url}/api/content/calendar?from=${from}&to=${to}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json() as { entries: CalendarEntry[] }
          setEntries(data.entries ?? [])
        }
      } else {
        const res = await fetch(`${url}/api/content/pipeline`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json() as { pipeline: Record<string, CalendarEntry[]> }
          setPipeline(data.pipeline ?? {})
        }
      }
    } finally {
      setLoading(false)
    }
  }, [view, month])

  useEffect(() => { load() }, [load])

  const monthName = new Date(month.year, month.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate()
  const firstDayOfWeek = new Date(month.year, month.month, 1).getDay()

  // Group entries by day for calendar view
  const byDay: Record<number, CalendarEntry[]> = {}
  for (const e of entries) {
    const dateStr = e.scheduled_at ?? e.published_at
    const d = new Date(dateStr)
    if (d.getMonth() === month.month && d.getFullYear() === month.year) {
      const day = d.getDate()
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(e)
    }
  }

  const prevMonth = () => setMonth(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 })
  const nextMonth = () => setMonth(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 })

  const pipelineOrder = ['idea', 'draft', 'review', 'scheduled', 'published']

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['calendar', 'pipeline'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '6px 14px', borderRadius: '4px', border: '1px solid var(--ink-border)',
                background: view === v ? 'rgba(6,182,212,0.15)' : 'transparent',
                color: view === v ? '#06B6D4' : 'var(--ink-muted)',
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize',
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {view === 'calendar' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: '1.1rem' }}>&lt;</button>
            <span style={{ color: 'var(--ink-text)', fontSize: '0.95rem', fontWeight: 600, minWidth: '160px', textAlign: 'center' }}>{monthName}</span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: '1.1rem' }}>&gt;</button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--ink-muted)' }}>Loading...</div>
      ) : view === 'calendar' ? (
        /* Calendar Grid */
        <div style={{ background: 'var(--ink-surface)', border: '1px solid var(--ink-border)', borderRadius: '6px', overflow: 'hidden' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--ink-border)' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {/* Empty cells before first day */}
            {Array.from({ length: firstDayOfWeek }, (_, i) => (
              <div key={`e${i}`} style={{ minHeight: '90px', borderBottom: '1px solid var(--ink-border)', borderRight: '1px solid var(--ink-border)' }} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const dayEntries = byDay[day] ?? []
              const isToday = day === new Date().getDate() && month.month === new Date().getMonth() && month.year === new Date().getFullYear()

              return (
                <div
                  key={day}
                  style={{
                    minHeight: '90px', padding: '0.3rem', borderBottom: '1px solid var(--ink-border)',
                    borderRight: '1px solid var(--ink-border)',
                    background: isToday ? 'rgba(6,182,212,0.05)' : 'transparent',
                  }}
                >
                  <div style={{
                    fontSize: '0.75rem', fontWeight: isToday ? 700 : 400,
                    color: isToday ? '#06B6D4' : 'var(--ink-muted)',
                    marginBottom: '0.2rem', textAlign: 'right', padding: '0 0.2rem',
                  }}>
                    {day}
                  </div>
                  {dayEntries.slice(0, 3).map(e => (
                    <div
                      key={e.slug}
                      title={`${e.title} [${e.status}]`}
                      style={{
                        fontSize: '0.68rem', padding: '1px 4px', marginBottom: '2px',
                        borderRadius: '3px', overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', cursor: 'default',
                        background: (statusColors[e.status] ?? statusColors.idea).bg,
                        color: (statusColors[e.status] ?? statusColors.idea).text,
                      }}
                    >
                      {e.title}
                    </div>
                  ))}
                  {dayEntries.length > 3 && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--ink-dim)', textAlign: 'center' }}>+{dayEntries.length - 3} more</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Pipeline (Kanban) View */
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${pipelineOrder.length}, 1fr)`, gap: '0.75rem', overflowX: 'auto' }}>
          {pipelineOrder.map(status => {
            const items = pipeline[status] ?? []
            const colors = statusColors[status] ?? statusColors.idea
            return (
              <div key={status} style={{ minWidth: '200px' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.5rem 0.8rem', marginBottom: '0.5rem',
                  background: colors.bg, borderRadius: '6px',
                }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.text }}>{status}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', fontFamily: 'var(--ink-font-mono, monospace)' }}>{items.length}</span>
                </div>
                {items.map(e => (
                  <EntryCard key={e.slug} entry={e} onStatusChange={load} />
                ))}
                {items.length === 0 && (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--ink-dim)', fontSize: '0.78rem' }}>Empty</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
