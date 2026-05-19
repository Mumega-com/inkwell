'use client'

import { type FormEvent, useCallback, useState } from 'react'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface NewsletterCTAProps {
  apiUrl?: string
}

export function NewsletterCTA({ apiUrl = '/api/subscribe' }: NewsletterCTAProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!email.trim() || status === 'loading') return

      setStatus('loading')
      setErrorMsg('')

      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(data.error ?? 'Subscribe failed')
        }

        setStatus('success')
        setEmail('')
      } catch (err) {
        setStatus('error')
        setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      }
    },
    [email, status, apiUrl]
  )

  if (status === 'success') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          borderRadius: '8px',
          textAlign: 'center',
          background: 'var(--ink-surface)',
          border: '1px solid var(--ink-primary)',
        }}
      >
        <p
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--ink-primary)',
            fontFamily: 'var(--ink-font-display)',
            margin: 0,
          }}
        >
          You&apos;re in!
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '20px',
        borderRadius: '8px',
        background: 'var(--ink-surface)',
        border: '1px solid var(--ink-border)',
      }}
    >
      <input
        type="email"
        required
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          flex: '1 1 200px',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '14px',
          outline: 'none',
          transition: 'border-color 200ms ease',
          background: 'var(--ink-bg)',
          border: '1px solid var(--ink-border)',
          color: 'var(--ink-text)',
          fontFamily: 'var(--ink-font-body)',
        }}
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        style={{
          padding: '8px 20px',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: status === 'loading' ? 'default' : 'pointer',
          opacity: status === 'loading' ? 0.5 : 1,
          transition: 'opacity 200ms ease',
          background: 'var(--ink-primary)',
          color: 'var(--ink-bg)',
          fontFamily: 'var(--ink-font-mono)',
          border: 'none',
        }}
      >
        {status === 'loading' ? '...' : 'Subscribe'}
      </button>
      {status === 'error' && (
        <p style={{ fontSize: '12px', color: 'var(--ink-danger)', margin: 0, alignSelf: 'center' }}>
          {errorMsg}
        </p>
      )}
    </form>
  )
}
