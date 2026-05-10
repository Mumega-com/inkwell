import { useState, useEffect, useCallback } from 'react'

interface CourseAccess {
  enrolled: boolean
  purchasedAt?: string
  progress?: { completed: number; total: number; percent: number }
  reason?: string
}

interface Lesson {
  slug: string
  title: string
  order: number
  free: boolean
  completed: boolean
  completedAt: string | null
  quizScore: number | null
  available: boolean
  daysUntilAvailable: number
}

function getApiConfig() {
  return {
    url: localStorage.getItem('mumega_api_url') ?? '',
    token: localStorage.getItem('mumega_auth_token') ?? '',
  }
}

function ProgressRing({ percent }: { percent: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ
  const color = percent >= 100 ? '#10B981' : percent >= 50 ? '#06B6D4' : '#D4A017'
  return (
    <svg width="90" height="90" viewBox="0 0 90 90">
      <circle cx="45" cy="45" r={r} fill="none" stroke="var(--ink-border)" strokeWidth="6" />
      <circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 45 45)" style={{ transition: 'stroke-dashoffset 0.5s' }} />
      <text x="45" y="45" textAnchor="middle" dominantBaseline="central"
        fill="var(--ink-text)" fontSize="18" fontWeight="700">{percent}%</text>
    </svg>
  )
}

export function CourseOverview({ courseSlug = 'ai-governance' }: { courseSlug?: string }) {
  const [access, setAccess] = useState<CourseAccess | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { url, token } = getApiConfig()
    if (!url) return
    setLoading(true)
    try {
      const [accessRes, progressRes] = await Promise.all([
        fetch(`${url}/api/courses/${courseSlug}/access`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${url}/api/courses/${courseSlug}/progress`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ])
      if (accessRes.ok) {
        const data = await accessRes.json() as CourseAccess
        setAccess(data)
      }
      if (progressRes?.ok) {
        const data = await progressRes.json() as { lessons: Lesson[] }
        setLessons(data.lessons ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [courseSlug])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--ink-muted)' }}>Loading...</div>
  }

  const enrolled = access?.enrolled ?? false
  const progress = access?.progress

  return (
    <div>
      {/* Enrollment Status */}
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {enrolled && progress && <ProgressRing percent={progress.percent} />}
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ink-text)', marginBottom: '0.3rem' }}>
            {enrolled ? 'Enrolled' : 'Not Enrolled'}
          </div>
          {enrolled && progress && (
            <div style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
              {progress.completed} of {progress.total} lessons completed
            </div>
          )}
          {enrolled && access?.purchasedAt && (
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-dim)', marginTop: '0.2rem' }}>
              Since {new Date(access.purchasedAt).toLocaleDateString()}
            </div>
          )}
          {!enrolled && (
            <div style={{ fontSize: '0.82rem', color: 'var(--ink-dim)' }}>{access?.reason ?? 'Not purchased'}</div>
          )}
        </div>
      </div>

      {/* Lesson List */}
      {lessons.length > 0 && (
        <div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink-text)', marginBottom: '0.5rem' }}>Lessons</div>
          <div style={{ background: 'var(--ink-surface)', border: '1px solid var(--ink-border)', borderRadius: '6px', overflow: 'hidden' }}>
            {lessons.map((l, i) => (
              <div key={l.slug} style={{
                padding: '0.6rem 0.8rem', borderBottom: i < lessons.length - 1 ? '1px solid var(--ink-border)' : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem',
                opacity: l.available ? 1 : 0.5,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                  <span style={{
                    width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.65rem', fontWeight: 600, flexShrink: 0,
                    background: l.completed ? 'rgba(16,185,129,0.2)' : 'var(--ink-border)',
                    color: l.completed ? '#10B981' : 'var(--ink-muted)',
                  }}>
                    {l.completed ? '\u2713' : l.order}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--ink-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</span>
                  {l.free && <span style={{ fontSize: '0.62rem', color: '#06B6D4', background: 'rgba(6,182,212,0.12)', padding: '0 5px', borderRadius: '8px', fontWeight: 600 }}>FREE</span>}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--ink-dim)', whiteSpace: 'nowrap' }}>
                  {l.completed && l.completedAt ? new Date(l.completedAt).toLocaleDateString() : ''}
                  {!l.available && l.daysUntilAvailable > 0 ? `${l.daysUntilAvailable}d` : ''}
                  {l.quizScore !== null ? ` (${l.quizScore}%)` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lessons.length === 0 && enrolled && (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--ink-dim)', fontSize: '0.78rem' }}>
          No lesson data available
        </div>
      )}
    </div>
  )
}
