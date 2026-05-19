import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../src/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../src/components/ui/table'
import { Badge } from '../../../src/components/ui/badge'
import { Button } from '../../../src/components/ui/button'
import { Progress } from '../../../src/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../src/components/ui/tabs'
import { Separator } from '../../../src/components/ui/separator'
import { cn } from '../../../src/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface SquadHealth {
  squad_id: string
  name: string
  conductance: number
  force: number
  coherence: number
  severity: string
  narrative: string
  tasks_completed: number
  tasks_failed: number
  success_rate: number
  idle_days: number
}

interface AlertItem {
  id: string
  squad_id: string
  severity: string
  narrative: string
}

interface Transaction {
  id: string
  amount_cents: number
  tx_type: string
  status: string
  description: string | null
  created_at: string
}

interface ContentEntry {
  slug: string
  title: string
  status: string
  channel: string
  assignee: string | null
  priority: string
}

interface Contract {
  reference: string
  customer_name: string
  status: string
  destination: string | null
  rate: number | null
  created_at: string
}

interface QAEntry {
  question_text: string
  answer: string | null
  sent_at: string
  channel: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getApiConfig() {
  return {
    url: localStorage.getItem('inkwell_api_url') ?? '',
    token: localStorage.getItem('inkwell_auth_token') ?? '',
  }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
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

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'ok' | 'warn' | 'error' | 'empty' }) {
  return (
    <span className={cn(
      'inline-block w-2 h-2 rounded-full',
      status === 'ok' && 'bg-emerald-500',
      status === 'warn' && 'bg-amber-500',
      status === 'error' && 'bg-red-500',
      status === 'empty' && 'bg-muted',
    )} />
  )
}

function MiniKPI({ title, value, change, icon, variant }: {
  title: string; value: string; change?: string; icon: string; variant?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const colorClass = variant === 'success' ? 'text-emerald-500' : variant === 'warning' ? 'text-amber-500' : variant === 'danger' ? 'text-red-500' : 'text-amber-500'
  return (
    <Card className="flex-1 min-w-[160px]">
      <CardHeader className="pb-1 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
          <span className="text-sm opacity-40">{icon}</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <span className={cn('block text-2xl font-bold font-mono leading-none', colorClass)}>{value}</span>
        {change && <span className="mt-1 block text-xs text-muted-foreground">{change}</span>}
      </CardContent>
    </Card>
  )
}

const SEVERITY_BADGE: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  INFO: 'default',
  WARNING: 'secondary',
  ACTION_REQUIRED: 'destructive',
}

const STATUS_BADGE: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  idea: 'outline', draft: 'secondary', review: 'secondary', scheduled: 'default', published: 'default',
  archived: 'outline', killed: 'destructive',
  pending: 'secondary', settled: 'default', failed: 'destructive',
  sent: 'secondary', viewed: 'secondary', signed: 'default', delivered: 'default',
}

// ── Main Component ───────────────────────────────────────────────────────────

export function AdminOverview() {
  const [loading, setLoading] = useState(true)
  const [squads, setSquads] = useState<SquadHealth[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [revenue, setRevenue] = useState({ gross: 0, net: 0, fees: 0, txCount: 0 })
  const [analytics, setAnalytics] = useState({ events: 0, visitors: 0, pageViews: 0 })
  const [pipeline, setPipeline] = useState<Record<string, ContentEntry[]>>({})
  const [pipelineCounts, setPipelineCounts] = useState<Record<string, number>>({})
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [contractStats, setContractStats] = useState({ total: 0, signed: 0, pending: 0 })
  const [feedback, setFeedback] = useState({ nps: null as number | null, responses: 0, features: 0 })
  const [questionnaire, setQuestionnaire] = useState<QAEntry[]>([])
  const [qMeta, setQMeta] = useState({ total: 0, answered: 0, rate: 0 })

  const load = useCallback(async () => {
    const { url, token } = getApiConfig()
    if (!url) { setLoading(false); return }
    const h = { Authorization: `Bearer ${token}` }
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const today = now.toISOString().slice(0, 10)

    const results = await Promise.allSettled([
      fetch(`${url}/api/diagnostics/health`, { headers: h }),       // 0
      fetch(`${url}/api/diagnostics/alerts`, { headers: h }),       // 1
      fetch(`${url}/api/glass/revenue?period=${period}`, { headers: h }), // 2
      fetch(`${url}/api/glass/transactions?limit=10`, { headers: h }),    // 3
      fetch(`${url}/api/analytics/kpis?date=${today}`, { headers: h }),   // 4
      fetch(`${url}/api/content/pipeline`, { headers: h }),         // 5
      fetch(`${url}/api/contracts?limit=10`, { headers: h }),       // 6
      fetch(`${url}/api/feedback/summary`, { headers: h }),         // 7
      fetch(`${url}/api/questionnaire/history?limit=10`, { headers: h }), // 8
    ])

    // Health
    if (results[0].status === 'fulfilled' && results[0].value.ok) {
      const d = await results[0].value.json() as { squads: SquadHealth[] }
      setSquads(d.squads ?? [])
    }

    // Alerts
    if (results[1].status === 'fulfilled' && results[1].value.ok) {
      const d = await results[1].value.json() as { alerts: AlertItem[] }
      setAlerts(d.alerts ?? [])
    }

    // Revenue
    if (results[2].status === 'fulfilled' && results[2].value.ok) {
      const d = await results[2].value.json() as { total_revenue_cents: number; platform_fees_cents: number; breakdown_by_type: Record<string, { count: number }> }
      const txCount = Object.values(d.breakdown_by_type ?? {}).reduce((s, v) => s + v.count, 0)
      setRevenue({ gross: d.total_revenue_cents, net: d.total_revenue_cents - d.platform_fees_cents, fees: d.platform_fees_cents, txCount })
    }

    // Transactions
    if (results[3].status === 'fulfilled' && results[3].value.ok) {
      const d = await results[3].value.json() as { transactions: Transaction[] }
      setTransactions(d.transactions ?? [])
    }

    // Analytics
    if (results[4].status === 'fulfilled' && results[4].value.ok) {
      const d = await results[4].value.json() as Record<string, { value: number }>
      setAnalytics({
        events: d.events_today?.value ?? 0,
        visitors: d.unique_visitors?.value ?? 0,
        pageViews: d.page_views?.value ?? 0,
      })
    }

    // Pipeline
    if (results[5].status === 'fulfilled' && results[5].value.ok) {
      const d = await results[5].value.json() as { pipeline: Record<string, ContentEntry[]> }
      const p = d.pipeline ?? {}
      setPipeline(p)
      const counts: Record<string, number> = {}
      for (const [k, v] of Object.entries(p)) counts[k] = v.length
      setPipelineCounts(counts)
    }

    // Contracts
    if (results[6].status === 'fulfilled' && results[6].value.ok) {
      const d = await results[6].value.json() as { contracts: Contract[]; total: number }
      setContracts(d.contracts ?? [])
      const list = d.contracts ?? []
      const signed = list.filter((c: Contract) => c.status === 'signed' || c.status === 'delivered').length
      const pending = list.filter((c: Contract) => c.status === 'draft' || c.status === 'sent' || c.status === 'viewed').length
      setContractStats({ total: d.total, signed, pending })
    }

    // Feedback
    if (results[7].status === 'fulfilled' && results[7].value.ok) {
      const d = await results[7].value.json() as { nps_score: number | null; total_responses: number; features: unknown[] }
      setFeedback({ nps: d.nps_score, responses: d.total_responses, features: d.features?.length ?? 0 })
    }

    // Questionnaire
    if (results[8].status === 'fulfilled' && results[8].value.ok) {
      const d = await results[8].value.json() as { history: QAEntry[]; meta: { total: number; answered: number } }
      setQuestionnaire(d.history ?? [])
      const m = d.meta ?? { total: 0, answered: 0 }
      setQMeta({ total: m.total, answered: m.answered, rate: m.total > 0 ? Math.round((m.answered / m.total) * 100) : 0 })
    }

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const acknowledgeAlert = async (alertId: string) => {
    const { url, token } = getApiConfig()
    await fetch(`${url}/api/diagnostics/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    setAlerts(prev => prev.filter(a => a.id !== alertId))
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg bg-muted/50 animate-pulse" />)}
      </div>
    )
  }

  const criticalSquads = squads.filter(s => s.severity === 'ACTION_REQUIRED').length
  const warnSquads = squads.filter(s => s.severity === 'WARNING').length
  const healthySquads = squads.filter(s => s.severity === 'INFO').length
  const totalContent = Object.values(pipelineCounts).reduce((s, v) => s + v, 0)
  const inFlight = (pipelineCounts.idea ?? 0) + (pipelineCounts.draft ?? 0) + (pipelineCounts.review ?? 0) + (pipelineCounts.scheduled ?? 0)

  return (
    <div className="flex flex-col gap-6">

      {/* System Health Strip */}
      <Card>
        <CardContent className="py-3 px-5">
          <div className="flex flex-wrap gap-5 items-center">
            <div className="flex items-center gap-2">
              <StatusDot status={criticalSquads > 0 ? 'error' : warnSquads > 0 ? 'warn' : 'ok'} />
              <span className="text-xs text-muted-foreground">Squads</span>
              <span className="text-xs font-semibold">{squads.length}</span>
              {criticalSquads > 0 && <Badge variant="destructive" className="text-[0.6rem] px-1.5 py-0">{criticalSquads} critical</Badge>}
              {warnSquads > 0 && <Badge variant="secondary" className="text-[0.6rem] px-1.5 py-0">{warnSquads} warn</Badge>}
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <StatusDot status={alerts.length > 0 ? 'warn' : 'ok'} />
              <span className="text-xs text-muted-foreground">Alerts</span>
              <span className="text-xs font-semibold">{alerts.length}</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <StatusDot status={inFlight > 0 ? 'ok' : 'empty'} />
              <span className="text-xs text-muted-foreground">Content</span>
              <span className="text-xs font-semibold">{inFlight} in flight</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <StatusDot status={revenue.gross > 0 ? 'ok' : 'empty'} />
              <span className="text-xs text-muted-foreground">Revenue</span>
              <span className="text-xs font-semibold font-mono">{formatCents(revenue.gross)}</span>
            </div>
            <div className="ml-auto">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={load}>Refresh</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert Banner */}
      {alerts.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="py-3 px-5">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-amber-500">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-0 flex flex-col gap-2">
            {alerts.slice(0, 5).map(a => (
              <div key={a.id} className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <Badge variant={SEVERITY_BADGE[a.severity] ?? 'outline'} className="mr-2 text-[0.6rem]">{a.squad_id}</Badge>
                  <span className="text-sm text-foreground">{a.narrative}</span>
                </div>
                <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => acknowledgeAlert(a.id)}>Dismiss</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* KPI Row */}
      <div className="flex flex-wrap gap-3">
        <MiniKPI title="Gross Revenue" value={formatCents(revenue.gross)} change={`${revenue.txCount} transactions`} icon="◈" variant="success" />
        <MiniKPI title="Visitors Today" value={analytics.visitors.toLocaleString()} change={`${analytics.pageViews} page views`} icon="◆" />
        <MiniKPI title="Contracts" value={String(contractStats.total)} change={`${contractStats.signed} signed, ${contractStats.pending} pending`} icon="◎" />
        <MiniKPI title="NPS Score" value={feedback.nps !== null ? String(feedback.nps) : '—'} change={`${feedback.responses} responses`} icon="◇" variant={feedback.nps !== null && feedback.nps >= 50 ? 'success' : feedback.nps !== null && feedback.nps >= 0 ? 'warning' : 'danger'} />
        <MiniKPI title="Check-In Rate" value={`${qMeta.rate}%`} change={`${qMeta.answered}/${qMeta.total}`} icon="◌" variant={qMeta.rate >= 80 ? 'success' : qMeta.rate >= 50 ? 'warning' : 'danger'} />
      </div>

      {/* Tabbed Detail Sections */}
      <Tabs defaultValue="health" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="health">Squad Health</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="checkin">Check-In</TabsTrigger>
        </TabsList>

        {/* Health Tab */}
        <TabsContent value="health">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {squads.length === 0 ? (
              <Card className="col-span-full"><CardContent className="py-8 text-center text-sm text-muted-foreground">No squad data available</CardContent></Card>
            ) : squads.map(s => (
              <Card key={s.squad_id} className={cn(
                s.severity === 'ACTION_REQUIRED' && 'border-red-500/30',
                s.severity === 'WARNING' && 'border-amber-500/30',
              )}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{s.name}</CardTitle>
                    <Badge variant={SEVERITY_BADGE[s.severity] ?? 'outline'} className="text-[0.6rem]">{s.severity.replace('_', ' ')}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Conductance</span>
                        <span className="font-mono font-semibold">{s.conductance.toFixed(2)}</span>
                      </div>
                      <Progress value={s.conductance * 100} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Force</span>
                        <span className="font-mono font-semibold">{s.force.toFixed(2)}</span>
                      </div>
                      <Progress value={s.force * 100} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Coherence</span>
                        <span className="font-mono font-semibold">{s.coherence.toFixed(2)}</span>
                      </div>
                      <Progress value={s.coherence * 100} className="h-1.5" />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
                    <span>{s.tasks_completed} done</span>
                    <span>{s.tasks_failed} failed</span>
                    <span>{s.idle_days}d idle</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 italic leading-snug">{s.narrative}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-3">
            <Button variant="outline" size="sm" asChild><a href="/dashboard/diagnostics">View full diagnostics →</a></Button>
          </div>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content">
          {/* Pipeline Progress Bar */}
          <Card className="mt-3">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Content Pipeline — {totalContent} total</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {totalContent === 0 ? (
                <p className="text-sm text-muted-foreground">No content in pipeline</p>
              ) : (
                <>
                  <div className="flex h-2 rounded-full overflow-hidden mb-3">
                    {[
                      { key: 'idea', color: 'bg-muted' },
                      { key: 'draft', color: 'bg-amber-500' },
                      { key: 'review', color: 'bg-orange-400' },
                      { key: 'scheduled', color: 'bg-cyan-500' },
                      { key: 'published', color: 'bg-emerald-500' },
                    ].filter(s => (pipelineCounts[s.key] ?? 0) > 0).map(s => (
                      <div key={s.key} className={cn(s.color)} style={{ width: `${((pipelineCounts[s.key] ?? 0) / totalContent) * 100}%`, minWidth: '2px' }} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {['idea', 'draft', 'review', 'scheduled', 'published'].filter(k => (pipelineCounts[k] ?? 0) > 0).map(k => (
                      <div key={k} className="flex items-center gap-1.5 text-xs">
                        <span className={cn(
                          'w-2 h-2 rounded-full',
                          k === 'idea' && 'bg-muted-foreground/30',
                          k === 'draft' && 'bg-amber-500',
                          k === 'review' && 'bg-orange-400',
                          k === 'scheduled' && 'bg-cyan-500',
                          k === 'published' && 'bg-emerald-500',
                        )} />
                        <span className="text-muted-foreground capitalize">{k}</span>
                        <span className="font-mono font-semibold">{pipelineCounts[k]}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Content items needing attention (non-published) */}
          {inFlight > 0 && (
            <Card className="mt-3">
              <CardHeader className="border-b px-5 py-3">
                <CardTitle className="text-sm font-semibold">In Flight</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs uppercase tracking-wider">Title</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Channel</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Assignee</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {['idea', 'draft', 'review', 'scheduled'].flatMap(status =>
                      (pipeline[status] ?? []).slice(0, 5).map(e => (
                        <TableRow key={e.slug}>
                          <TableCell className="text-sm font-medium max-w-[240px] truncate">{e.title}</TableCell>
                          <TableCell><Badge variant={STATUS_BADGE[e.status] ?? 'outline'} className="text-[0.6rem]">{e.status}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{e.channel}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{e.assignee ?? '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" asChild><a href="/dashboard/calendar">Content Calendar →</a></Button>
          </div>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue">
          <div className="flex flex-wrap gap-3 mt-3">
            <MiniKPI title="Gross" value={formatCents(revenue.gross)} icon="$" variant="success" />
            <MiniKPI title="Net" value={formatCents(revenue.net)} change="After platform fees" icon="$" variant="success" />
            <MiniKPI title="Platform Fees" value={formatCents(revenue.fees)} change="5% rate" icon="%" />
          </div>

          <Card className="mt-3">
            <CardHeader className="border-b px-5 py-3">
              <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground text-center">No transactions</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs uppercase tracking-wider">Type</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Amount</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map(tx => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm">{tx.tx_type}</TableCell>
                        <TableCell className="font-mono text-sm">{formatCents(tx.amount_cents)}</TableCell>
                        <TableCell><Badge variant={STATUS_BADGE[tx.status] ?? 'outline'} className="text-[0.6rem]">{tx.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{timeAgo(tx.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="mt-3">
            <Button variant="outline" size="sm" asChild><a href="/dashboard/commerce">Full commerce view →</a></Button>
          </div>
        </TabsContent>

        {/* Contracts Tab */}
        <TabsContent value="contracts">
          <Card className="mt-3">
            <CardHeader className="border-b px-5 py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Recent Contracts</CardTitle>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>{contractStats.signed} signed</span>
                  <Separator orientation="vertical" className="h-3" />
                  <span>{contractStats.pending} pending</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {contracts.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground text-center">No contracts</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs uppercase tracking-wider">Reference</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Customer</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Destination</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Rate</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map(c => (
                      <TableRow key={c.reference}>
                        <TableCell className="font-mono text-sm text-cyan-500 font-semibold">{c.reference}</TableCell>
                        <TableCell className="text-sm">{c.customer_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.destination ?? '—'}</TableCell>
                        <TableCell className="font-mono text-sm">{c.rate ? `$${c.rate.toLocaleString()}` : '—'}</TableCell>
                        <TableCell><Badge variant={STATUS_BADGE[c.status] ?? 'outline'} className="text-[0.6rem]">{c.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="mt-3">
            <Button variant="outline" size="sm" asChild><a href="/dashboard/contracts">All contracts →</a></Button>
          </div>
        </TabsContent>

        {/* Check-In Tab */}
        <TabsContent value="checkin">
          <div className="flex flex-wrap gap-3 mt-3">
            <MiniKPI title="Questions" value={String(qMeta.total)} icon="?" />
            <MiniKPI title="Answered" value={String(qMeta.answered)} icon="✓" variant="success" />
            <MiniKPI title="Response Rate" value={`${qMeta.rate}%`} icon="%" variant={qMeta.rate >= 80 ? 'success' : qMeta.rate >= 50 ? 'warning' : 'danger'} />
          </div>

          <Card className="mt-3">
            <CardHeader className="border-b px-5 py-3">
              <CardTitle className="text-sm font-semibold">Recent Q&A</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {questionnaire.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground text-center">No check-in data</p>
              ) : (
                <div>
                  {questionnaire.map((q, i) => (
                    <div key={i} className={cn('px-5 py-3', i < questionnaire.length - 1 && 'border-b')}>
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{q.question_text}</p>
                          {q.answer ? (
                            <p className="text-sm text-muted-foreground mt-1 italic">{q.answer}</p>
                          ) : (
                            <Badge variant="secondary" className="mt-1 text-[0.6rem]">Unanswered</Badge>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs text-muted-foreground">{timeAgo(q.sent_at)}</span>
                          <Badge variant="outline" className="ml-2 text-[0.6rem]">{q.channel}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-3">
            <Button variant="outline" size="sm" asChild><a href="/dashboard/questionnaire">Full check-in history →</a></Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="border-b px-5 py-3">
          <CardTitle className="text-sm font-semibold">Admin Actions</CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild><a href="/dashboard/diagnostics">System Health</a></Button>
            <Button variant="outline" size="sm" asChild><a href="/dashboard/calendar">Content Calendar</a></Button>
            <Button variant="outline" size="sm" asChild><a href="/dashboard/commerce">Commerce</a></Button>
            <Button variant="outline" size="sm" asChild><a href="/dashboard/contracts">Contracts</a></Button>
            <Button variant="outline" size="sm" asChild><a href="/dashboard/analytics">Analytics</a></Button>
            <Button variant="outline" size="sm" asChild><a href="/dashboard/feedback">Feedback</a></Button>
            <Button variant="outline" size="sm" asChild><a href="/dashboard/media">Media Library</a></Button>
            <Button variant="outline" size="sm" asChild><a href="/dashboard/seo">SEO</a></Button>
            <Button variant="outline" size="sm" asChild><a href="/dashboard/settings">Settings</a></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
