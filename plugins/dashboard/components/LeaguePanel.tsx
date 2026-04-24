import { useState, useEffect } from 'react'
import { Card, CardContent } from '../../../src/components/ui/card'
import { Badge } from '../../../src/components/ui/badge'
import { Separator } from '../../../src/components/ui/separator'

// ── Types ─────────────────────────────────────────────────────────────────

interface LeagueEntry {
  squad_id: string
  squad_name: string
  score: number
  rank: number
  tier: 'construct' | 'fortress' | 'nomad'
  balance_cents: number
}

interface LeagueSeason {
  id: string
  name: string
  start_date: string
  end_date: string
  status: 'active' | 'completed'
}

interface LeagueResponse {
  season: LeagueSeason | null
  entries: LeagueEntry[]
}

interface SeasonsResponse {
  seasons: LeagueSeason[]
}

// ── Helpers ───────────────────────────────────────────────────────────────

function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const token =
    typeof window !== 'undefined' ? (localStorage.getItem('mumega_auth_token') ?? '') : ''
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

function daysRemaining(endDate: string): number {
  const end = new Date(endDate).getTime()
  const now = Date.now()
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)))
}

// Tier display config
const TIER_ORDER: LeagueEntry['tier'][] = ['construct', 'fortress', 'nomad']

const TIER_CONFIG: Record<
  LeagueEntry['tier'],
  { label: string; color: string; rankBg: string }
> = {
  construct: {
    label: 'CONSTRUCT',
    color: 'var(--ink-primary)',
    rankBg: 'rgba(212,160,23,0.12)',
  },
  fortress: {
    label: 'FORTRESS',
    color: 'var(--ink-secondary)',
    rankBg: 'rgba(6,182,212,0.12)',
  },
  nomad: {
    label: 'NOMAD',
    color: 'var(--ink-muted)',
    rankBg: 'rgba(255,255,255,0.06)',
  },
}

// ── Component ─────────────────────────────────────────────────────────────

export function LeaguePanel() {
  const [league, setLeague] = useState<LeagueResponse | null>(null)
  const [seasons, setSeasons] = useState<LeagueSeason[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apiUrl =
    typeof window !== 'undefined' ? (localStorage.getItem('mumega_api_url') ?? '') : ''
  const currentSquadId =
    typeof window !== 'undefined' ? (localStorage.getItem('mumega_squad_id') ?? '') : ''

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError(null)
      try {
        const [leagueRes, seasonsRes] = await Promise.all([
          apiFetch(`${apiUrl}/api/league`),
          apiFetch(`${apiUrl}/api/league/seasons`),
        ])

        if (!leagueRes.ok) throw new Error(`League fetch failed: ${leagueRes.status}`)

        const leagueData = (await leagueRes.json()) as LeagueResponse
        setLeague(leagueData)

        if (seasonsRes.ok) {
          const seasonsData = (await seasonsRes.json()) as SeasonsResponse
          const list = Array.isArray(seasonsData.seasons) ? seasonsData.seasons : []
          setSeasons(list)
          if (leagueData.season) {
            setSelectedSeasonId(leagueData.season.id)
          } else if (list.length > 0) {
            setSelectedSeasonId(list[0].id)
          }
        }
      } catch {
        setError('Failed to load league data.')
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [apiUrl])

  const activeSeason =
    league?.season ??
    (selectedSeasonId ? seasons.find((s) => s.id === selectedSeasonId) ?? null : null)

  const entries = league?.entries ?? []

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        paddingTop: '1.5rem',
      }}
    >
      {/* Section heading */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <h2
          style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--ink-muted)',
          }}
        >
          Squad League
        </h2>

        {/* Season selector */}
        {seasons.length > 1 && (
          <select
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value)}
            style={{
              background: 'var(--ink-surface)',
              color: 'var(--ink-text)',
              border: '1px solid var(--ink-border)',
              borderRadius: '0.375rem',
              padding: '0.25rem 0.5rem',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.status === 'active' ? '(active)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Active season header */}
      {activeSeason && (
        <Card>
          <CardContent
            style={{
              paddingTop: '1rem',
              paddingBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: 'var(--ink-text)',
                }}
              >
                {activeSeason.name}
              </span>
              <Badge
                variant="outline"
                style={{
                  borderColor:
                    activeSeason.status === 'active'
                      ? 'var(--ink-primary)'
                      : 'var(--ink-border)',
                  color:
                    activeSeason.status === 'active'
                      ? 'var(--ink-primary)'
                      : 'var(--ink-muted)',
                  background: 'transparent',
                  fontSize: '0.68rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {activeSeason.status}
              </Badge>
            </div>
            {activeSeason.status === 'active' && (
              <span
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--ink-muted)',
                  fontFamily: 'monospace',
                }}
              >
                {daysRemaining(activeSeason.end_date)}d remaining
              </span>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Loading */}
      {loading && (
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', padding: '2rem 0' }}>
          Loading league…
        </p>
      )}

      {/* Error */}
      {!loading && error && (
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', padding: '2rem 0' }}>
          {error}
        </p>
      )}

      {/* Empty */}
      {!loading && !error && entries.length === 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', padding: '2rem 0' }}>
          No league data yet. Season rankings will appear here once squads start earning KPI scores.
        </p>
      )}

      {/* Tier sections */}
      {!loading &&
        !error &&
        entries.length > 0 &&
        TIER_ORDER.map((tier) => {
          const tierEntries = entries.filter((e) => e.tier === tier)
          if (tierEntries.length === 0) return null

          const cfg = TIER_CONFIG[tier]

          return (
            <div key={tier} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Tier label */}
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: cfg.color,
                }}
              >
                {cfg.label}
              </span>

              {/* Squad rows */}
              {tierEntries.map((entry) => {
                const isCurrentSquad = currentSquadId !== '' && entry.squad_id === currentSquadId
                return (
                  <Card
                    key={entry.squad_id}
                    style={
                      isCurrentSquad
                        ? {
                            border: `1px solid ${cfg.color}`,
                            boxShadow: `0 0 0 1px ${cfg.color}22`,
                          }
                        : {}
                    }
                  >
                    <CardContent
                      style={{
                        paddingTop: '0.875rem',
                        paddingBottom: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                      }}
                    >
                      {/* Rank badge */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '2rem',
                          height: '2rem',
                          borderRadius: '0.375rem',
                          background: cfg.rankBg,
                          color: cfg.color,
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        #{entry.rank}
                      </span>

                      {/* Name + KPI bar */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.875rem',
                              fontWeight: isCurrentSquad ? 700 : 500,
                              color: isCurrentSquad ? cfg.color : 'var(--ink-text)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {entry.squad_name}
                            {isCurrentSquad && (
                              <span
                                style={{
                                  marginLeft: '0.4rem',
                                  fontSize: '0.68rem',
                                  color: cfg.color,
                                  fontFamily: 'monospace',
                                  opacity: 0.8,
                                }}
                              >
                                (you)
                              </span>
                            )}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--ink-muted)',
                              fontFamily: 'monospace',
                              flexShrink: 0,
                            }}
                          >
                            {formatCurrency(entry.balance_cents)}
                          </span>
                        </div>

                        {/* KPI score bar */}
                        <div
                          style={{
                            width: '100%',
                            height: '4px',
                            borderRadius: '2px',
                            background: 'var(--ink-border)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, entry.score))}%`,
                              height: '100%',
                              borderRadius: '2px',
                              background: cfg.color,
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>

                        <span
                          style={{
                            fontSize: '0.68rem',
                            color: 'var(--ink-dim)',
                            fontFamily: 'monospace',
                          }}
                        >
                          KPI {entry.score}/100
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )
        })}
    </div>
  )
}
