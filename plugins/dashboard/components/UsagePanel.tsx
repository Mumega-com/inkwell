import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../src/components/ui/card'
import { Progress } from '../../../src/components/ui/progress'
import { cn } from '../../../src/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UsageData {
  period: string
  api_calls: number
  api_calls_limit: number
  storage_bytes: number
  storage_limit_bytes: number
  ai_tokens: number
  ai_tokens_limit: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiBase(): string {
  if (typeof window === 'undefined') return ''
  return (localStorage.getItem('mumega_api_url') ?? window.location.origin)
}

function getAuthToken(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('mumega_auth_token') ?? ''
}

function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getApiBase()
  const token = getAuthToken()
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
    return r.json() as Promise<T>
  })
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`
  return `${bytes} B`
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function pct(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

type UsageState = 'normal' | 'warning' | 'danger'

function usageState(percent: number): UsageState {
  if (percent >= 95) return 'danger'
  if (percent >= 80) return 'warning'
  return 'normal'
}

// ---------------------------------------------------------------------------
// UsageBar sub-component
// ---------------------------------------------------------------------------

interface UsageBarProps {
  label: string
  used: string
  limit: string
  percent: number
  loading: boolean
}

function UsageBar({ label, used, limit, percent, loading }: UsageBarProps) {
  const state = usageState(percent)

  const progressClass = cn({
    '[&>div]:bg-emerald-500': state === 'normal',
    '[&>div]:bg-amber-500': state === 'warning',
    '[&>div]:bg-red-500': state === 'danger',
  })

  const percentClass = cn('font-mono text-xs font-semibold', {
    'text-emerald-500': state === 'normal',
    'text-amber-500': state === 'warning',
    'text-red-500': state === 'danger',
  })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {!loading && (
          <span className={percentClass}>{percent}%</span>
        )}
      </div>

      {loading ? (
        <div className="h-2 w-full rounded-full bg-border opacity-50" />
      ) : (
        <Progress value={percent} className={cn('h-2', progressClass)} />
      )}

      {!loading && (
        <p className="text-xs text-muted-foreground">
          {used} <span className="text-muted-foreground/50">of</span> {limit}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UsagePanel() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('mumega_auth_token') : null
    if (!token) {
      setError('Not authenticated. Please log in.')
      setLoading(false)
      return
    }

    apiFetch<UsageData>('/api/usage')
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load usage data.')
        setLoading(false)
      })
  }, [])

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </Card>
    )
  }

  const apiPct = data ? pct(data.api_calls, data.api_calls_limit) : 0
  const storagePct = data ? pct(data.storage_bytes, data.storage_limit_bytes) : 0
  const tokensPct = data ? pct(data.ai_tokens, data.ai_tokens_limit) : 0

  return (
    <div className="flex flex-col gap-7">
      {/* Period header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
          Usage
        </h2>
        {!loading && data && (
          <span className="font-mono text-xs text-muted-foreground">{data.period}</span>
        )}
      </div>

      {/* Usage bars */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">API Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <UsageBar
            label="API Calls"
            used={data ? formatNum(data.api_calls) : '—'}
            limit={data ? formatNum(data.api_calls_limit) : '—'}
            percent={apiPct}
            loading={loading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Storage</CardTitle>
        </CardHeader>
        <CardContent>
          <UsageBar
            label="Storage"
            used={data ? formatBytes(data.storage_bytes) : '—'}
            limit={data ? formatBytes(data.storage_limit_bytes) : '—'}
            percent={storagePct}
            loading={loading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">AI Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <UsageBar
            label="AI Tokens"
            used={data ? formatNum(data.ai_tokens) : '—'}
            limit={data ? formatNum(data.ai_tokens_limit) : '—'}
            percent={tokensPct}
            loading={loading}
          />
        </CardContent>
      </Card>
    </div>
  )
}
