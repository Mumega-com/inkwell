import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../src/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../src/components/ui/table'
import { Badge } from '../../../src/components/ui/badge'
import { Button } from '../../../src/components/ui/button'
import { cn } from '../../../src/lib/utils'
import { config } from '../../../src/lib/config'

interface AnalyticsOverview {
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
  sessions?: number
  bounceRate?: number
}

interface TopQuery {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface DashboardData {
  wallet_balance?: number
  tasks_done?: number
  active_squads?: number
  content_published?: number
  wallet_balance_change?: number
  tasks_done_change?: number
  active_squads_change?: number
  content_published_change?: number
  recent_tasks?: ActivityItem[]
}

interface ActivityItem {
  id: string
  title: string
  status: 'done' | 'in_progress' | 'backlog' | 'claimed' | 'failed'
  squad?: string
  priority?: string
  updated_at: string
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ⚡ Bolt: Cache Intl.NumberFormat instances at module level to avoid expensive GC/instantiation inside loops
const currencyFormat = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
const compactNumberFormat = new Intl.NumberFormat('en-CA', { notation: 'compact', maximumFractionDigits: 1 })

function formatCurrency(n: number): string {
  return currencyFormat.format(n)
}

function formatCompact(n: number): string {
  return compactNumberFormat.format(n)
}

const TEAM_NAMES: Record<string, string> = config.brand?.teamNames || {}

const STATUS_LABELS_MAP: Record<string, string> = config.brand?.statusLabels || {}

const PRIORITY_LABELS: Record<string, string> = config.brand?.priorityLabels || {}

function teamName(id: string): string { return TEAM_NAMES[id] ?? id }
function statusLabel(s: string): string { return STATUS_LABELS_MAP[s] ?? s }
function priorityLabel(p: string): string { return PRIORITY_LABELS[p] ?? p }

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  done: 'default',
  in_progress: 'secondary',
  claimed: 'secondary',
  backlog: 'outline',
  failed: 'destructive',
}

interface MiniKPIProps {
  title: string
  value: string | null
  change?: number | null
  icon: string
  loading: boolean
}

function MiniKPI({ title, value, change, icon, loading }: MiniKPIProps) {
  const isPositive = change !== null && change !== undefined && change >= 0

  return (
    <Card className="flex-1 min-w-[180px]">
      <CardHeader className="pb-2 pt-5 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </CardTitle>
          <span className="text-base opacity-50">{icon}</span>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {loading ? (
          <div className="h-8 rounded bg-muted/50 animate-pulse" />
        ) : (
          <span className="block text-3xl font-bold font-mono leading-none text-amber-500">
            {value ?? '—'}
          </span>
        )}
        {change !== null && change !== undefined && !loading && (
          <span className={cn('mt-1.5 block text-xs font-medium', isPositive ? 'text-emerald-500' : 'text-destructive')}>
            {isPositive ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% vs last period
          </span>
        )}
      </CardContent>
    </Card>
  )
}

export function ArrowDashboard() {
  const [apiUrl, setApiUrl] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [configMissing, setConfigMissing] = useState(false)
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [topQueries, setTopQueries] = useState<TopQuery[]>([])

  useEffect(() => {
    const url = localStorage.getItem('mumega_api_url')
    const token = localStorage.getItem('mumega_auth_token')
    if (!url || !token) {
      setConfigMissing(true)
      setLoading(false)
      return
    }
    setApiUrl(url)
    setAuthToken(token)
  }, [])

  useEffect(() => {
    if (!apiUrl || !authToken) return
    fetch(`${apiUrl}/my/dashboard`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    })
      .then(r => r.json())
      .then((d: DashboardData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))

    // Analytics: GA4 + GSC overview
    fetch(`${apiUrl}/api/dashboard/overview`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((d: Record<string, unknown> | null) => {
        if (!d) return
        setAnalytics({
          clicks: d.clicks as number,
          impressions: d.impressions as number,
          ctr: d.ctr as number,
          position: d.position as number,
          sessions: d.sessions as number,
          bounceRate: d.bounceRate as number,
        })
      })
      .catch(() => {})

    // SEO: top queries
    fetch(`${apiUrl}/api/dashboard/seo?period=7d`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((d: Record<string, unknown> | null) => {
        if (d?.top_queries) setTopQueries(d.top_queries as TopQuery[])
      })
      .catch(() => {})
  }, [apiUrl, authToken])

  if (configMissing) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground text-sm mb-4">
          Welcome! Enter your business details to get started.
        </p>
        <Button asChild variant="outline" size="sm">
          <a href="/dashboard/settings">Get started</a>
        </Button>
      </Card>
    )
  }

  const tasks = data?.recent_tasks?.slice(0, 10) ?? []

  const lastDone = data?.recent_tasks?.find(t => t.status === 'done')
  const statusLine = lastDone
    ? `Your ${teamName(lastDone.squad ?? '')} completed "${lastDone.title}" — ${timeAgo(lastDone.updated_at)}`
    : 'Your teams are working. Check back soon.'

  return (
    <div className="flex flex-col gap-7">
      {/* Status Line */}
      {!loading && (
        <p className="text-sm text-muted-foreground border-l-2 border-amber-500/40 pl-3">
          {statusLine}
        </p>
      )}

      {/* KPI Row */}
      <div className="flex flex-wrap gap-4">
        <MiniKPI
          title="Budget Remaining"
          value={data?.wallet_balance != null ? formatCurrency(data.wallet_balance) : null}
          change={data?.wallet_balance_change}
          icon="◈"
          loading={loading}
        />
        <MiniKPI
          title="Work Completed this week"
          value={data?.tasks_done != null ? formatCompact(data.tasks_done) : null}
          change={data?.tasks_done_change}
          icon="✓"
          loading={loading}
        />
        <MiniKPI
          title="Active Teams"
          value={data?.active_squads != null ? String(data.active_squads) : null}
          change={data?.active_squads_change}
          icon="◉"
          loading={loading}
        />
        <MiniKPI
          title="Content Published"
          value={data?.content_published != null ? formatCompact(data.content_published) : null}
          change={data?.content_published_change}
          icon="⊕"
          loading={loading}
        />
      </div>

      {/* Analytics Row: GA4 + GSC */}
      {(analytics || loading) && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Search &amp; Traffic — last 7 days</p>
          <div className="flex flex-wrap gap-4">
            <MiniKPI title="Organic Clicks" value={analytics?.clicks != null ? formatCompact(analytics.clicks) : null} icon="↗" loading={loading && !analytics} />
            <MiniKPI title="Impressions" value={analytics?.impressions != null ? formatCompact(analytics.impressions) : null} icon="◎" loading={loading && !analytics} />
            <MiniKPI title="Avg Position" value={analytics?.position != null ? analytics.position.toFixed(1) : null} icon="#" loading={loading && !analytics} />
            <MiniKPI title="CTR" value={analytics?.ctr != null ? `${(analytics.ctr * 100).toFixed(2)}%` : null} icon="%" loading={loading && !analytics} />
            <MiniKPI title="Sessions" value={analytics?.sessions != null ? formatCompact(analytics.sessions) : null} icon="~" loading={loading && !analytics} />
            <MiniKPI title="Bounce Rate" value={analytics?.bounceRate != null ? `${(analytics.bounceRate * 100).toFixed(0)}%` : null} icon="⇥" loading={loading && !analytics} />
          </div>
          {topQueries.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader className="border-b px-6 py-4">
                <CardTitle className="text-sm font-semibold">Top Search Queries</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs uppercase tracking-wider">Query</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right">Clicks</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right">Impressions</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right">Position</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topQueries.slice(0, 10).map((q, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm max-w-[320px] truncate">{q.query}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{q.clicks}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">{q.impressions}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">{q.position.toFixed(1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Lower row: activity + quick actions */}
      <div className="flex flex-wrap gap-5 items-start">
        {/* Activity Feed */}
        <Card className="flex-1 min-w-[480px] overflow-hidden">
          <CardHeader className="border-b px-6 py-4">
            <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">Loading…</p>
            ) : tasks.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">No recent activity.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase tracking-wider">What</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Team</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="max-w-[240px] truncate font-medium text-sm">
                        {t.title}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.squad ? teamName(t.squad) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE_VARIANT[t.status] ?? 'outline'}>
                          {statusLabel(t.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {timeAgo(t.updated_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="flex-none w-[260px] overflow-hidden">
          <CardHeader className="border-b px-6 py-4">
            <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-5 flex flex-col gap-3">
            <Button asChild variant="outline" className="w-full justify-start text-amber-500 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400">
              <a href="/dashboard/tasks/new">+ Ask your team something</a>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
              <a href="/dashboard/tasks">◈ See current work</a>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
              <a href="/dashboard/money">$ Add funds</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
