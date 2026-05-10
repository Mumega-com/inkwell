import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '../../../src/components/ui/card'
import { Badge } from '../../../src/components/ui/badge'
import { Button } from '../../../src/components/ui/button'
import { Input } from '../../../src/components/ui/input'
import { Textarea } from '../../../src/components/ui/textarea'
import { Separator } from '../../../src/components/ui/separator'

interface MemoryEntry {
  id: string
  text: string
  agent: string
  timestamp: string // ISO string
  project: string
}

interface MemoryResponse {
  memories: MemoryEntry[]
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`
}

function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = typeof window !== 'undefined' ? (localStorage.getItem('mumega_auth_token') ?? '') : ''
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
}

export function SquadMemoryPanel({ squadId }: { squadId: string }) {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)

  const isManagerOrAbove = (() => {
    if (typeof window === 'undefined') return false
    const role = localStorage.getItem('mumega_user_role') ?? 'viewer'
    return ['manager', 'admin', 'owner'].includes(role)
  })()

  const apiUrl = typeof window !== 'undefined' ? (localStorage.getItem('mumega_api_url') ?? '') : ''

  const fetchMemory = useCallback(
    async (q: string) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ limit: '20' })
        if (q.trim()) params.set('q', q.trim())
        const res = await apiFetch(`${apiUrl}/api/squads/${squadId}/memory?${params}`)
        if (!res.ok) throw new Error(`${res.status}`)
        const data = (await res.json()) as MemoryResponse
        setEntries(Array.isArray(data.memories) ? data.memories : [])
      } catch {
        setError('Failed to load squad memory.')
        setEntries([])
      } finally {
        setLoading(false)
      }
    },
    [apiUrl, squadId],
  )

  useEffect(() => {
    void fetchMemory('')
  }, [fetchMemory])

  function handleSearch() {
    void fetchMemory(query)
  }

  function handleQueryKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSearch()
    if (e.key === 'Escape' && query) {
      setQuery('')
      void fetchMemory('')
    }
  }

  async function handleSave() {
    if (!noteText.trim()) return
    setSaving(true)
    try {
      const res = await apiFetch(`${apiUrl}/api/squads/${squadId}/memory`, {
        method: 'POST',
        body: JSON.stringify({ text: noteText.trim() }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      setNoteText('')
      setShowAdd(false)
      void fetchMemory(query)
    } catch {
      // Keep the textarea open so the user can retry
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        paddingTop: '1.5rem',
      }}
    >
      {/* Section heading */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <h2
          style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--ink-muted)',
          }}
        >
          Squad Memory
        </h2>
        {isManagerOrAbove && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAdd((v) => !v)}
            style={{ fontSize: '0.78rem' }}
          >
            {showAdd ? 'Cancel' : 'Add note'}
          </Button>
        )}
      </div>

      <Separator />

      {/* Search bar */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Input
          placeholder="Search memory…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleQueryKeyDown}
          style={{ flex: 1 }}
        />
        <Button size="sm" variant="secondary" onClick={handleSearch}>
          Search
        </Button>
        {query && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setQuery('')
              void fetchMemory('')
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Add note inline form */}
      {showAdd && isManagerOrAbove && (
        <Card>
          <CardContent style={{ paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Textarea
              placeholder="Write a note for this squad…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              style={{ resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNoteText('')
                  setShowAdd(false)
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={saving || !noteText.trim()}
                onClick={() => void handleSave()}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && (
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', padding: '2rem 0' }}>
          Loading memory…
        </p>
      )}

      {/* Error state */}
      {!loading && error && (
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', padding: '2rem 0' }}>
          {error}
        </p>
      )}

      {/* Empty state */}
      {!loading && !error && entries.length === 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', padding: '2rem 0' }}>
          No squad memory yet.
        </p>
      )}

      {/* Memory timeline */}
      {!loading && !error && entries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardContent
                style={{
                  paddingTop: '0.875rem',
                  paddingBottom: '0.875rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {/* Header row: agent badge + timestamp */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: 'var(--ink-secondary)',
                      color: 'var(--ink-secondary)',
                      background: 'transparent',
                      fontSize: '0.68rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {entry.agent}
                  </Badge>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--ink-muted)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {relativeTime(entry.timestamp)}
                  </span>
                </div>
                {/* Text content */}
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--ink-text)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {entry.text}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
