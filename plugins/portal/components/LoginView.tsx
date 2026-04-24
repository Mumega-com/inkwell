import { useState, useRef } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  navigate: (path: string) => void
}

type Step = 'request' | 'verify'

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

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  outer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    background: 'var(--ink-bg)',
  } satisfies React.CSSProperties,

  card: {
    width: '100%',
    maxWidth: '400px',
    background: 'var(--ink-surface)',
    border: '1px solid var(--ink-border)',
    borderRadius: '12px',
    padding: '32px 24px',
  } satisfies React.CSSProperties,

  logo: {
    textAlign: 'center' as const,
    marginBottom: '28px',
  },

  logoText: {
    fontSize: '22px',
    fontWeight: '700',
    color: 'var(--ink-primary)',
    letterSpacing: '-0.5px',
  },

  heading: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--ink-text)',
    marginBottom: '6px',
  },

  subtext: {
    fontSize: '14px',
    color: 'var(--ink-muted)',
    marginBottom: '24px',
  },

  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--ink-muted)',
    marginBottom: '6px',
  },

  input: {
    width: '100%',
    background: 'var(--ink-bg)',
    border: '1px solid var(--ink-border)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '15px',
    color: 'var(--ink-text)',
    outline: 'none',
    boxSizing: 'border-box' as const,
    marginBottom: '16px',
  },

  button: {
    width: '100%',
    background: 'var(--ink-primary)',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '4px',
  },

  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed' as const,
  },

  error: {
    background: 'rgba(220,38,38,0.12)',
    border: '1px solid rgba(220,38,38,0.3)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '13px',
    color: '#f87171',
    marginBottom: '16px',
  },

  resend: {
    display: 'block',
    textAlign: 'center' as const,
    marginTop: '16px',
    fontSize: '13px',
    color: 'var(--ink-muted)',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: '0',
    textDecoration: 'underline',
  },

  fieldGroup: {
    marginBottom: '0',
  },
} satisfies Record<string, React.CSSProperties | Record<string, unknown>>

// ── Component ─────────────────────────────────────────────────────────────────

export default function LoginView({ navigate }: Props) {
  const [step, setStep] = useState<Step>('request')
  const [slug, setSlug] = useState('')
  const [contact, setContact] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const otpRef = useRef<HTMLInputElement>(null)

  const canRequest = slug.trim().length > 0 && contact.trim().length > 0
  const canVerify = otp.trim().length === 6

  async function handleRequestCode() {
    if (!canRequest) return
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/api/portal/auth/request-code', {
        method: 'POST',
        body: JSON.stringify({ slug: slug.trim(), contact: contact.trim() }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'Failed to send code. Check your slug and contact.')
        return
      }
      setStep('verify')
      setTimeout(() => otpRef.current?.focus(), 100)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify() {
    if (!canVerify) return
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/api/portal/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ slug: slug.trim(), contact: contact.trim(), code: otp.trim() }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'Invalid code. Please try again.')
        return
      }
      navigate(`/portal/${slug.trim()}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setOtp('')
    setError('')
    setStep('request')
  }

  return (
    <div style={styles.outer}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <span style={styles.logoText}>Mumega Portal</span>
        </div>

        {step === 'request' ? (
          <>
            <div style={styles.heading}>Sign in</div>
            <div style={styles.subtext}>Enter your business slug and we'll send you a code.</div>

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="slug-input">
                Business slug
              </label>
              <input
                id="slug-input"
                style={styles.input}
                type="text"
                placeholder="your-business"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRequestCode()}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />

              <label style={styles.label} htmlFor="contact-input">
                Email or phone
              </label>
              <input
                id="contact-input"
                style={styles.input}
                type="text"
                placeholder="you@example.com or +1 416 555 0100"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRequestCode()}
                autoComplete="email"
              />
            </div>

            <button
              style={{
                ...styles.button,
                ...(loading || !canRequest ? styles.buttonDisabled : {}),
              }}
              onClick={handleRequestCode}
              disabled={loading || !canRequest}
            >
              {loading ? 'Sending…' : 'Get code'}
            </button>
          </>
        ) : (
          <>
            <div style={styles.heading}>Check your messages</div>
            <div style={styles.subtext}>
              We sent a 6-digit code to <strong style={{ color: 'var(--ink-text)' }}>{contact}</strong>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <label style={styles.label} htmlFor="otp-input">
              Verification code
            </label>
            <input
              ref={otpRef}
              id="otp-input"
              style={{
                ...styles.input,
                fontSize: '24px',
                letterSpacing: '8px',
                textAlign: 'center',
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              autoComplete="one-time-code"
            />

            <button
              style={{
                ...styles.button,
                ...(loading || !canVerify ? styles.buttonDisabled : {}),
              }}
              onClick={handleVerify}
              disabled={loading || !canVerify}
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>

            <button style={styles.resend} onClick={handleResend}>
              Resend code
            </button>
          </>
        )}
      </div>
    </div>
  )
}
