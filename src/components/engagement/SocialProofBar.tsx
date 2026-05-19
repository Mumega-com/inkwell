'use client'

import { useEffect, useState } from 'react'

interface StatsResponse {
  slug: string
  views: number
  avg_scroll_depth: number
  reactions: Record<string, number>
}

interface SocialProofBarProps {
  slug: string
  apiUrl?: string
}

export function SocialProofBar({
  slug,
  apiUrl,
}: SocialProofBarProps) {
  const [stats, setStats] = useState<StatsResponse | null>(null)

  useEffect(() => {
    if (!apiUrl) return

    const controller = new AbortController()

    fetch(`${apiUrl}/api/stats/${encodeURIComponent(slug)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<StatsResponse>
      })
      .then(setStats)
      .catch(() => {
        // Graceful degradation — show nothing on failure
      })

    return () => controller.abort()
  }, [slug, apiUrl])

  if (!stats) return null

  const reactionsTotal = Object.values(stats.reactions).reduce(
    (sum, count) => sum + count,
    0
  )

  if (stats.views === 0 && reactionsTotal === 0) return null

  const parts: string[] = []
  if (stats.views > 0) parts.push(`${stats.views} views`)
  if (reactionsTotal > 0) parts.push(`${reactionsTotal} reactions`)

  return (
    <span
      style={{
        fontFamily: 'var(--ink-font-mono)',
        fontSize: '0.75rem',
        color: 'var(--ink-muted)',
        letterSpacing: '0.01em',
      }}
    >
      {parts.join(' \u00b7 ')}
    </span>
  )
}
