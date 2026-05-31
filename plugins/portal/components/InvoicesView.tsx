import { useState, useEffect } from 'react'
import { getCurrencyFormatter } from '../../../src/lib/formatters'

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  slug: string
}

type InvoiceStatus = 'paid' | 'pending' | 'failed'

interface Invoice {
  id: string
  date: string
  description: string
  amount: number
  currency?: string
  status: InvoiceStatus | string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    credentials: 'include',
  })
}

function formatCurrency(amount: number, currency = 'CAD'): string {
  return getCurrencyFormatter(currency, 'en-CA', { minimumFractionDigits: 2 }).format(amount)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  let color: string
  let borderColor: string
  let label: string

  switch (status) {
    case 'paid':
      color = '#4ade80'
      borderColor = 'rgba(74,222,128,0.3)'
      label = 'Paid'
      break
    case 'failed':
      color = '#f87171'
      borderColor = 'rgba(248,113,113,0.3)'
      label = 'Failed'
      break
    default: // pending
      color = '#fbbf24'
      borderColor = 'rgba(251,191,36,0.3)'
      label = 'Pending'
  }

  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: '600',
        color,
        border: `1px solid ${borderColor}`,
        borderRadius: '4px',
        padding: '2px 7px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InvoicesView({ slug }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/portal/invoices')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setInvoices((data as { invoices?: Invoice[] }).invoices ?? [])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug])

  const paidTotal = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0)

  const currency = invoices[0]?.currency ?? 'CAD'

  if (loading) {
    return (
      <div style={{ padding: '24px 16px', color: 'var(--ink-muted)', fontSize: '14px' }}>
        Loading invoices…
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 16px 16px' }}>
      <h2
        style={{
          fontSize: '16px',
          fontWeight: '600',
          color: 'var(--ink-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          margin: '0 0 20px',
        }}
      >
        Invoices
      </h2>

      {/* Total summary */}
      {invoices.length > 0 && (
        <div
          style={{
            background: 'var(--ink-surface)',
            border: '1px solid var(--ink-border)',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--ink-muted)', fontWeight: '500' }}>
            Total paid
          </span>
          <span
            style={{
              fontSize: '18px',
              fontWeight: '700',
              color: 'var(--ink-primary)',
              fontFamily: 'monospace',
            }}
          >
            {formatCurrency(paidTotal, currency)}
          </span>
        </div>
      )}

      {invoices.length === 0 ? (
        <div
          style={{
            background: 'var(--ink-surface)',
            border: '1px solid var(--ink-border)',
            borderRadius: '12px',
            padding: '32px 20px',
            textAlign: 'center',
          }}
        >
          <p style={{ color: 'var(--ink-muted)', fontSize: '15px', margin: '0' }}>
            No invoices on file yet.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              style={{
                background: 'var(--ink-surface)',
                border: '1px solid var(--ink-border)',
                borderRadius: '10px',
                padding: '14px 16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '10px',
                  marginBottom: '8px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: 'var(--ink-text)',
                      margin: '0 0 4px',
                      lineHeight: '1.3',
                    }}
                  >
                    {invoice.description}
                  </p>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--ink-muted)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {formatDate(invoice.date)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '6px',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: '15px',
                      fontWeight: '600',
                      fontFamily: 'monospace',
                      color: invoice.status === 'paid' ? 'var(--ink-primary)' : 'var(--ink-text)',
                    }}
                  >
                    {formatCurrency(invoice.amount, invoice.currency ?? currency)}
                  </span>
                  <StatusBadge status={invoice.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
