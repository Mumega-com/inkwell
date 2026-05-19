import { useState, useEffect, useCallback } from 'react'
import { cn } from '../../../src/lib/utils'

interface NpsWidgetProps {
  surveyId?: string
  question?: string
  onComplete?: () => void
}

export function NpsWidget({
  surveyId = 'nps-default',
  question = 'How likely are you to recommend us?',
  onComplete,
}: NpsWidgetProps) {
  const [score, setScore] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [visible, setVisible] = useState(true)

  const storageKey = `nps_${surveyId}_submitted`

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === 'true') {
        setAlreadyDone(true)
      }
    } catch {
      // localStorage unavailable
    }
  }, [storageKey])

  const handleSubmit = useCallback(async () => {
    if (score === null || submitting) return
    setSubmitting(true)
    try {
      await fetch(`${window.location.origin}/api/feedback/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId,
          answers: { nps: score },
          score,
          freetext: reason || undefined,
          path: window.location.pathname,
        }),
      })

      localStorage.setItem(storageKey, 'true')
      setSubmitted(true)
      setTimeout(() => {
        setVisible(false)
        onComplete?.()
      }, 2000)
    } catch {
      // Silently handle — don't block user
      localStorage.setItem(storageKey, 'true')
      setSubmitted(true)
      setTimeout(() => {
        setVisible(false)
        onComplete?.()
      }, 2000)
    } finally {
      setSubmitting(false)
    }
  }, [score, reason, surveyId, storageKey, submitting, onComplete])

  if (alreadyDone || !visible) return null

  if (submitted) {
    return (
      <div
        className="rounded-lg border p-6 text-center"
        style={{
          backgroundColor: 'var(--ink-surface)',
          borderColor: 'var(--ink-border)',
          color: 'var(--ink-text)',
        }}
      >
        <p className="text-sm font-medium" style={{ fontFamily: 'var(--ink-font-display)' }}>
          Thank you for your feedback
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        backgroundColor: 'var(--ink-surface)',
        borderColor: 'var(--ink-border)',
        color: 'var(--ink-text)',
      }}
    >
      <div className="px-5 py-4 flex flex-col gap-3">
        <p className="text-sm font-medium" style={{ fontFamily: 'var(--ink-font-display)' }}>
          {question}
        </p>

        {/* Score buttons */}
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setScore(i)}
                className={cn(
                  'h-9 w-9 rounded text-sm font-mono font-medium transition-colors',
                  'border hover:opacity-80',
                  score === i
                    ? 'text-white'
                    : 'text-[var(--ink-muted)] border-[var(--ink-border)] bg-[var(--ink-bg)]'
                )}
                style={score === i ? { backgroundColor: 'var(--ink-primary)', borderColor: 'var(--ink-primary)' } : undefined}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="flex justify-between px-1">
            <span className="text-xs" style={{ color: 'var(--ink-dim)' }}>Not likely</span>
            <span className="text-xs" style={{ color: 'var(--ink-dim)' }}>Very likely</span>
          </div>
        </div>

        {/* Reason textarea — appears after score selection */}
        {score !== null && (
          <div className="flex flex-col gap-2 mt-1">
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value.slice(0, 500))}
              rows={2}
              className="w-full rounded border px-3 py-2 text-sm resize-none bg-[var(--ink-bg)] border-[var(--ink-border)] text-[var(--ink-text)] placeholder:text-[var(--ink-dim)] focus:outline-none"
              placeholder="What's the main reason for your score? (optional)"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="text-sm px-4 py-2 rounded font-medium transition-colors text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--ink-primary)' }}
              >
                {submitting ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
