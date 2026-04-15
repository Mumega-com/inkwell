import { useState, useEffect } from 'react'

interface LessonStatus {
  slug: string; title: string; order: number; free: boolean
  completed: boolean; completedAt: string | null; quizScore: number | null
  available: boolean; daysUntilAvailable: number
}

interface AccessData {
  enrolled: boolean; reason?: string; purchasedAt?: string
  progress?: { completed: number; total: number; percent: number }
}

interface CertData {
  studentName: string; courseName: string; certificateNumber: string
  issuedAt: string; issuer: string
}

interface Props {
  courseSlug: string; courseTitle?: string; courseDescription?: string
  coursePrice?: number; loginUrl?: string; buyUrl?: string; apiBase?: string
}

function icon(l: LessonStatus) {
  if (l.completed) return <span style={{ color: 'var(--ink-accent,#10B981)' }}>✓</span>
  if (l.free || l.available) return <span style={{ color: l.free ? 'var(--ink-secondary,#06B6D4)' : 'var(--ink-primary,#D4A017)', fontSize: '0.75em' }}>●</span>
  return <span style={{ color: 'var(--ink-dim,rgba(255,255,255,0.35))' }}>🔒</span>
}

export default function CoursePlayer({ courseSlug, courseTitle = 'Course', courseDescription = '', coursePrice = 47, loginUrl = '/login', buyUrl, apiBase = '' }: Props) {
  const [access, setAccess] = useState<AccessData | null>(null)
  const [lessons, setLessons] = useState<LessonStatus[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [cert, setCert] = useState<CertData | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)

  const api = (path: string) => fetch(`${apiBase}${path}`, { credentials: 'include' })

  function loadProgress() {
    api(`/api/courses/${courseSlug}/progress`)
      .then(r => r.json() as Promise<{ lessons: LessonStatus[] }>)
      .then(d => {
        setLessons(d.lessons ?? [])
        const first = d.lessons?.find(l => l.available && !l.completed) ?? d.lessons?.[0]
        if (first) setActive(first.slug)
        setLoading(false)
      }).catch(() => setLoading(false))
  }

  useEffect(() => {
    api(`/api/courses/${courseSlug}/access`)
      .then(r => r.json() as Promise<AccessData>)
      .then(d => { setAccess(d); if (d.enrolled) loadProgress(); else setLoading(false) })
      .catch(() => setLoading(false))
  }, [courseSlug])

  async function completeLesson(lessonSlug: string) {
    setCompleting(true)
    const res = await fetch(`${apiBase}/api/courses/${courseSlug}/complete-lesson`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonSlug }),
    })
    const data = await res.json() as { courseCompleted?: boolean }
    if (data.courseCompleted) {
      setDone(true)
      const cr = await api(`/api/courses/${courseSlug}/certificate`)
      if (cr.ok) setCert(await cr.json() as CertData)
    }
    loadProgress()
    setCompleting(false)
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--ink-muted)' }}>Loading...</div>

  if (!access?.enrolled) {
    const notAuth = access?.reason === 'not_authenticated'
    return (
      <div style={{ maxWidth: 480, margin: '4rem auto', padding: '2rem', textAlign: 'center', color: 'var(--ink-text)' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem' }}>{courseTitle}</h2>
        <p style={{ color: 'var(--ink-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>{courseDescription}</p>
        {notAuth
          ? <a href={loginUrl} style={S.btn}>Login to Access</a>
          : <>
              <div style={{ background: 'var(--ink-surface)', border: '1px solid var(--ink-border)', borderRadius: 6, padding: '0.75rem', marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--ink-muted)' }}>
                Lesson 1 is free — enroll to unlock the full course.
              </div>
              <a href={buyUrl || `/checkout?course=${courseSlug}`} style={S.btnPrimary}>Enroll — ${coursePrice}</a>
            </>
        }
      </div>
    )
  }

  const cur = lessons.find(l => l.slug === active)
  const pct = access.progress?.percent ?? Math.round((lessons.filter(l => l.completed).length / Math.max(lessons.length, 1)) * 100)
  const n = access.progress?.completed ?? lessons.filter(l => l.completed).length

  return (
    <div style={{ display: 'flex', minHeight: '70vh', background: 'var(--ink-bg)', color: 'var(--ink-text)' }}>
      <aside style={{ width: 240, minWidth: 240, background: 'var(--ink-surface)', borderRight: '1px solid var(--ink-border)', padding: '1.5rem 1rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem' }}>{courseTitle}</div>
        <div style={{ height: 6, background: 'var(--ink-border)', borderRadius: 3, overflow: 'hidden', marginBottom: '0.25rem' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--ink-primary,#D4A017)', borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '0.75rem' }}>{n} / {lessons.length} ({pct}%)</div>
        <nav>
          {lessons.map(l => (
            <button key={l.slug} onClick={() => l.available && setActive(l.slug)} disabled={!l.available}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', background: active === l.slug ? 'rgba(212,160,23,0.12)' : 'none', border: 'none', padding: '0.5rem 0.25rem', borderRadius: 4, textAlign: 'left', color: active === l.slug ? 'var(--ink-primary,#D4A017)' : 'var(--ink-text)', fontSize: '0.85rem', cursor: l.available ? 'pointer' : 'default', opacity: l.available ? 1 : 0.5 }}>
              {icon(l)}
              <span style={{ flex: 1 }}>{l.title}</span>
              {!l.available && l.daysUntilAvailable > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--ink-dim)', whiteSpace: 'nowrap' }}>in {l.daysUntilAvailable}d</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main style={{ flex: 1, padding: '2rem', overflow: 'auto' }}>
        {done && cert ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
            <h2>Course Complete!</h2>
            <div style={{ background: 'var(--ink-surface)', border: '2px solid var(--ink-primary,#D4A017)', borderRadius: 12, padding: '2rem', maxWidth: 400, margin: '1.5rem auto', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cert.courseName}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>{cert.studentName}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--ink-dim)' }}>#{cert.certificateNumber}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginTop: '0.25rem' }}>{new Date(cert.issuedAt).toLocaleDateString()}</div>
            </div>
          </div>
        ) : cur ? (
          <>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>{cur.title}</h1>
            <div style={{ marginBottom: '2rem', lineHeight: 1.7 }}>
              <p style={{ color: 'var(--ink-muted)' }}>Lesson content renders here — connect your content source or CMS.</p>
            </div>
            {!cur.completed && cur.available && (
              <button onClick={() => completeLesson(cur.slug)} disabled={completing} style={S.completeBtn}>
                {completing ? 'Saving…' : 'Mark as Complete'}
              </button>
            )}
            {cur.completed && <div style={{ color: 'var(--ink-accent,#10B981)', fontWeight: 600 }}>✓ Completed</div>}
          </>
        ) : <div style={{ color: 'var(--ink-muted)' }}>Select a lesson to begin.</div>}
      </main>
    </div>
  )
}

const S = {
  btn: { display: 'inline-block', padding: '0.75rem 1.5rem', background: 'var(--ink-surface)', border: '1px solid var(--ink-border)', borderRadius: 6, color: 'var(--ink-text)', textDecoration: 'none', fontWeight: 600 } as React.CSSProperties,
  btnPrimary: { display: 'inline-block', padding: '0.75rem 1.5rem', background: 'var(--ink-primary,#D4A017)', color: '#000', borderRadius: 6, textDecoration: 'none', fontWeight: 700, fontSize: '1.1rem' } as React.CSSProperties,
  completeBtn: { background: 'var(--ink-primary,#D4A017)', color: '#000', border: 'none', borderRadius: 6, padding: '0.75rem 1.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' } as React.CSSProperties,
}
