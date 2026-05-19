'use client'

import { useCallback, useEffect, useState } from 'react'

interface ReactionState {
  [emoji: string]: number
}

interface ReactionsProps {
  slug: string
  apiUrl?: string
}

const EMOJIS = ['\uD83D\uDD25', '\u2764\uFE0F', '\uD83E\uDDE0', '\uD83D\uDC4F', '\uD83D\uDE80'] as const
const MAX_TAPS = 5
const STORAGE_PREFIX = 'ink-reactions-'

function getStorageKey(slug: string): string {
  return `${STORAGE_PREFIX}${slug}`
}

function getLocalReactions(slug: string): ReactionState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(getStorageKey(slug))
    return raw ? (JSON.parse(raw) as ReactionState) : {}
  } catch {
    return {}
  }
}

function setLocalReactions(slug: string, state: ReactionState) {
  try {
    localStorage.setItem(getStorageKey(slug), JSON.stringify(state))
  } catch {
    // Storage full or unavailable
  }
}

export function Reactions({ slug, apiUrl = '/api/reaction' }: ReactionsProps) {
  const [counts, setCounts] = useState<ReactionState>({})
  const [userCounts, setUserCounts] = useState<ReactionState>({})
  const [animating, setAnimating] = useState<string | null>(null)

  useEffect(() => {
    setUserCounts(getLocalReactions(slug))
  }, [slug])

  const react = useCallback(
    async (emoji: string) => {
      const current = userCounts[emoji] ?? 0
      if (current >= MAX_TAPS) return

      const next = current + 1
      const newUserCounts = { ...userCounts, [emoji]: next }
      setUserCounts(newUserCounts)
      setLocalReactions(slug, newUserCounts)

      setCounts((prev) => ({ ...prev, [emoji]: (prev[emoji] ?? 0) + 1 }))

      setAnimating(emoji)
      setTimeout(() => setAnimating(null), 300)

      try {
        await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, emoji }),
        })
      } catch {
        // Fire and forget — local state is source of truth for the visitor
      }
    },
    [slug, apiUrl, userCounts]
  )

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '16px 0',
      }}
    >
      {EMOJIS.map((emoji) => {
        const count = counts[emoji] ?? 0
        const userCount = userCounts[emoji] ?? 0
        const maxed = userCount >= MAX_TAPS

        return (
          <button
            key={emoji}
            onClick={() => react(emoji)}
            disabled={maxed}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '9999px',
              fontSize: '14px',
              transition: 'all 200ms ease',
              cursor: maxed ? 'default' : 'pointer',
              opacity: maxed ? 0.5 : 1,
              background: userCount > 0 ? 'var(--ink-primary-muted)' : 'var(--ink-surface)',
              border: `1px solid ${userCount > 0 ? 'var(--ink-primary)' : 'var(--ink-border)'}`,
              transform: animating === emoji ? 'scale(1.15)' : 'scale(1)',
            }}
          >
            <span style={{ fontSize: '16px' }}>{emoji}</span>
            {count > 0 && (
              <span
                style={{
                  color: userCount > 0 ? 'var(--ink-primary)' : 'var(--ink-text-muted)',
                  fontFamily: 'var(--ink-font-mono)',
                  fontSize: '12px',
                }}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
