import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DimensionScores {
  digital_foundation: number
  content_capability: number
  data_maturity: number
  growth_readiness: number
  market_position: number
}

interface PlanStep {
  id: string
  module_slug: string
  title: string
  description: string
  week: number
  order_index: number
  status: 'locked' | 'available' | 'in_progress' | 'done'
  completed_at: string | null
}

interface PlanData {
  id: string
  title: string
  businessName: string
  industry: string
  readinessScore: number
  dimensions: DimensionScores
  totalSteps: number
  completedSteps: number
  progressPercent: number
  status: string
  createdAt: string
  estimatedCompletionDate: string
  steps: PlanStep[]
}

interface Props {
  planId: string
  apiBase?: string
}

// ── Dimension labels ───────────────────────────────────────────────────────────

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  digital_foundation: 'Digital Foundation',
  content_capability: 'Content Capability',
  data_maturity: 'Data Maturity',
  growth_readiness: 'Growth Readiness',
  market_position: 'Market Position',
}

const DIMENSION_DESCRIPTIONS: Record<keyof DimensionScores, string> = {
  digital_foundation: 'Website, Google Business Profile, CRM',
  content_capability: 'Writing, video, social consistency',
  data_maturity: 'Analytics, tracking, data-driven decisions',
  growth_readiness: 'Budget, team capacity, timeline',
  market_position: 'Years in market, differentiation, customer clarity',
}

// ── Category colors ───────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  FOUNDATION: '#6366f1',
  CONTENT: '#06b6d4',
  ACQUISITION: '#f59e0b',
  OPTIMIZATION: '#10b981',
  SCALE: '#ec4899',
}

function getCategoryFromSlug(slug: string): string {
  if (['setup-website', 'setup-gbp', 'setup-tracking', 'setup-crm'].includes(slug)) return 'FOUNDATION'
  if (['first-seo-pages', 'social-setup', 'content-calendar', 'first-video'].includes(slug)) return 'CONTENT'
  if (['google-ads-start', 'facebook-retargeting', 'email-list', 'cold-outreach'].includes(slug)) return 'ACQUISITION'
  if (['seo-audit', 'conversion-optimization', 'review-campaign', 'referral-system'].includes(slug)) return 'OPTIMIZATION'
  return 'SCALE'
}

// ── CircularScore ─────────────────────────────────────────────────────────────

function CircularScore({ score }: { score: number }) {
  const r = 54
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference

  const color =
    score >= 70 ? '#10b981' :
    score >= 45 ? '#f59e0b' :
    '#ef4444'

  return (
    <div style={{ position: 'relative', width: '140px', height: '140px', margin: '0 auto' }}>
      <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--ink-border)" strokeWidth="8" />
        <circle
          cx="70" cy="70" r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.1rem',
        }}
      >
        <span style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>out of 100</span>
      </div>
    </div>
  )
}

// ── DimensionBar ──────────────────────────────────────────────────────────────

function DimensionBar({ label, description, score }: { label: string; description: string; score: number }) {
  const color =
    score >= 70 ? '#10b981' :
    score >= 45 ? '#f59e0b' :
    '#ef4444'

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <div>
          <span style={{ color: 'var(--ink-text)', fontSize: '0.875rem', fontWeight: 600 }}>{label}</span>
          <span style={{ color: 'var(--ink-dim)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>{description}</span>
        </div>
        <span style={{ color, fontWeight: 700, fontSize: '0.875rem' }}>{score}</span>
      </div>
      <div
        style={{
          height: '6px',
          background: 'var(--ink-border)',
          borderRadius: '3px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${score}%`,
            background: color,
            borderRadius: '3px',
            transition: 'width 1s ease',
          }}
        />
      </div>
    </div>
  )
}

// ── StepCard ──────────────────────────────────────────────────────────────────

function StepCard({
  step,
  onComplete,
  completing,
}: {
  step: PlanStep
  onComplete: (id: string) => void
  completing: string | null
}) {
  const category = getCategoryFromSlug(step.module_slug)
  const catColor = CATEGORY_COLORS[category] ?? 'var(--ink-primary)'
  const isDone = step.status === 'done'
  const isAvailable = step.status === 'available'
  const isLocked = step.status === 'locked'

  return (
    <div
      style={{
        padding: '1rem 1.25rem',
        background: isDone
          ? 'rgba(16,185,129,0.05)'
          : isAvailable
            ? 'var(--ink-surface)'
            : 'rgba(0,0,0,0.15)',
        border: isDone
          ? '1.5px solid rgba(16,185,129,0.3)'
          : isAvailable
            ? `1.5px solid ${catColor}40`
            : '1.5px solid var(--ink-border)',
        borderRadius: '0.625rem',
        marginBottom: '0.75rem',
        opacity: isLocked ? 0.55 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
        {/* Status icon */}
        <div
          style={{
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '0.8rem',
            background: isDone
              ? 'rgba(16,185,129,0.2)'
              : isAvailable
                ? `${catColor}20`
                : 'var(--ink-surface)',
            color: isDone ? '#10b981' : isAvailable ? catColor : 'var(--ink-dim)',
          }}
        >
          {isDone ? '✓' : isLocked ? '🔒' : '▶'}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: catColor,
                background: `${catColor}18`,
                padding: '0.15rem 0.5rem',
                borderRadius: '1rem',
                letterSpacing: '0.05em',
              }}
            >
              {category}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--ink-dim)' }}>
              Week {step.week}
            </span>
          </div>

          <h4
            style={{
              color: isDone ? 'var(--ink-muted)' : 'var(--ink-text)',
              fontSize: '0.95rem',
              fontWeight: 600,
              marginBottom: '0.25rem',
              textDecoration: isDone ? 'line-through' : 'none',
            }}
          >
            {step.title}
          </h4>

          <p style={{ color: 'var(--ink-muted)', fontSize: '0.82rem', lineHeight: 1.5, margin: 0 }}>
            {step.description}
          </p>

          {isDone && step.completed_at && (
            <p style={{ color: '#10b981', fontSize: '0.75rem', marginTop: '0.4rem' }}>
              Completed {new Date(step.completed_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}

          {isAvailable && (
            <button
              type="button"
              onClick={() => onComplete(step.id)}
              disabled={completing === step.id}
              style={{
                marginTop: '0.75rem',
                padding: '0.45rem 1rem',
                background: catColor,
                border: 'none',
                borderRadius: '0.375rem',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: completing === step.id ? 'default' : 'pointer',
                fontFamily: 'inherit',
                opacity: completing === step.id ? 0.6 : 1,
              }}
            >
              {completing === step.id ? 'Marking done...' : 'Mark as Done'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function PlanDashboard({ planId, apiBase = '' }: Props) {
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completing, setCompleting] = useState<string | null>(null)

  async function loadPlan() {
    try {
      const res = await fetch(`${apiBase}/api/discovery/plan/${planId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as PlanData
      setPlan(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load plan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPlan() }, [planId])

  async function handleComplete(stepId: string) {
    if (!plan) return
    setCompleting(stepId)

    try {
      const res = await fetch(`${apiBase}/api/discovery/plan/${planId}/complete-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await loadPlan()
    } catch {
      // silently fail — step state will reload on next fetch
    } finally {
      setCompleting(null)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--ink-muted)' }}>
        Loading your plan...
      </div>
    )
  }

  if (error || !plan) {
    return (
      <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#f87171' }}>
        {error ?? 'Plan not found.'}
      </div>
    )
  }

  // Group steps by week
  const weekGroups: Record<number, PlanStep[]> = {}
  for (const step of plan.steps) {
    if (!weekGroups[step.week]) weekGroups[step.week] = []
    weekGroups[step.week].push(step)
  }
  const weeks = Object.keys(weekGroups).map(Number).sort((a, b) => a - b)

  const nextStep = plan.steps.find(s => s.status === 'available')

  const scoreLabel =
    plan.readinessScore >= 70 ? 'Strong Foundation' :
    plan.readinessScore >= 45 ? 'Getting There' :
    'Starting Fresh'

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1rem' }}>

      {/* ── Header ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '2rem',
          alignItems: 'center',
          marginBottom: '2.5rem',
          padding: '2rem',
          background: 'var(--ink-surface)',
          borderRadius: '1rem',
          border: '1px solid var(--ink-border)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <CircularScore score={plan.readinessScore} />
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            {scoreLabel}
          </p>
        </div>

        <div>
          <h1 style={{ color: 'var(--ink-text)', fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.25rem' }}>
            {plan.businessName}
          </h1>
          <p style={{ color: 'var(--ink-primary)', fontWeight: 600, marginBottom: '1rem', fontSize: '0.9rem' }}>
            {plan.title}
          </p>

          {/* 5 dimension bars */}
          <div>
            {(Object.keys(DIMENSION_LABELS) as Array<keyof DimensionScores>).map((key) => (
              <DimensionBar
                key={key}
                label={DIMENSION_LABELS[key]}
                description={DIMENSION_DESCRIPTIONS[key]}
                score={plan.dimensions[key]}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 280px',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >

        {/* ── Roadmap (left) ── */}
        <div>
          <h2 style={{ color: 'var(--ink-text)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>
            Your 90-Day Roadmap
          </h2>

          {weeks.map((week) => (
            <div key={week} style={{ marginBottom: '1.75rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '0.75rem',
                }}
              >
                <div
                  style={{
                    padding: '0.2rem 0.75rem',
                    background: 'rgba(212,160,23,0.1)',
                    border: '1px solid rgba(212,160,23,0.25)',
                    borderRadius: '1rem',
                    color: 'var(--ink-primary)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  WEEK {week}
                </div>
                <div style={{ height: '1px', flex: 1, background: 'var(--ink-border)' }} />
              </div>

              {weekGroups[week].map((step) => (
                <StepCard
                  key={step.id}
                  step={step}
                  onComplete={handleComplete}
                  completing={completing}
                />
              ))}
            </div>
          ))}
        </div>

        {/* ── Sidebar (right) ── */}
        <div style={{ position: 'sticky', top: '5rem' }}>
          {/* Progress card */}
          <div
            style={{
              padding: '1.25rem',
              background: 'var(--ink-surface)',
              border: '1px solid var(--ink-border)',
              borderRadius: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <h3 style={{ color: 'var(--ink-text)', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Your Progress
            </h3>

            {/* Progress bar */}
            <div
              style={{
                height: '8px',
                background: 'var(--ink-border)',
                borderRadius: '4px',
                overflow: 'hidden',
                marginBottom: '0.5rem',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${plan.progressPercent}%`,
                  background: 'linear-gradient(to right, var(--ink-primary), var(--ink-secondary))',
                  borderRadius: '4px',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>

            <p style={{ color: 'var(--ink-muted)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
              <strong style={{ color: 'var(--ink-text)' }}>{plan.completedSteps} of {plan.totalSteps}</strong> steps completed ({plan.progressPercent}%)
            </p>

            {nextStep && (
              <div
                style={{
                  padding: '0.65rem 0.875rem',
                  background: 'rgba(212,160,23,0.08)',
                  border: '1px solid rgba(212,160,23,0.2)',
                  borderRadius: '0.5rem',
                }}
              >
                <p style={{ color: 'var(--ink-dim)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                  NEXT UP
                </p>
                <p style={{ color: 'var(--ink-primary)', fontSize: '0.82rem', fontWeight: 600, margin: 0 }}>
                  {nextStep.title}
                </p>
              </div>
            )}
          </div>

          {/* Timeline card */}
          <div
            style={{
              padding: '1.25rem',
              background: 'var(--ink-surface)',
              border: '1px solid var(--ink-border)',
              borderRadius: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <h3 style={{ color: 'var(--ink-text)', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Timeline
            </h3>
            <div style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span>Started</span>
                <span style={{ color: 'var(--ink-text)', fontWeight: 600 }}>
                  {new Date(plan.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Est. finish</span>
                <span style={{ color: 'var(--ink-primary)', fontWeight: 600 }}>
                  {new Date(plan.estimatedCompletionDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* Help card */}
          <div
            style={{
              padding: '1.25rem',
              background: 'rgba(212,160,23,0.06)',
              border: '1px solid rgba(212,160,23,0.2)',
              borderRadius: '0.75rem',
            }}
          >
            <p style={{ color: 'var(--ink-text)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Need help?
            </p>
            <p style={{ color: 'var(--ink-muted)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
              We can do any of these steps with you or for you.
            </p>
            <button
              type="button"
              onClick={() => {
                // Opens the chat widget if present
                const chatBtn = document.querySelector<HTMLButtonElement>('[data-chat-open]')
                if (chatBtn) chatBtn.click()
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.6rem 1rem',
                background: 'var(--ink-primary)',
                border: 'none',
                borderRadius: '0.375rem',
                color: '#000',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Chat with us →
            </button>
          </div>
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .plan-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
