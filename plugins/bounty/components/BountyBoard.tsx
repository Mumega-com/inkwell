import { useState, useEffect, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BountyStatus = 'open' | 'claimed' | 'submitted' | 'approved' | 'paid'

interface Bounty {
  id: string
  title: string
  description: string | null
  reward_cents: number
  currency: string
  status: BountyStatus
  creator_id: string
  claimant_id: string | null
  proof_url: string | null
  squad_id: string | null
  labels_json: string
  expires_at: string | null
  created_at: string
  updated_at: string
}

interface Stats {
  open_count: number
  open_reward_cents: number
  total_reward_cents: number
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

function formatReward(cents: number, currency: string): string {
  const amount = (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return amount
}

const STATUS_LABEL: Record<BountyStatus, string> = {
  open: 'Open',
  claimed: 'Claimed',
  submitted: 'Under Review',
  approved: 'Approved',
  paid: 'Paid',
}

const STATUS_COLOR: Record<BountyStatus, string> = {
  open: 'var(--ink-accent)',
  claimed: 'var(--ink-secondary)',
  submitted: 'var(--ink-primary)',
  approved: 'var(--ink-accent)',
  paid: 'var(--ink-muted)',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: BountyStatus }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.7rem',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: STATUS_COLOR[status],
        border: `1px solid ${STATUS_COLOR[status]}`,
        opacity: 0.9,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function BountyCard({
  bounty,
  onClaim,
  onSubmitProof,
  isMine,
  claiming,
}: {
  bounty: Bounty
  onClaim?: (id: string) => void
  onSubmitProof?: (id: string, proofUrl: string) => void
  isMine?: boolean
  claiming?: boolean
}) {
  const [proofUrl, setProofUrl] = useState('')
  const [showProofForm, setShowProofForm] = useState(false)

  const labels: string[] = (() => {
    try { return JSON.parse(bounty.labels_json) as string[] } catch { return [] }
  })()

  return (
    <div
      style={{
        background: 'var(--ink-surface)',
        border: '1px solid var(--ink-border)',
        borderRadius: 'var(--ink-radius, 6px)',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <span
          style={{
            fontWeight: 600,
            fontSize: '0.95rem',
            color: 'var(--ink-text)',
            flex: 1,
          }}
        >
          {bounty.title}
        </span>
        <span
          style={{
            fontWeight: 700,
            fontSize: '1rem',
            color: 'var(--ink-primary)',
            whiteSpace: 'nowrap',
          }}
        >
          {formatReward(bounty.reward_cents, bounty.currency)}
        </span>
      </div>

      {/* Status + labels */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <StatusBadge status={bounty.status} />
        {labels.map((lbl) => (
          <span
            key={lbl}
            style={{
              display: 'inline-block',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '0.68rem',
              background: 'var(--ink-border)',
              color: 'var(--ink-muted)',
            }}
          >
            {lbl}
          </span>
        ))}
      </div>

      {/* Description */}
      {bounty.description && (
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', margin: 0 }}>
          {bounty.description}
        </p>
      )}

      {/* Expires */}
      {bounty.expires_at && (
        <p style={{ fontSize: '0.75rem', color: 'var(--ink-dim)', margin: 0 }}>
          Expires {new Date(bounty.expires_at).toLocaleDateString()}
        </p>
      )}

      {/* Proof URL (if submitted/paid) */}
      {bounty.proof_url && (
        <a
          href={bounty.proof_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)' }}
        >
          View proof
        </a>
      )}

      {/* Actions */}
      {onClaim && bounty.status === 'open' && (
        <button
          type="button"
          disabled={claiming}
          onClick={() => onClaim(bounty.id)}
          style={{
            marginTop: '0.25rem',
            padding: '0.4rem 1rem',
            borderRadius: '4px',
            border: 'none',
            background: 'var(--ink-primary)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: claiming ? 'not-allowed' : 'pointer',
            opacity: claiming ? 0.6 : 1,
            alignSelf: 'flex-start',
          }}
        >
          {claiming ? 'Claiming...' : 'Claim Bounty'}
        </button>
      )}

      {isMine && bounty.status === 'claimed' && onSubmitProof && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
          {showProofForm ? (
            <>
              <input
                type="url"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                placeholder="https://github.com/yourname/pr/123"
                style={{
                  padding: '0.4rem 0.6rem',
                  borderRadius: '4px',
                  border: '1px solid var(--ink-border)',
                  background: 'var(--ink-bg)',
                  color: 'var(--ink-text)',
                  fontSize: '0.85rem',
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  disabled={!proofUrl}
                  onClick={() => { onSubmitProof(bounty.id, proofUrl); setShowProofForm(false) }}
                  style={{
                    padding: '0.4rem 1rem',
                    borderRadius: '4px',
                    border: 'none',
                    background: 'var(--ink-primary)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: proofUrl ? 'pointer' : 'not-allowed',
                    opacity: proofUrl ? 1 : 0.5,
                  }}
                >
                  Submit Proof
                </button>
                <button
                  type="button"
                  onClick={() => setShowProofForm(false)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '4px',
                    border: '1px solid var(--ink-border)',
                    background: 'transparent',
                    color: 'var(--ink-muted)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowProofForm(true)}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '4px',
                border: '1px solid var(--ink-primary)',
                background: 'transparent',
                color: 'var(--ink-primary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              Submit Proof
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function StatsBar({ stats }: { stats: Stats }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '1.5rem',
        padding: '0.75rem 1rem',
        background: 'var(--ink-surface)',
        border: '1px solid var(--ink-border)',
        borderRadius: 'var(--ink-radius, 6px)',
        marginBottom: '1rem',
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div style={{ fontSize: '0.7rem', color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Open Bounties</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink-text)' }}>{stats.open_count}</div>
      </div>
      <div>
        <div style={{ fontSize: '0.7rem', color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reward Pool</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink-primary)' }}>
          {formatReward(stats.open_reward_cents, 'USD')}
        </div>
      </div>
      <div>
        <div style={{ fontSize: '0.7rem', color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Paid Out</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink-muted)' }}>
          {formatReward(stats.total_reward_cents, 'USD')}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type Tab = 'open' | 'my' | 'all'

function TabBar({ active, onSelect, isManager }: { active: Tab; onSelect: (t: Tab) => void; isManager: boolean }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'open', label: 'Open' },
    { id: 'my', label: 'My Bounties' },
    ...(isManager ? [{ id: 'all' as Tab, label: 'All' }] : []),
  ]

  return (
    <div
      style={{
        display: 'flex',
        gap: '0',
        borderBottom: '1px solid var(--ink-border)',
        marginBottom: '1rem',
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onSelect(tab.id)}
          style={{
            padding: '0.5rem 1.25rem',
            border: 'none',
            borderBottom: active === tab.id ? '2px solid var(--ink-primary)' : '2px solid transparent',
            background: 'transparent',
            color: active === tab.id ? 'var(--ink-primary)' : 'var(--ink-muted)',
            fontWeight: active === tab.id ? 600 : 400,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BountyBoard() {
  const [tab, setTab] = useState<Tab>('open')
  const [bounties, setBounties] = useState<Bounty[]>([])
  const [myBounties, setMyBounties] = useState<Bounty[]>([])
  const [allBounties, setAllBounties] = useState<Bounty[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)

  // Detect manager role from localStorage (set by auth flow)
  const role = typeof window !== 'undefined' ? (localStorage.getItem('mumega_user_role') ?? 'viewer') : 'viewer'
  const isManager = ['manager', 'admin', 'owner'].includes(role)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [openRes, myRes, statsRes] = await Promise.all([
        apiFetch<{ bounties: Bounty[] }>('/api/bounties?status=open'),
        apiFetch<{ bounties: Bounty[] }>('/api/bounties/my'),
        apiFetch<Stats>('/api/bounties/stats'),
      ])
      setBounties(openRes.bounties)
      setMyBounties(myRes.bounties)
      setStats(statsRes)

      if (isManager) {
        const allRes = await apiFetch<{ bounties: Bounty[] }>('/api/bounties')
        setAllBounties(allRes.bounties)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bounties')
    } finally {
      setLoading(false)
    }
  }, [isManager])

  useEffect(() => {
    load()
  }, [load])

  const handleClaim = useCallback(async (id: string) => {
    setClaiming(id)
    try {
      await apiFetch(`/api/bounties/${id}/claim`, { method: 'POST' })
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to claim bounty')
    } finally {
      setClaiming(null)
    }
  }, [load])

  const handleSubmitProof = useCallback(async (id: string, proofUrl: string) => {
    try {
      await apiFetch(`/api/bounties/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ proof_url: proofUrl }),
      })
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit proof')
    }
  }, [load])

  const currentBounties = tab === 'open' ? bounties : tab === 'my' ? myBounties : allBounties

  return (
    <div style={{ color: 'var(--ink-text)', fontFamily: 'var(--ink-font-body, system-ui, sans-serif)' }}>
      {/* Stats bar */}
      {stats && <StatsBar stats={stats} />}

      {/* Tabs */}
      <TabBar active={tab} onSelect={setTab} isManager={isManager} />

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--ink-muted)', fontSize: '0.9rem' }}>
          Loading...
        </div>
      ) : error ? (
        <div
          style={{
            padding: '1rem',
            borderRadius: '6px',
            border: '1px solid rgba(239,68,68,0.4)',
            background: 'rgba(239,68,68,0.07)',
            color: '#EF4444',
            fontSize: '0.875rem',
          }}
        >
          {error}
          <button
            type="button"
            onClick={load}
            style={{ marginLeft: '1rem', color: 'var(--ink-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Retry
          </button>
        </div>
      ) : currentBounties.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--ink-dim)', fontSize: '0.9rem' }}>
          {tab === 'open' && 'No open bounties right now.'}
          {tab === 'my' && "You haven't claimed any bounties yet."}
          {tab === 'all' && 'No bounties found.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {currentBounties.map((bounty) => (
            <BountyCard
              key={bounty.id}
              bounty={bounty}
              onClaim={tab === 'open' ? handleClaim : undefined}
              onSubmitProof={tab === 'my' ? handleSubmitProof : undefined}
              isMine={tab === 'my'}
              claiming={claiming === bounty.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
