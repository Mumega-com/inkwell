import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../src/components/ui/card'
import { Badge } from '../../../src/components/ui/badge'
import { Button } from '../../../src/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../src/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../src/components/ui/table'
import { cn } from '../../../src/lib/utils'
import { config } from '../../../src/lib/config'

interface WalletData {
  balance: number
  earnings_total: number
  spending_total: number
  earnings_series?: number[]
  spending_series?: number[]
}

interface Transaction {
  id: string
  date: string
  type: 'earn' | 'spend'
  amount: number
  counterparty: string
  reason: string
}

const COUNTERPARTY_NAMES: Record<string, string> = {
  ...(config.brand?.teamNames || {}),
  ...(config.brand?.counterpartyNames || {}),
}

function resolveCounterparty(raw: string): string {
  const key = raw.toLowerCase().replace(/[-\s]/g, '_')
  return COUNTERPARTY_NAMES[key] ?? COUNTERPARTY_NAMES[raw] ?? raw
}

function humanizeReason(reason: string, type: 'earn' | 'spend'): string {
  if (!reason) return type === 'earn' ? 'Sale revenue' : 'Team work completed'
  // Strip common technical prefixes / UUIDs
  return reason
    .replace(/^task:[a-z0-9-]+\s*/i, '')
    .replace(/^squad:[a-z0-9-]+\s*/i, '')
    .replace(/[_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

const cadFormatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCAD(n: number): string {
  return cadFormatter.format(n)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function MiniSparkline({ series, color }: { series: number[]; color: string }) {
  if (!series || series.length < 2) return null
  const max = Math.max(...series)
  const min = Math.min(...series)
  const range = max - min || 1
  const w = 120
  const h = 32
  const pts = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

interface MetricColProps {
  label: string
  amount: number | null
  series?: number[]
  colorClass: string
  sparklineColor: string
  loading: boolean
}

function MetricCol({
  label,
  amount,
  series,
  colorClass,
  sparklineColor,
  loading,
}: MetricColProps) {
  return (
    <Card className="flex-1 basis-48">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {loading ? (
          <div className="h-7 w-40 rounded bg-border opacity-50" />
        ) : (
          <span className={cn('font-mono text-2xl font-bold leading-none', colorClass)}>
            {amount != null ? formatCAD(amount) : '—'}
          </span>
        )}
        {!loading && series && series.length > 1 && (
          <MiniSparkline series={series} color={sparklineColor} />
        )}
      </CardContent>
    </Card>
  )
}

export function WalletView({ apiUrl, authToken }: { apiUrl: string; authToken: string }) {
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${apiUrl}/my/wallet`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }).then((r) => r.json()),
      fetch(`${apiUrl}/my/transactions`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }).then((r) => r.json()),
    ])
      .then(([w, t]: [WalletData, Transaction[]]) => {
        setWallet(w)
        setTransactions(Array.isArray(t) ? t : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [apiUrl, authToken])

  // Total deposited = balance + what's been spent
  const deposited =
    wallet != null
      ? wallet.balance + (wallet.spending_total ?? 0)
      : null

  const filterTransactions = (filter: string) =>
    transactions.filter((t) => filter === 'all' || t.type === filter)

  return (
    <div className="flex flex-col gap-7">
      {/* Balance hero */}
      <Card>
        <CardHeader className="pb-1">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Budget Remaining
            </CardTitle>
            <Button asChild size="sm" variant="default">
              <a href="https://checkout.stripe.com/placeholder" target="_blank" rel="noreferrer">
                Add Funds
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {loading ? (
            <div className="h-12 w-56 rounded-md bg-border opacity-50" />
          ) : (
            <>
              <span className="font-mono text-5xl font-bold leading-none tracking-tight text-amber-500">
                {wallet?.balance != null ? formatCAD(wallet.balance) : '—'}
              </span>
              {deposited != null && (
                <p className="text-xs text-muted-foreground">
                  of {formatCAD(deposited)} deposited this month
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Revenue / Team Costs */}
      <div className="flex flex-wrap gap-4">
        <MetricCol
          label="Revenue"
          amount={wallet?.earnings_total ?? null}
          series={wallet?.earnings_series}
          colorClass="text-emerald-500"
          sparklineColor="#10B981"
          loading={loading}
        />
        <MetricCol
          label="Team Costs"
          amount={wallet?.spending_total ?? null}
          series={wallet?.spending_series}
          colorClass="text-red-500"
          sparklineColor="#EF4444"
          loading={loading}
        />
      </div>

      {/* Transaction history with filter tabs */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex flex-wrap items-center gap-4">
            <CardTitle className="text-sm font-semibold">Activity</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Activity</TabsTrigger>
              <TabsTrigger value="earn">Revenue</TabsTrigger>
              <TabsTrigger value="spend">Team Costs</TabsTrigger>
            </TabsList>

            {(['all', 'earn', 'spend'] as const).map((filter) => {
              const filtered = filterTransactions(filter)
              return (
                <TabsContent key={filter} value={filter}>
                  {loading ? (
                    <p className="py-8 text-sm text-muted-foreground">Loading…</p>
                  ) : filtered.length === 0 ? (
                    <p className="py-8 text-sm text-muted-foreground">No activity yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>From / To</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((tx) => {
                          const isEarn = tx.type === 'earn'
                          return (
                            <TableRow key={tx.id}>
                              <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                {formatDate(tx.date)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={cn(
                                    isEarn
                                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                                      : 'border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted'
                                  )}
                                  variant="outline"
                                >
                                  {isEarn ? 'Revenue' : 'Team payment'}
                                </Badge>
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'font-mono font-bold whitespace-nowrap',
                                  isEarn ? 'text-emerald-500' : 'text-red-500'
                                )}
                              >
                                {isEarn ? '+' : '−'}
                                {formatCAD(tx.amount)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {resolveCounterparty(tx.counterparty)}
                              </TableCell>
                              <TableCell className="max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">
                                {humanizeReason(tx.reason, tx.type)}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              )
            })}
          </Tabs>

          {/* Download Invoice */}
          {!loading && transactions.length > 0 && (
            <div className="mt-4 flex justify-end">
              <a
                href={`${apiUrl}/my/invoice`}
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                target="_blank"
                rel="noreferrer"
              >
                Download Invoice
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
