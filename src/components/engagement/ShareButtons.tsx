'use client'

import { useCallback, useState } from 'react'

interface ShareButtonsProps {
  url: string
  title: string
}

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available
    }
  }, [url])

  const shareTwitter = useCallback(() => {
    const params = new URLSearchParams({ text: title, url })
    window.open(`https://x.com/intent/tweet?${params.toString()}`, '_blank', 'noopener')
  }, [url, title])

  const shareLinkedIn = useCallback(() => {
    const params = new URLSearchParams({ url })
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`,
      '_blank',
      'noopener'
    )
  }, [url])

  const buttonBase: React.CSSProperties = {
    color: 'var(--ink-text-dim)',
    fontFamily: 'var(--ink-font-mono)',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '4px 10px',
    borderRadius: '4px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'color 200ms ease',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span
        style={{
          fontSize: '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginRight: '4px',
          color: 'var(--ink-text-dim)',
          fontFamily: 'var(--ink-font-mono)',
        }}
      >
        Share
      </span>

      <button onClick={copyLink} style={buttonBase}>
        {copied ? 'Copied!' : 'Copy Link'}
      </button>

      <button onClick={shareTwitter} style={buttonBase}>
        X
      </button>

      <button onClick={shareLinkedIn} style={buttonBase}>
        LinkedIn
      </button>
    </div>
  )
}
