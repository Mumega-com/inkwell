'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ChatWidgetProps {
  slug?: string
  reference?: string
  workerUrl?: string
}

const MAX_HISTORY = 50

function getStorageKey(slug: string | undefined): string {
  return `inkwell-chat-${slug ?? 'default'}`
}

function loadHistory(slug: string | undefined): Message[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(getStorageKey(slug))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as Message[]
  } catch {
    return []
  }
}

function saveHistory(slug: string | undefined, messages: Message[]): void {
  if (typeof window === 'undefined') return
  try {
    const trimmed = messages.slice(-MAX_HISTORY)
    localStorage.setItem(getStorageKey(slug), JSON.stringify(trimmed))
  } catch {
    // storage quota or unavailable — silently ignore
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  button: {
    position: 'fixed' as const,
    bottom: '24px',
    right: '24px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'var(--ink-primary)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    zIndex: 9999,
    transition: 'transform 200ms ease, box-shadow 200ms ease',
    outline: 'none',
    flexShrink: 0,
  },
  panelBase: {
    position: 'fixed' as const,
    zIndex: 9999,
    background: 'var(--ink-surface)',
    border: '1px solid var(--ink-border)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    transition: 'opacity 200ms ease, transform 200ms ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid var(--ink-border)',
    flexShrink: 0,
  },
  headerTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--ink-text)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  headerDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#10B981',
    flexShrink: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--ink-muted)',
    padding: '4px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 200ms ease',
    outline: 'none',
    flexShrink: 0,
  },
  messages: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  userMsg: {
    alignSelf: 'flex-end' as const,
    background: 'var(--ink-primary)',
    color: '#0A0A10',
    borderRadius: '12px 12px 2px 12px',
    padding: '8px 12px',
    fontSize: '13px',
    lineHeight: '1.5',
    maxWidth: '80%',
    wordBreak: 'break-word' as const,
  },
  botMsg: {
    alignSelf: 'flex-start' as const,
    background: 'var(--ink-bg)',
    color: 'var(--ink-text)',
    borderRadius: '12px 12px 12px 2px',
    padding: '8px 12px',
    fontSize: '13px',
    lineHeight: '1.5',
    maxWidth: '80%',
    wordBreak: 'break-word' as const,
    border: '1px solid var(--ink-border)',
  },
  typingIndicator: {
    alignSelf: 'flex-start' as const,
    background: 'var(--ink-bg)',
    border: '1px solid var(--ink-border)',
    borderRadius: '12px 12px 12px 2px',
    padding: '10px 14px',
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
    padding: '12px',
    borderTop: '1px solid var(--ink-border)',
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    background: 'var(--ink-bg)',
    border: '1px solid var(--ink-border)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: 'var(--ink-text)',
    fontSize: '13px',
    outline: 'none',
    resize: 'none' as const,
    fontFamily: 'inherit',
    lineHeight: '1.5',
    maxHeight: '96px',
    overflowY: 'auto' as const,
    transition: 'border-color 200ms ease',
  },
  sendBtn: {
    background: 'var(--ink-primary)',
    border: 'none',
    borderRadius: '8px',
    width: '36px',
    height: '36px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 200ms ease',
    outline: 'none',
  },
}

// ── Typing dot animation via keyframes injected once ──────────────────────────

const KEYFRAME_ID = 'inkwell-chat-keyframes'

function ensureKeyframes(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(KEYFRAME_ID)) return
  const style = document.createElement('style')
  style.id = KEYFRAME_ID
  style.textContent = `
    @keyframes inkwellDotBounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-5px); opacity: 1; }
    }
    .inkwell-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--ink-muted);
      animation: inkwellDotBounce 1.2s ease infinite;
    }
    .inkwell-dot:nth-child(2) { animation-delay: 0.2s; }
    .inkwell-dot:nth-child(3) { animation-delay: 0.4s; }
    .inkwell-chat-btn:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,0.5) !important; }
    .inkwell-close-btn:hover { color: var(--ink-text) !important; }
    .inkwell-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .inkwell-send-btn:hover:not(:disabled) { opacity: 0.85; }
  `
  document.head.appendChild(style)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatWidget({ slug, reference, workerUrl = '' }: ChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const historyInitialized = useRef(false)

  // Inject keyframes once
  useEffect(() => {
    ensureKeyframes()
  }, [])

  // Responsive detection
  useEffect(() => {
    function check(): void {
      setIsMobile(window.innerWidth < 640)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Load history on mount
  useEffect(() => {
    if (historyInitialized.current) return
    historyInitialized.current = true
    const history = loadHistory(slug)
    if (history.length > 0) {
      setMessages(history)
    }
  }, [slug])

  // Persist history when messages change
  useEffect(() => {
    if (!historyInitialized.current) return
    saveHistory(slug, messages)
  }, [messages, slug])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const historyForApi = messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const endpoint = workerUrl ? `${workerUrl}/api/chat` : '/api/chat'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          reference: reference ?? undefined,
          history: historyForApi,
        }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      // res.json() returns unknown in DOM lib — cast after parse
      const data = await res.json() as { reply: string; timestamp: string }

      const botMsg: Message = {
        role: 'assistant',
        content: data.reply,
        timestamp: data.timestamp,
      }
      setMessages((prev) => [...prev, botMsg])
    } catch {
      const errMsg: Message = {
        role: 'assistant',
        content: "Sorry, I couldn't connect. Please try again or call 1-800-277-7570.",
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, reference, workerUrl])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  // Panel position/size based on viewport
  const panelStyle: React.CSSProperties = isMobile
    ? {
        ...styles.panelBase,
        bottom: 0,
        left: 0,
        right: 0,
        height: '70vh',
        borderRadius: '16px 16px 0 0',
        borderBottom: 'none',
        opacity: open ? 1 : 0,
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        pointerEvents: open ? 'auto' : 'none',
      }
    : {
        ...styles.panelBase,
        bottom: '96px',
        right: '16px',
        width: '380px',
        height: '500px',
        borderRadius: '16px',
        opacity: open ? 1 : 0,
        transform: open ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
        pointerEvents: open ? 'auto' : 'none',
        transformOrigin: 'bottom right',
      }

  return (
    <>
      {/* Floating button */}
      <button
        className="inkwell-chat-btn"
        style={styles.button}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        aria-expanded={open}
      >
        {open ? (
          // X icon when open
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 5L15 15M15 5L5 15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ) : (
          // Chat bubble icon
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path
              d="M11 2C6.03 2 2 5.58 2 10c0 1.92.74 3.68 1.97 5.07L2.5 18.5l3.87-1.24C7.63 17.73 9.27 18 11 18c4.97 0 9-3.58 9-8s-4.03-8-9-8z"
              fill="white"
            />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      <div role="dialog" aria-label="Viamar Assistant chat" aria-modal="true" style={panelStyle}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>
            <span style={styles.headerDot} aria-hidden="true" />
            Viamar Assistant
          </h2>
          <button
            className="inkwell-close-btn"
            style={styles.closeBtn}
            onClick={() => setOpen(false)}
            aria-label="Close chat"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div style={styles.messages} role="log" aria-live="polite" aria-label="Chat messages">
          {messages.length === 0 && (
            <div
              style={{
                color: 'var(--ink-muted)',
                fontSize: '13px',
                textAlign: 'center',
                marginTop: '24px',
                lineHeight: '1.6',
              }}
            >
              Hi! I'm the Viamar Assistant.
              <br />
              Ask me about shipping quotes, documents, transit times, or insurance.
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={msg.role === 'user' ? styles.userMsg : styles.botMsg}
              aria-label={msg.role === 'user' ? 'Your message' : 'Assistant message'}
            >
              {msg.content}
            </div>
          ))}

          {loading && (
            <div style={styles.typingIndicator} aria-label="Assistant is typing">
              <div className="inkwell-dot" />
              <div className="inkwell-dot" />
              <div className="inkwell-dot" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input row */}
        <div style={styles.inputRow}>
          <textarea
            ref={inputRef}
            style={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            rows={1}
            disabled={loading}
            aria-label="Chat input"
          />
          <button
            className="inkwell-send-btn"
            style={styles.sendBtn}
            onClick={() => void sendMessage()}
            disabled={loading || input.trim().length === 0}
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M14 2L7 9M14 2L9.5 14L7 9L2 6.5L14 2Z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}
