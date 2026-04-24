import { useState, useCallback } from 'react'
import { cn } from '../../../src/lib/utils'

interface FeedbackQuestion {
  id: string
  text: string
  type: 'nps' | 'rating' | 'choice' | 'text' | 'boolean'
  options?: string[]
  required: boolean
}

interface FeedbackWidgetProps {
  surveyId: string
  questions: FeedbackQuestion[]
  title?: string
  onComplete?: () => void
}

type AnswerValue = number | string | boolean | null

function NpsInput({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={cn(
              'h-9 w-9 rounded text-sm font-mono font-medium transition-colors',
              'border hover:opacity-80',
              value === i
                ? 'text-white'
                : 'text-[var(--ink-muted)] border-[var(--ink-border)] bg-[var(--ink-bg)]'
            )}
            style={value === i ? { backgroundColor: 'var(--ink-primary)', borderColor: 'var(--ink-primary)' } : undefined}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="flex justify-between px-1">
        <span className="text-xs text-[var(--ink-dim)]">Not likely</span>
        <span className="text-xs text-[var(--ink-dim)]">Very likely</span>
      </div>
    </div>
  )
}

function RatingInput({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value ?? 0

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(null)}
          className="text-2xl transition-colors p-0.5"
          style={{ color: star <= display ? 'var(--ink-primary)' : 'var(--ink-dim)' }}
        >
          {star <= display ? '\u2605' : '\u2606'}
        </button>
      ))}
    </div>
  )
}

function ChoiceInput({ options, value, onChange }: { options: string[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            'text-left px-3 py-2 rounded text-sm border transition-colors',
            value === opt
              ? 'text-white'
              : 'text-[var(--ink-text)] border-[var(--ink-border)] bg-[var(--ink-bg)] hover:border-[var(--ink-muted)]'
          )}
          style={value === opt ? { backgroundColor: 'var(--ink-primary)', borderColor: 'var(--ink-primary)' } : undefined}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const max = 500
  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value.slice(0, max))}
        rows={3}
        className="w-full rounded border px-3 py-2 text-sm resize-none bg-[var(--ink-bg)] border-[var(--ink-border)] text-[var(--ink-text)] placeholder:text-[var(--ink-dim)] focus:outline-none focus:ring-1"
        style={{ '--tw-ring-color': 'var(--ink-primary)' } as React.CSSProperties}
        placeholder="Type your answer..."
      />
      <span className="text-xs text-[var(--ink-dim)] text-right font-mono">
        {value.length}/{max}
      </span>
    </div>
  )
}

function BooleanInput({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-3">
      {[
        { val: true, label: '\u{1F44D} Yes' },
        { val: false, label: '\u{1F44E} No' },
      ].map(({ val, label }) => (
        <button
          key={String(val)}
          type="button"
          onClick={() => onChange(val)}
          className={cn(
            'px-5 py-2.5 rounded text-sm font-medium border transition-colors',
            value === val
              ? 'text-white'
              : 'text-[var(--ink-text)] border-[var(--ink-border)] bg-[var(--ink-bg)] hover:border-[var(--ink-muted)]'
          )}
          style={value === val ? { backgroundColor: 'var(--ink-primary)', borderColor: 'var(--ink-primary)' } : undefined}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function FeedbackWidget({ surveyId, questions, title, onComplete }: FeedbackWidgetProps) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [freetext, setFreetext] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [visible, setVisible] = useState(true)

  const isFollowUp = step === questions.length
  const isDone = step > questions.length
  const current = questions[step] as FeedbackQuestion | undefined

  const currentAnswer = current ? answers[current.id] : null

  const canProceed = current
    ? !current.required || (currentAnswer !== null && currentAnswer !== undefined && currentAnswer !== '')
    : true

  const setAnswer = useCallback((value: AnswerValue) => {
    if (!current) return
    setAnswers(prev => ({ ...prev, [current.id]: value }))
  }, [current])

  const handleNext = useCallback(() => {
    if (isFollowUp) {
      handleSubmit()
      return
    }
    setStep(s => s + 1)
  }, [isFollowUp, step])

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    try {
      const npsAnswer = questions.find(q => q.type === 'nps')
      const score = npsAnswer ? (answers[npsAnswer.id] as number | null) : null

      await fetch(`${window.location.origin}/api/feedback/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId,
          answers,
          score,
          freetext: freetext || undefined,
          path: window.location.pathname,
        }),
      })

      setSubmitted(true)
      setTimeout(() => {
        setVisible(false)
        onComplete?.()
      }, 2000)
    } catch {
      // Silently fail — don't block the user
      setSubmitted(true)
      setTimeout(() => {
        setVisible(false)
        onComplete?.()
      }, 2000)
    } finally {
      setSubmitting(false)
    }
  }, [surveyId, answers, freetext, questions, onComplete])

  if (!visible) return null

  if (submitted) {
    return (
      <div
        className="rounded-lg border p-6 text-center animate-in fade-in"
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
      {/* Header */}
      {title && (
        <div className="px-5 pt-4 pb-2">
          <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--ink-font-display)' }}>
            {title}
          </h3>
        </div>
      )}

      {/* Progress */}
      <div className="px-5 pt-2 pb-1">
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div
              key={i}
              className="h-0.5 flex-1 rounded-full transition-colors"
              style={{
                backgroundColor: i <= step ? 'var(--ink-primary)' : 'var(--ink-border)',
              }}
            />
          ))}
        </div>
        <span className="text-xs mt-1 block" style={{ color: 'var(--ink-dim)', fontFamily: 'var(--ink-font-mono)' }}>
          {Math.min(step + 1, questions.length)}/{questions.length}
        </span>
      </div>

      {/* Question */}
      <div className="px-5 py-4">
        {isFollowUp ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Anything else you'd like to share?</p>
            <textarea
              value={freetext}
              onChange={e => setFreetext(e.target.value.slice(0, 1000))}
              rows={3}
              className="w-full rounded border px-3 py-2 text-sm resize-none bg-[var(--ink-bg)] border-[var(--ink-border)] text-[var(--ink-text)] placeholder:text-[var(--ink-dim)] focus:outline-none"
              placeholder="Optional"
            />
          </div>
        ) : current ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">{current.text}</p>

            {current.type === 'nps' && (
              <NpsInput value={currentAnswer as number | null} onChange={setAnswer} />
            )}
            {current.type === 'rating' && (
              <RatingInput value={currentAnswer as number | null} onChange={setAnswer} />
            )}
            {current.type === 'choice' && current.options && (
              <ChoiceInput options={current.options} value={currentAnswer as string | null} onChange={setAnswer} />
            )}
            {current.type === 'text' && (
              <TextInput value={(currentAnswer as string) || ''} onChange={setAnswer} />
            )}
            {current.type === 'boolean' && (
              <BooleanInput value={currentAnswer as boolean | null} onChange={setAnswer} />
            )}
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="px-5 pb-4 flex justify-between items-center">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep(s => s - 1)}
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{ color: 'var(--ink-muted)' }}
          >
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceed || submitting}
          className={cn(
            'text-sm px-4 py-2 rounded font-medium transition-colors text-white disabled:opacity-50'
          )}
          style={{ backgroundColor: 'var(--ink-primary)' }}
        >
          {submitting ? 'Sending...' : isFollowUp ? 'Submit' : 'Next'}
        </button>
      </div>
    </div>
  )
}
