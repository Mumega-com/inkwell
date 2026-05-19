import { useState, useEffect } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  slug: string
  navigate: (path: string) => void
}

interface MeData {
  fullName?: string
  email?: string
  createdAt?: string
  lastIp?: string
}

interface AgreementsPendingData {
  signed: boolean
}

interface CheckInData {
  question?: string
  answered: boolean
}

interface TasksData {
  tasks: Array<{ id: string; status: string }>
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

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 1) + '…'
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ width = '100%', height = '16px' }: { width?: string; height?: string }) {
  return (
    <div
      style={{
        width,
        height,
        background: 'var(--ink-border)',
        borderRadius: '6px',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomeView({ slug, navigate }: Props) {
  const [me, setMe] = useState<MeData | null>(null)
  const [checkin, setCheckin] = useState<CheckInData | null>(null)
  const [tasks, setTasks] = useState<TasksData | null>(null)
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState<{
    clicks28d: number
    impressions28d: number
    topQueries: Array<{ query: string; clicks: number; position: number | null }>
  } | null>(null)

  // Security banner state
  const [dismissedLastLogin, setDismissedLastLogin] = useState(false)
  const [termsSigned, setTermsSigned] = useState<boolean | null>(null)
  const [showTermsText, setShowTermsText] = useState(false)
  const [termsSubmitting, setTermsSubmitting] = useState(false)
  const [dismissedIpNotice, setDismissedIpNotice] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch('/api/portal/me').then((r) => r.json()),
      apiFetch('/api/portal/checkin').then((r) => r.json()),
      apiFetch('/api/portal/tasks').then((r) => r.json()),
    ])
      .then(([meData, checkinData, tasksData]) => {
        if (cancelled) return
        setMe(meData as MeData)
        setCheckin(checkinData as CheckInData)
        setTasks(tasksData as TasksData)
      })
      .catch(() => {
        // Non-fatal — show empty states
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [slug])

  // Fetch KPIs on mount
  useEffect(() => {
    let cancelled = false
    fetch('/api/portal/kpis', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && !cancelled) setKpis(data as typeof kpis) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [slug])

  // Fetch pending agreements on mount
  useEffect(() => {
    let cancelled = false
    apiFetch('/api/portal/agreements/pending')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setTermsSigned((data as AgreementsPendingData).signed)
        }
      })
      .catch(() => {
        // Non-fatal — skip banner if request fails
      })
    return () => { cancelled = true }
  }, [slug])

  // Check localStorage for IP notice dismissal
  useEffect(() => {
    const seen = localStorage.getItem('portal_security_notice_seen')
    if (seen === 'true') setDismissedIpNotice(true)
  }, [])

  function handleDismissIpNotice() {
    localStorage.setItem('portal_security_notice_seen', 'true')
    setDismissedIpNotice(true)
  }

  async function handleSignTerms() {
    setTermsSubmitting(true)
    try {
      const res = await apiFetch('/api/portal/agreements/sign', {
        method: 'POST',
        body: JSON.stringify({ agreementType: 'portal_terms' }),
      })
      if (res.ok) {
        setTermsSigned(true)
        setShowTermsText(false)
      }
    } catch {
      // Non-fatal — leave banner visible
    } finally {
      setTermsSubmitting(false)
    }
  }

  const openTaskCount = tasks?.tasks.filter((t) => t.status !== 'done').length ?? 0

  return (
    <div style={{ padding: '24px 16px 16px' }}>
      {/* ── Security banners ────────────────────────────────────────────── */}

      {/* 1. Last Login Notice */}
      {!dismissedLastLogin && me?.createdAt && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: 'var(--ink-surface)',
            border: '1px solid var(--ink-border)',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '13px',
            color: 'var(--ink-muted)',
          }}
        >
          <span>
            Last login:{' '}
            {new Date(me.createdAt).toLocaleString('en-CA', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {me.lastIp ? ` from ${me.lastIp}` : ''}
          </span>
          <button
            onClick={() => setDismissedLastLogin(true)}
            aria-label="Dismiss last login notice"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ink-muted)',
              fontSize: '16px',
              lineHeight: '1',
              padding: '0 2px',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* 2. Unsigned Terms Banner */}
      {termsSigned === false && (
        <div
          style={{
            background: '#1e3a5f',
            border: '1px solid #2e5a8e',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#90c8f8',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span>Please review and sign our Terms of Service to continue using the portal.</span>
            <button
              onClick={() => setShowTermsText((v) => !v)}
              style={{
                background: '#2e5a8e',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '600',
                padding: '5px 12px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Sign Terms
            </button>
          </div>
          {showTermsText && (
            <div
              style={{
                marginTop: '12px',
                background: '#162d47',
                borderRadius: '8px',
                padding: '12px',
              }}
            >
              <p style={{ margin: '0 0 10px', color: '#b0d4f1', lineHeight: '1.6' }}>
                By using this portal, you agree to our Terms of Service and Privacy Policy.
                Your data is processed according to GDPR Article 6(1)(b) (contractual necessity).
                Last updated: 2026-04-22. Questions: legal@example.com
              </p>
              <button
                onClick={handleSignTerms}
                disabled={termsSubmitting}
                style={{
                  background: termsSubmitting ? '#2e5a8e' : '#1d6fbf',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: termsSubmitting ? 'not-allowed' : 'pointer',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: '600',
                  padding: '6px 14px',
                  opacity: termsSubmitting ? 0.7 : 1,
                }}
              >
                {termsSubmitting ? 'Saving…' : 'I Agree'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. IP Change / Security Notice */}
      {!dismissedIpNotice && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: '#3d2e00',
            border: '1px solid #7a5c00',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#f5d77a',
          }}
        >
          <span>
            Security notice: If you see unfamiliar login activity, contact your account manager.
          </span>
          <button
            onClick={handleDismissIpNotice}
            aria-label="Dismiss security notice"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#f5d77a',
              fontSize: '16px',
              lineHeight: '1',
              padding: '0 2px',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* KPI bar */}
      {kpis && (kpis.clicks28d > 0 || kpis.topQueries.length > 0) && (
        <div
          style={{
            background: 'var(--ink-surface)',
            border: '1px solid var(--ink-border)',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: 'var(--ink-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '12px',
            }}
          >
            Search Performance — Last 28 Days
          </div>
          <div style={{ display: 'flex', gap: '24px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--ink-primary)' }}>
                {kpis.clicks28d.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Organic Clicks</div>
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--ink-text)' }}>
                {(kpis as { impressions28d?: number }).impressions28d?.toLocaleString() ?? '—'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Impressions</div>
            </div>
          </div>
          {kpis.topQueries.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {kpis.topQueries.slice(0, 3).map((q, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span
                    style={{
                      color: 'var(--ink-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '200px',
                    }}
                  >
                    {q.query}
                  </span>
                  <span style={{ color: 'var(--ink-text)', flexShrink: 0, marginLeft: '8px' }}>
                    {q.clicks} clicks · pos {q.position ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Greeting */}
      <div style={{ marginBottom: '28px' }}>
        {loading ? (
          <Skeleton width="60%" height="28px" />
        ) : (
          <h1
            style={{
              fontSize: '22px',
              fontWeight: '700',
              color: 'var(--ink-text)',
              margin: '0',
            }}
          >
            Hello, {me?.fullName ?? slug}
          </h1>
        )}
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--ink-muted)' }}>
          {new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Check-in card */}
        <SummaryCard
          onClick={() => navigate(`/portal/${slug}/checkin`)}
          loading={loading}
          title="Today's Check-in"
          icon="✦"
        >
          {loading ? (
            <Skeleton width="75%" />
          ) : checkin?.answered ? (
            <span style={{ color: 'var(--ink-primary)', fontSize: '14px', fontWeight: '500' }}>
              Answered ✓
            </span>
          ) : (
            <span style={{ color: 'var(--ink-muted)', fontSize: '14px' }}>
              {checkin?.question ? truncate(checkin.question, 60) : 'Pending…'}
            </span>
          )}
        </SummaryCard>

        {/* Tasks card */}
        <SummaryCard
          onClick={() => navigate(`/portal/${slug}/tasks`)}
          loading={loading}
          title="Open Tasks"
          icon="☐"
        >
          {loading ? (
            <Skeleton width="40%" />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  background: openTaskCount > 0 ? 'var(--ink-secondary)' : 'var(--ink-border)',
                  color: openTaskCount > 0 ? '#000' : 'var(--ink-muted)',
                  borderRadius: '12px',
                  padding: '2px 10px',
                  fontSize: '13px',
                  fontWeight: '600',
                  minWidth: '28px',
                  textAlign: 'center',
                }}
              >
                {openTaskCount}
              </span>
              <span style={{ fontSize: '14px', color: 'var(--ink-muted)' }}>
                {openTaskCount === 1 ? 'task open' : 'tasks open'}
              </span>
            </div>
          )}
        </SummaryCard>

        {/* Activity card */}
        <SummaryCard
          onClick={() => navigate(`/portal/${slug}/activity`)}
          loading={false}
          title="Recent Activity"
          icon="◎"
        >
          <span
            style={{
              fontSize: '14px',
              color: 'var(--ink-secondary)',
              fontWeight: '500',
            }}
          >
            View →
          </span>
        </SummaryCard>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

// ── SummaryCard sub-component ─────────────────────────────────────────────────

interface SummaryCardProps {
  title: string
  icon: string
  onClick: () => void
  loading: boolean
  children: React.ReactNode
}

function SummaryCard({ title, icon, onClick, children }: SummaryCardProps) {
  const [pressed, setPressed] = useState(false)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        background: 'var(--ink-surface)',
        border: '1px solid var(--ink-border)',
        borderRadius: '12px',
        padding: '16px',
        cursor: 'pointer',
        transition: 'opacity 0.1s',
        opacity: pressed ? 0.7 : 1,
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '10px',
        }}
      >
        <span style={{ fontSize: '16px', color: 'var(--ink-primary)' }}>{icon}</span>
        <span
          style={{
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--ink-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}
