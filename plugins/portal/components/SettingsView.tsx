import { useState } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  config: Record<string, unknown>
  onConfigUpdate: (updated: Record<string, unknown>) => void
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

function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsView({ config, onConfigUpdate }: Props) {
  const initialBrandName = typeof config.brandName === 'string' ? config.brandName : ''
  const initialAccentColor =
    typeof config.accentColor === 'string' && isValidHex(config.accentColor)
      ? config.accentColor
      : '#D4A017'

  const [brandName, setBrandName] = useState(initialBrandName)
  const [accentColor, setAccentColor] = useState(initialAccentColor)
  const [hexInput, setHexInput] = useState(initialAccentColor)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleColorPickerChange(value: string) {
    setAccentColor(value)
    setHexInput(value)
  }

  function handleHexInputChange(value: string) {
    setHexInput(value)
    if (isValidHex(value)) {
      setAccentColor(value)
    }
  }

  function handleHexInputBlur() {
    if (!isValidHex(hexInput)) {
      // Revert hex text box to last valid value
      setHexInput(accentColor)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)

    const trimmedName = brandName.trim()
    if (!trimmedName) {
      setError('Portal name cannot be empty.')
      return
    }
    if (!isValidHex(accentColor)) {
      setError('Accent color must be a valid hex color (e.g. #D4A017).')
      return
    }

    setSaving(true)
    try {
      const res = await apiFetch('/api/portal/config', {
        method: 'PUT',
        body: JSON.stringify({ brandName: trimmedName, accentColor }),
      })

      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setError(body.error ?? `Request failed (${res.status})`)
        return
      }

      const data = await res.json() as { config?: { brandName?: string; accentColor?: string } }
      const newConfig = {
        ...config,
        brandName: data.config?.brandName ?? trimmedName,
        accentColor: data.config?.accentColor ?? accentColor,
      }
      onConfigUpdate(newConfig)
      setSaved(true)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '24px 16px 16px' }}>
      <h2
        style={{
          fontSize: '16px',
          fontWeight: '600',
          color: 'var(--ink-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          margin: '0 0 24px',
        }}
      >
        Settings
      </h2>

      <form onSubmit={handleSubmit} noValidate>
        {/* Portal Name */}
        <div style={{ marginBottom: '20px' }}>
          <label
            htmlFor="settings-brand-name"
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--ink-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: '8px',
            }}
          >
            Portal Name
          </label>
          <input
            id="settings-brand-name"
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            maxLength={80}
            placeholder="My Business Portal"
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'var(--ink-surface)',
              border: '1px solid var(--ink-border)',
              borderRadius: '8px',
              color: 'var(--ink-text)',
              fontSize: '15px',
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'system-ui, sans-serif',
            }}
          />
        </div>

        {/* Accent Color */}
        <div style={{ marginBottom: '28px' }}>
          <label
            htmlFor="settings-hex-input"
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--ink-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: '8px',
            }}
          >
            Accent Color
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Color swatch / native color picker */}
            <div
              style={{
                position: 'relative',
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                border: '1px solid var(--ink-border)',
                background: accentColor,
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              <input
                type="color"
                value={accentColor}
                onChange={(e) => handleColorPickerChange(e.target.value)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                  border: 'none',
                  padding: 0,
                }}
                aria-label="Pick accent color"
              />
            </div>
            {/* Hex text input */}
            <input
              id="settings-hex-input"
              type="text"
              value={hexInput}
              onChange={(e) => handleHexInputChange(e.target.value)}
              onBlur={handleHexInputBlur}
              maxLength={7}
              placeholder="#D4A017"
              style={{
                flex: 1,
                padding: '10px 14px',
                background: 'var(--ink-surface)',
                border: '1px solid var(--ink-border)',
                borderRadius: '8px',
                color: 'var(--ink-text)',
                fontSize: '15px',
                fontFamily: 'monospace',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Live preview strip */}
          <div
            style={{
              marginTop: '12px',
              height: '6px',
              borderRadius: '3px',
              background: isValidHex(accentColor) ? accentColor : 'var(--ink-border)',
              transition: 'background 0.15s',
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#f87171',
            }}
          >
            {error}
          </div>
        )}

        {/* Success */}
        {saved && !error && (
          <div
            style={{
              background: 'rgba(74,222,128,0.1)',
              border: '1px solid rgba(74,222,128,0.3)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#4ade80',
            }}
          >
            Settings saved.
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          style={{
            width: '100%',
            padding: '13px',
            background: saving ? 'var(--ink-border)' : 'var(--ink-primary)',
            border: 'none',
            borderRadius: '10px',
            color: saving ? 'var(--ink-muted)' : '#0A0A10',
            fontSize: '15px',
            fontWeight: '700',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'system-ui, sans-serif',
            transition: 'opacity 0.15s',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
