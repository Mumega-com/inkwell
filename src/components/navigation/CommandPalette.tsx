'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface CommandItem {
  title: string
  slug: string
  type: string
  url: string
}

interface CommandPaletteProps {
  items: CommandItem[]
}

export function CommandPalette({ items }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  const results = useMemo(() => {
    if (!query.trim()) return items.slice(0, 10)
    const lower = query.toLowerCase()
    return items
      .filter(
        (item) =>
          item.title.toLowerCase().includes(lower) ||
          item.type.toLowerCase().includes(lower)
      )
      .slice(0, 10)
  }, [items, query])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  const navigate = useCallback(
    (url: string) => {
      setOpen(false)
      window.location.href = url
    },
    []
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault()
        navigate(results[selectedIndex].url)
      }
    },
    [results, selectedIndex, navigate]
  )

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '20vh',
      }}
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '32rem',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          background: 'var(--ink-surface)',
          border: '1px solid var(--ink-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          placeholder="Search content..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: '14px',
            outline: 'none',
            background: 'transparent',
            color: 'var(--ink-text)',
            fontFamily: 'var(--ink-font-body)',
            borderBottom: '1px solid var(--ink-border)',
            border: 'none',
            borderBlockEnd: '1px solid var(--ink-border)',
            boxSizing: 'border-box',
          }}
        />

        {/* Results */}
        {results.length > 0 ? (
          <ul style={{ maxHeight: '320px', overflowY: 'auto', padding: '8px 0', margin: 0, listStyle: 'none' }}>
            {results.map((item, i) => (
              <li key={item.slug}>
                <button
                  onClick={() => navigate(item.url)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    background: i === selectedIndex ? 'var(--ink-surface-hover)' : 'transparent',
                    borderLeft: i === selectedIndex ? '2px solid var(--ink-primary)' : '2px solid transparent',
                    border: 'none',
                    borderInlineStart: i === selectedIndex ? '2px solid var(--ink-primary)' : '2px solid transparent',
                    boxSizing: 'border-box',
                  }}
                >
                  <span
                    style={{
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      flexShrink: 0,
                      background: 'var(--ink-primary-muted)',
                      color: 'var(--ink-primary)',
                      fontFamily: 'var(--ink-font-mono)',
                    }}
                  >
                    {item.type}
                  </span>
                  <span
                    style={{
                      fontSize: '14px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--ink-text)',
                      fontFamily: 'var(--ink-font-body)',
                    }}
                  >
                    {item.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--ink-text-muted)', margin: 0 }}>
              No results found.
            </p>
          </div>
        )}

        {/* Footer hint */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderTop: '1px solid var(--ink-border)',
            color: 'var(--ink-text-dim)',
            fontFamily: 'var(--ink-font-mono)',
          }}
        >
          <span>Navigate with arrow keys</span>
          <span>esc to close</span>
        </div>
      </div>
    </div>
  )
}
