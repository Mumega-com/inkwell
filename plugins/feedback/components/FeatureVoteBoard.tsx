import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../src/components/ui/card'
import { Button } from '../../../src/components/ui/button'
import { Badge } from '../../../src/components/ui/badge'
import { cn } from '../../../src/lib/utils'
import { config } from '../../../src/lib/config'

interface FeatureRequest {
  id: string
  title: string
  description: string
  votes: number
  status: 'open' | 'planned' | 'shipped' | 'declined'
  created_at: string
}

interface FeatureVoteBoardProps {
  showSubmitForm?: boolean
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  open: 'outline',
  planned: 'secondary',
  shipped: 'default',
  declined: 'destructive',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  planned: 'Planned',
  shipped: 'Shipped',
  declined: 'Declined',
}

export function FeatureVoteBoard({ showSubmitForm = false }: FeatureVoteBoardProps) {
  const [features, setFeatures] = useState<FeatureRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [votingId, setVotingId] = useState<string | null>(null)

  // Submit form state
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const getAuth = useCallback(() => {
    const prefix = config.network.storageKeyPrefix
    const apiUrl = localStorage.getItem(`${prefix}_api_url`) || ''
    const token = localStorage.getItem(`${prefix}_auth_token`) || ''
    return { apiUrl, token }
  }, [])

  // Load voted IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('feature_votes')
      if (stored) {
        setVotedIds(new Set(JSON.parse(stored) as string[]))
      }
    } catch {
      // Ignore parse errors
    }
  }, [])

  // Fetch features
  useEffect(() => {
    const { apiUrl, token } = getAuth()
    if (!apiUrl || !token) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    fetch(`${apiUrl}/api/feedback/features`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load features')
        return r.json()
      })
      .then((data: FeatureRequest[]) => {
        const sorted = data.sort((a, b) => b.votes - a.votes)
        setFeatures(sorted)
        setLoading(false)
      })
      .catch(e => {
        setError(e instanceof Error ? e.message : 'Failed to load')
        setLoading(false)
      })
  }, [getAuth])

  const persistVotes = useCallback((ids: Set<string>) => {
    try {
      localStorage.setItem('feature_votes', JSON.stringify([...ids]))
    } catch {
      // localStorage full or unavailable
    }
  }, [])

  const handleVote = useCallback(async (featureId: string) => {
    if (votedIds.has(featureId) || votingId) return

    setVotingId(featureId)
    const { apiUrl, token } = getAuth()

    try {
      const res = await fetch(`${apiUrl}/api/feedback/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ featureId }),
      })

      if (!res.ok) throw new Error('Vote failed')

      // Optimistic update
      setFeatures(prev =>
        prev
          .map(f => f.id === featureId ? { ...f, votes: f.votes + 1 } : f)
          .sort((a, b) => b.votes - a.votes)
      )

      const updated = new Set(votedIds)
      updated.add(featureId)
      setVotedIds(updated)
      persistVotes(updated)
    } catch {
      // Silently fail
    } finally {
      setVotingId(null)
    }
  }, [votedIds, votingId, getAuth, persistVotes])

  const handleSubmitFeature = useCallback(async () => {
    if (!newTitle.trim() || submitting) return

    setSubmitting(true)
    const { apiUrl, token } = getAuth()

    try {
      const res = await fetch(`${apiUrl}/api/feedback/features`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
        }),
      })

      if (!res.ok) throw new Error('Submit failed')

      const created = (await res.json()) as FeatureRequest
      setFeatures(prev => [created, ...prev].sort((a, b) => b.votes - a.votes))
      setNewTitle('')
      setNewDescription('')
      setShowForm(false)
    } catch {
      // Silently fail
    } finally {
      setSubmitting(false)
    }
  }, [newTitle, newDescription, submitting, getAuth])

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Submit form */}
      {showSubmitForm && (
        <Card>
          <CardHeader className="pb-3 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Feature Requests</CardTitle>
              {!showForm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForm(true)}
                  className="text-xs"
                >
                  + Suggest a feature
                </Button>
              )}
            </div>
          </CardHeader>
          {showForm && (
            <CardContent className="px-5 pb-5 pt-0">
              <div className="flex flex-col gap-3 border rounded-lg p-4" style={{ borderColor: 'var(--ink-border)' }}>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value.slice(0, 120))}
                  placeholder="Feature title"
                  className="w-full rounded border px-3 py-2 text-sm bg-background border-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="Describe the feature... (optional)"
                  className="w-full rounded border px-3 py-2 text-sm resize-none bg-background border-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowForm(false); setNewTitle(''); setNewDescription('') }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!newTitle.trim() || submitting}
                    onClick={handleSubmitFeature}
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Feature list */}
      <Card>
        {!showSubmitForm && (
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="text-sm font-semibold">Feature Requests</CardTitle>
          </CardHeader>
        )}
        <CardContent className={cn('p-0', showSubmitForm && 'pt-0')}>
          {loading ? (
            <div className="px-5 py-8 flex flex-col gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : features.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">
              No feature requests yet. Be the first to suggest one.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {features.map(feature => {
                const hasVoted = votedIds.has(feature.id)
                const isVoting = votingId === feature.id

                return (
                  <div key={feature.id} className="flex items-start gap-4 px-5 py-4">
                    {/* Vote button */}
                    <button
                      type="button"
                      onClick={() => handleVote(feature.id)}
                      disabled={hasVoted || isVoting}
                      className={cn(
                        'flex flex-col items-center gap-0.5 min-w-[48px] py-2 px-2 rounded border transition-colors',
                        hasVoted
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border hover:border-primary/40 hover:bg-primary/5'
                      )}
                    >
                      <svg
                        width="12"
                        height="8"
                        viewBox="0 0 12 8"
                        fill="none"
                        className={cn(
                          'transition-colors',
                          hasVoted ? 'text-primary' : 'text-muted-foreground'
                        )}
                      >
                        <path d="M6 0L11.196 7.5H0.804L6 0Z" fill="currentColor" />
                      </svg>
                      <span
                        className={cn(
                          'text-lg font-bold font-mono leading-none',
                          hasVoted ? 'text-primary' : 'text-foreground'
                        )}
                      >
                        {feature.votes}
                      </span>
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium truncate">{feature.title}</span>
                        <Badge variant={STATUS_VARIANT[feature.status] ?? 'outline'} className="text-xs shrink-0">
                          {STATUS_LABEL[feature.status] ?? feature.status}
                        </Badge>
                      </div>
                      {feature.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {feature.description}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
