import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../src/components/ui/card'
import { Badge } from '../../../src/components/ui/badge'
import { Progress } from '../../../src/components/ui/progress'
import { Avatar, AvatarFallback } from '../../../src/components/ui/avatar'
import { cn } from '../../../src/lib/utils'

// ── KPI types ──────────────────────────────────────────────────────────────

interface KPIData {
  kpi_score: number
  velocity: number
  success_rate: number
  tokens_used: number
  tokens_by_grade: Record<string, number>
  total_earned_cents: number
  balance_cents: number
}

// ── KPI formatters ─────────────────────────────────────────────────────────

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

interface SquadAgent {
  name: string
  role?: string
  status?: 'online' | 'offline' | 'busy'
}

interface SquadTaskCounts {
  backlog: number
  in_progress: number
  done: number
}

interface Squad {
  id: string
  name: string
  hired?: boolean
  task_counts?: SquadTaskCounts
  agents?: SquadAgent[]
  budget_used?: number
  budget_total?: number
}

const AGENT_STATUS_DOT: Record<string, string> = {
  online: 'bg-emerald-500',
  busy: 'bg-orange-500',
  offline: 'bg-muted-foreground',
}

function agentInitials(name: string): string {
  return name
    .split(/[\s-_]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

// ── KpiBar ─────────────────────────────────────────────────────────────────

function KpiBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100)
  const barColor =
    pct >= 80
      ? 'var(--ink-primary)'
      : pct >= 50
        ? 'var(--ink-secondary)'
        : 'var(--ink-muted)'
  return (
    <div style={{ marginBottom: '0.4rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          color: 'var(--ink-muted)',
          marginBottom: '3px',
        }}
      >
        <span>{label}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div
        style={{
          height: '4px',
          background: 'var(--ink-border)',
          borderRadius: '2px',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: barColor,
            borderRadius: '2px',
            transition: 'width 0.4s',
          }}
        />
      </div>
    </div>
  )
}

// ── KpiSection ────────────────────────────────────────────────────────────

function KpiSection({ squadId, apiUrl, authToken }: { squadId: string; apiUrl: string; authToken: string }) {
  const [kpi, setKpi] = useState<KPIData | null>(null)

  useEffect(() => {
    fetch(`${apiUrl}/squads/${squadId}/kpis`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setKpi(d as KPIData))
      .catch(() => {})
  }, [squadId, apiUrl, authToken])

  if (!kpi) return null

  return (
    <div
      style={{
        marginTop: '0.75rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid var(--ink-border)',
      }}
    >
      <KpiBar label="Performance score" value={kpi.kpi_score} />
      <KpiBar label="Task velocity" value={kpi.velocity} max={5} />
      <KpiBar label="Success rate" value={kpi.success_rate * 100} />
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginTop: '0.5rem',
          fontSize: '0.78rem',
        }}
      >
        <span style={{ color: 'var(--ink-primary)' }}>
          💰 {formatMoney(kpi.total_earned_cents)}
        </span>
        <span style={{ color: 'var(--ink-muted)' }}>
          🔋 {formatTokens(kpi.tokens_used)} tokens
        </span>
      </div>
    </div>
  )
}

// ── AchievementBadges ─────────────────────────────────────────────────────

interface Achievement {
  id: string
  badge: string
  name: string
  description: string | null
  earned_at: string
}

const BADGE_ICONS: Record<string, string> = {
  first_memory: '🧠',
  ten_tasks: '⚡',
  hundred_tasks: '💯',
  first_bounty: '🏆',
  tier_up_fortress: '🏰',
  tier_up_construct: '🏗',
  streak_30d: '🔥',
}

function AchievementBadges({
  squadId,
  apiUrl,
  authToken,
}: {
  squadId: string
  apiUrl: string
  authToken: string
}) {
  const [achievements, setAchievements] = useState<Achievement[]>([])

  useEffect(() => {
    fetch(`${apiUrl}/api/squads/${squadId}/achievements`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.achievements)) {
          setAchievements(d.achievements as Achievement[])
        }
      })
      .catch(() => {})
  }, [squadId, apiUrl, authToken])

  if (achievements.length === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.375rem',
        marginTop: '0.5rem',
        paddingTop: '0.5rem',
        borderTop: '1px solid var(--ink-border)',
      }}
    >
      {achievements.map((a) => (
        <span
          key={a.badge}
          title={`${a.name}${a.description ? ': ' + a.description : ''}`}
          style={{
            fontSize: '1.1rem',
            cursor: 'default',
            filter: 'drop-shadow(0 0 4px rgba(212,160,23,0.4))',
          }}
        >
          {BADGE_ICONS[a.badge] ?? '🎖'}
        </span>
      ))}
    </div>
  )
}

// ── BudgetGauge ───────────────────────────────────────────────────────────

function BudgetGauge({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const indicatorClass =
    pct > 85 ? '[&>div]:bg-red-500' : pct > 60 ? '[&>div]:bg-orange-500' : '[&>div]:bg-emerald-500'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Budget
        </span>
        <span className="font-mono text-xs text-muted-foreground">{pct}%</span>
      </div>
      <Progress value={pct} className={cn('h-1.5', indicatorClass)} />
      <span className="font-mono text-xs text-muted-foreground">
        ${used.toLocaleString()} / ${total.toLocaleString()}
      </span>
    </div>
  )
}

function SquadCard({ squad, apiUrl, authToken }: { squad: Squad; apiUrl: string; authToken: string }) {
  const counts = squad.task_counts ?? { backlog: 0, in_progress: 0, done: 0 }
  const agents = squad.agents ?? []

  return (
    <Card className="flex flex-col gap-4">
      <CardHeader className="pb-0">
        <div className="flex items-center gap-2">
          <CardTitle className="flex-1 text-base">{squad.name}</CardTitle>
          {squad.hired && (
            <Badge variant="secondary" className="text-amber-500 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 uppercase tracking-wider text-[0.6rem]">
              Managed
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Task count chips */}
        <div className="flex gap-2">
          {[
            { label: 'Backlog', count: counts.backlog, cls: 'text-muted-foreground' },
            { label: 'In Progress', count: counts.in_progress, cls: 'text-cyan-400' },
            { label: 'Done', count: counts.done, cls: 'text-emerald-500' },
          ].map(({ label, count, cls }) => (
            <Badge
              key={label}
              variant="outline"
              className={cn('flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 h-auto', cls)}
            >
              <span className="font-mono text-lg font-bold leading-none">{count}</span>
              <span className="text-[0.6rem] uppercase tracking-wide font-semibold">{label}</span>
            </Badge>
          ))}
        </div>

        {/* Agent avatars */}
        {agents.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Agents
            </span>
            <div className="flex flex-col gap-1.5">
              {agents.map((agent) => {
                const dotClass = AGENT_STATUS_DOT[agent.status ?? 'offline']
                return (
                  <div key={agent.name} className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 text-[0.6rem]">
                      <AvatarFallback className="text-[0.6rem]">
                        {agentInitials(agent.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotClass)} />
                    <span className="text-sm font-medium">{agent.name}</span>
                    {agent.role && (
                      <span className="text-xs text-muted-foreground">— {agent.role}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Budget gauge */}
        {squad.budget_total != null &&
          squad.budget_used != null &&
          squad.budget_total > 0 && (
            <BudgetGauge used={squad.budget_used} total={squad.budget_total} />
          )}

        {/* KPI gauges */}
        <KpiSection squadId={squad.id} apiUrl={apiUrl} authToken={authToken} />

        {/* Achievement badges */}
        <AchievementBadges squadId={squad.id} apiUrl={apiUrl} authToken={authToken} />
      </CardContent>
    </Card>
  )
}

export function SquadPanel() {
  const [squads, setSquads] = useState<Squad[]>([])
  const [loading, setLoading] = useState(true)

  const apiUrl = typeof window !== 'undefined' ? (localStorage.getItem('inkwell_api_url') ?? '') : ''
  const authToken = typeof window !== 'undefined' ? (localStorage.getItem('inkwell_auth_token') ?? '') : ''

  useEffect(() => {
    fetch(`${apiUrl}/my/squads`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => r.json())
      .then((data: Squad[]) => {
        setSquads(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [apiUrl, authToken])

  if (loading) {
    return (
      <p className="py-8 text-sm text-muted-foreground">Loading squads…</p>
    )
  }

  if (squads.length === 0) {
    return (
      <Card className="py-12 text-center">
        <CardContent className="text-sm text-muted-foreground">
          No active squads yet. Create one from the Marketplace.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
      {squads.map((squad) => (
        <SquadCard key={squad.id} squad={squad} apiUrl={apiUrl} authToken={authToken ?? ''} />
      ))}
    </div>
  )
}
