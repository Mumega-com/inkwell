import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../src/components/ui/card'
import { Badge } from '../../../src/components/ui/badge'
import { Button } from '../../../src/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../src/components/ui/table'
import { cn } from '../../../src/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanData {
  plan: string
  status: string
  amount_cents: number
  currency: string
  next_billing_date: string | null
  stripe_portal_url: string | null
}

interface Invoice {
  id: string
  date: string
  amount_cents: number
  status: string
  pdf_url: string | null
}

interface HistoryData {
  invoices: Invoice[]
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

const CURRENCY_FORMATTERS = new Map<string, Intl.NumberFormat>()

function formatCurrency(cents: number, currency: string): string {
  const upperCurrency = currency.toUpperCase()
  let formatter = CURRENCY_FORMATTERS.get(upperCurrency)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: upperCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    CURRENCY_FORMATTERS.set(upperCurrency, formatter)
  }
  return formatter.format(cents / 100)
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'Invalid Date'
  return DATE_FORMATTER.format(d)
}

function statusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
    case 'paid':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
    case 'past_due':
    case 'overdue':
      return 'border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20'
    case 'cancelled':
    case 'canceled':
      return 'border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted'
    default:
      return 'border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BillingPanel() {
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('mumega_auth_token') : null
    if (!token) {
      setError('Not authenticated. Please log in.')
      setLoading(false)
      return
    }

    Promise.all([
      apiFetch<PlanData>('/api/billing/plan'),
      apiFetch<HistoryData>('/api/billing/history'),
    ])
      .then(([planData, historyData]) => {
        setPlan(planData)
        setInvoices(Array.isArray(historyData.invoices) ? historyData.invoices : [])
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load billing data.')
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

  return (
    <div className="flex flex-col gap-7">
      {/* Current Plan */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-2">
              <div className="h-6 w-48 rounded bg-border opacity-50" />
              <div className="h-4 w-32 rounded bg-border opacity-50" />
            </div>
          ) : plan ? (
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold capitalize leading-none">
                    {plan.plan}
                  </span>
                  <Badge variant="outline" className={cn(statusBadgeClass(plan.status))}>
                    {plan.status}
                  </Badge>
                </div>
                <span className="font-mono text-3xl font-bold leading-none tracking-tight">
                  {formatCurrency(plan.amount_cents, plan.currency)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">/mo</span>
                </span>
                {plan.next_billing_date && (
                  <p className="text-xs text-muted-foreground">
                    Next billing: {formatDate(plan.next_billing_date)}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                disabled={!plan.stripe_portal_url}
                onClick={() => {
                  if (plan.stripe_portal_url) window.open(plan.stripe_portal_url, '_blank', 'noreferrer')
                }}
              >
                Manage Billing
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No plan data available.</p>
          )}
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Invoice History</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {loading ? (
            <p className="py-8 text-sm text-muted-foreground">Loading…</p>
          ) : invoices.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(inv.date)}
                    </TableCell>
                    <TableCell className="font-mono font-semibold whitespace-nowrap">
                      {plan ? formatCurrency(inv.amount_cents, plan.currency) : `$${(inv.amount_cents / 100).toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-xs', statusBadgeClass(inv.status))}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.pdf_url ? (
                        <a
                          href={inv.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
