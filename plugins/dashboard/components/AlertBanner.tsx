import { useState } from 'react'

interface Alert {
  id: string
  type: string
  message: string
  severity: 'info' | 'warn' | 'critical'
}

interface AlertBannerProps {
  alerts: Alert[]
  apiUrl: string
  authToken: string
  tenantSlug: string
}

const severityClasses = {
  info: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  warn: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  critical: 'border-red-500/40 bg-red-500/10 text-red-300',
}

export default function AlertBanner({ alerts, apiUrl, authToken, tenantSlug }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [accepting, setAccepting] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const visible = alerts.filter(a => !dismissed.has(a.id))
  if (visible.length === 0) return null

  async function acceptRisk(alertId: string) {
    await fetch(`${apiUrl}/api/dashboard/alerts/${alertId}/accept-risk`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenant_slug: tenantSlug, reason }),
    })
    setDismissed(prev => new Set([...prev, alertId]))
    setAccepting(null)
    setReason('')
  }

  return (
    <div className="space-y-2 mb-6">
      {visible.map(alert => (
        <div key={alert.id} className={`border rounded-lg p-3 text-sm ${severityClasses[alert.severity]}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <span className="font-medium uppercase text-xs tracking-wider opacity-70">{alert.type}</span>
              <p className="mt-0.5">{alert.message}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setAccepting(accepting === alert.id ? null : alert.id)}
                className="text-xs border border-current/30 rounded px-2 py-1 opacity-80 hover:opacity-100"
              >
                Accept Risk
              </button>
              <button
                onClick={() => setDismissed(prev => new Set([...prev, alert.id]))}
                className="text-xs opacity-50 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          </div>
          {accepting === alert.id && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="Reason (optional)"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="flex-1 bg-black/20 border border-current/20 rounded px-2 py-1 text-xs text-current placeholder-current/40"
              />
              <button
                onClick={() => acceptRisk(alert.id)}
                className="text-xs border border-current/40 rounded px-3 py-1 hover:bg-current/10"
              >
                Confirm
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
