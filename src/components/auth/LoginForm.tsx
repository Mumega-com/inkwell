'use client'

import { useState, type CSSProperties, type FormEvent } from 'react'

type Step = 'request' | 'verify' | 'done'

interface LoginFormProps {
  redirectTo?: string
}

// --- Styles ---

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: '2rem',
  background: 'var(--ink-bg)',
}

const cardStyle: CSSProperties = {
  background: 'var(--ink-surface)',
  border: '1px solid var(--ink-border)',
  borderRadius: '12px',
  padding: '2.5rem',
  width: '100%',
  maxWidth: '400px',
}

const headingStyle: CSSProperties = {
  color: 'var(--ink-text)',
  fontFamily: 'var(--ink-font-display)',
  fontSize: '1.5rem',
  fontWeight: 700,
  marginBottom: '0.375rem',
}

const subStyle: CSSProperties = {
  color: 'var(--ink-muted)',
  fontFamily: 'var(--ink-font-body)',
  fontSize: '0.875rem',
  marginBottom: '2rem',
}

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  marginBottom: '1.25rem',
}

const labelStyle: CSSProperties = {
  color: 'var(--ink-muted)',
  fontFamily: 'var(--ink-font-mono)',
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const inputStyle: CSSProperties = {
  background: 'var(--ink-bg)',
  border: '1px solid var(--ink-border)',
  borderRadius: '6px',
  color: 'var(--ink-text)',
  fontFamily: 'var(--ink-font-mono)',
  fontSize: '0.95rem',
  padding: '0.625rem 0.875rem',
  width: '100%',
  outline: 'none',
  transition: 'border-color 150ms ease',
}

const inputFocusStyle: CSSProperties = {
  ...inputStyle,
  borderColor: 'var(--ink-primary)',
}

const buttonStyle: CSSProperties = {
  background: 'var(--ink-primary)',
  border: 'none',
  borderRadius: '6px',
  color: 'var(--ink-bg)',
  cursor: 'pointer',
  fontFamily: 'var(--ink-font-mono)',
  fontSize: '0.875rem',
  fontWeight: 600,
  padding: '0.75rem 1.5rem',
  width: '100%',
  transition: 'opacity 150ms ease',
}

const buttonDisabledStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
}

const errorStyle: CSSProperties = {
  background: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: '6px',
  color: '#ef4444',
  fontFamily: 'var(--ink-font-mono)',
  fontSize: '0.8rem',
  marginBottom: '1rem',
  padding: '0.625rem 0.875rem',
}

const successStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.75rem',
  textAlign: 'center',
  padding: '1rem 0',
}

const codeInputStyle: CSSProperties = {
  ...inputStyle,
  fontSize: '1.5rem',
  letterSpacing: '0.4em',
  textAlign: 'center',
}

const backStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--ink-muted)',
  cursor: 'pointer',
  fontFamily: 'var(--ink-font-mono)',
  fontSize: '0.75rem',
  marginTop: '0.75rem',
  padding: 0,
  textDecoration: 'underline',
  width: '100%',
  textAlign: 'center',
}

// --- Component ---

export function LoginForm({ redirectTo = '/' }: LoginFormProps) {
  const [step, setStep] = useState<Step>('request')
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focusedInput, setFocusedInput] = useState<string | null>(null)

  async function handleRequestCode(e: FormEvent) {
    e.preventDefault()
    if (!identifier.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? 'Failed to send code')
      }

      setStep('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault()
    if (code.length !== 6) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), code: code.trim() }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? 'Invalid code')
      }

      setStep('done')
      setTimeout(() => {
        window.location.href = redirectTo
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const isEmail = identifier.includes('@')
  const identifierType = isEmail ? 'email' : 'phone'

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {step === 'request' && (
          <>
            <h1 style={headingStyle}>Sign in</h1>
            <p style={subStyle}>Enter your email or phone to receive a code.</p>

            {error && <div style={errorStyle}>{error}</div>}

            <form onSubmit={handleRequestCode} noValidate>
              <div style={fieldStyle}>
                <label htmlFor="identifier" style={labelStyle}>
                  Email or phone
                </label>
                <input
                  id="identifier"
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onFocus={() => setFocusedInput('identifier')}
                  onBlur={() => setFocusedInput(null)}
                  style={focusedInput === 'identifier' ? inputFocusStyle : inputStyle}
                  placeholder="you@example.com"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                style={loading || !identifier.trim() ? buttonDisabledStyle : buttonStyle}
                disabled={loading || !identifier.trim()}
              >
                {loading ? 'Sending...' : 'Send code'}
              </button>
            </form>
          </>
        )}

        {step === 'verify' && (
          <>
            <h1 style={headingStyle}>Enter code</h1>
            <p style={subStyle}>
              We sent a 6-digit code to your {identifierType}.
            </p>

            {error && <div style={errorStyle}>{error}</div>}

            <form onSubmit={handleVerifyCode} noValidate>
              <div style={fieldStyle}>
                <label htmlFor="code" style={labelStyle}>
                  6-digit code
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onFocus={() => setFocusedInput('code')}
                  onBlur={() => setFocusedInput(null)}
                  style={focusedInput === 'code' ? { ...codeInputStyle, borderColor: 'var(--ink-primary)' } : codeInputStyle}
                  placeholder="000000"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                style={loading || code.length !== 6 ? buttonDisabledStyle : buttonStyle}
                disabled={loading || code.length !== 6}
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </form>

            <button
              type="button"
              style={backStyle}
              onClick={() => {
                setStep('request')
                setCode('')
                setError(null)
              }}
            >
              Use a different address
            </button>
          </>
        )}

        {step === 'done' && (
          <div style={successStyle}>
            <span style={{ fontSize: '2rem' }}>✓</span>
            <p style={{ ...headingStyle, marginBottom: 0 }}>Signed in</p>
            <p style={subStyle}>Redirecting...</p>
          </div>
        )}
      </div>
    </div>
  )
}
