import { useState, useEffect } from 'react'

interface Session {
  id: string
  identity_id: string
  contact_value: string
  ip: string | null
  created_at: string
  expires_at: string
  revoked_at: string | null
}

interface RiskAcceptance {
  id: string
  actor_id: string
  alert_type: string
  reason: string | null
  accepted_at: string
}

interface ComplianceSummary {
  activeSessions: number
  termsSigned: number
  totalIdentities: number
  identitiesVerified: number
  agreementCoverage: number
  riskAcceptances: number
}

export default function CompliancePanel() {
  const [apiUrl, setApiUrl] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [summary, setSummary] = useState<ComplianceSummary | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [riskLog, setRiskLog] = useState<RiskAcceptance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const url = localStorage.getItem('mumega_api_url') ?? ''
    const token = localStorage.getItem('mumega_auth_token') ?? ''
    const slug = localStorage.getItem('mumega_tenant_slug') ?? ''
    setApiUrl(url)
    setAuthToken(token)
    setTenantSlug(slug)

    if (!url || !token || !slug) {
      setError('API credentials not configured')
      setLoading(false)
      return
    }

    const headers = { 'Authorization': `Bearer ${token}` }

    Promise.all([
      fetch(`${url}/api/dashboard/compliance-summary?tenant_slug=${slug}`, { headers }).then(r => r.json()),
      fetch(`${url}/api/dashboard/sessions?tenant_slug=${slug}&include_revoked=false`, { headers }).then(r => r.json()),
      fetch(`${url}/api/dashboard/risk-acceptances?tenant_slug=${slug}`, { headers }).then(r => r.json()),
    ]).then(([summaryData, sessionsData, riskData]) => {
      setSummary(summaryData as ComplianceSummary)
      setSessions((sessionsData as { sessions: Session[] }).sessions ?? [])
      setRiskLog((riskData as { acceptances: RiskAcceptance[] }).acceptances ?? [])
      setLoading(false)
    }).catch(() => {
      setError('Failed to load compliance data')
      setLoading(false)
    })
  }, [])

  async function revokeSession(sessionId: string) {
    const headers = { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
    await fetch(`${apiUrl}/api/dashboard/sessions/${sessionId}/revoke`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tenant_slug: tenantSlug }),
    })
    setSessions(prev => prev.filter(s => s.id !== sessionId))
  }

  if (loading) return <div className="text-ink-muted p-8 text-center">Loading compliance data...</div>
  if (error) return <div className="text-red-400 p-8 text-center">{error}</div>

  return (
    <div className="space-y-8">
      {/* Summary bar */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-ink-surface border border-ink-border rounded-lg p-4">
            <div className="text-2xl font-bold text-ink-primary">{summary.activeSessions}</div>
            <div className="text-ink-muted text-sm mt-1">Active Sessions</div>
          </div>
          <div className="bg-ink-surface border border-ink-border rounded-lg p-4">
            <div className="text-2xl font-bold text-ink-primary">{summary.agreementCoverage}%</div>
            <div className="text-ink-muted text-sm mt-1">Terms Signed ({summary.termsSigned}/{summary.totalIdentities})</div>
          </div>
          <div className="bg-ink-surface border border-ink-border rounded-lg p-4">
            <div className="text-2xl font-bold text-ink-primary">{summary.identitiesVerified}</div>
            <div className="text-ink-muted text-sm mt-1">ID Verified</div>
          </div>
        </div>
      )}

      {/* Active Sessions */}
      <section>
        <h2 className="text-lg font-semibold text-ink-text mb-4">Active Sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-ink-muted text-sm">No active sessions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-muted border-b border-ink-border">
                  <th className="text-left py-2 pr-4">Contact</th>
                  <th className="text-left py-2 pr-4">IP</th>
                  <th className="text-left py-2 pr-4">Created</th>
                  <th className="text-left py-2 pr-4">Expires</th>
                  <th className="text-left py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} className="border-b border-ink-border/50">
                    <td className="py-2 pr-4 text-ink-text">{s.contact_value}</td>
                    <td className="py-2 pr-4 text-ink-muted">{s.ip ?? '—'}</td>
                    <td className="py-2 pr-4 text-ink-muted">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td className="py-2 pr-4 text-ink-muted">{new Date(s.expires_at).toLocaleDateString()}</td>
                    <td className="py-2">
                      <button
                        onClick={() => revokeSession(s.id)}
                        className="text-red-400 hover:text-red-300 text-xs border border-red-400/30 rounded px-2 py-1"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Agreement Coverage */}
      {summary && (
        <section>
          <h2 className="text-lg font-semibold text-ink-text mb-4">Agreement Coverage</h2>
          <div className="bg-ink-surface border border-ink-border rounded-lg p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-ink-muted">Portal Terms Signed</span>
              <span className="text-ink-text">{summary.termsSigned} / {summary.totalIdentities}</span>
            </div>
            <div className="w-full bg-ink-border rounded-full h-2">
              <div
                className="bg-ink-primary h-2 rounded-full transition-all"
                style={{ width: `${summary.agreementCoverage}%` }}
              />
            </div>
            <div className="text-xs text-ink-muted mt-1">{summary.agreementCoverage}% coverage</div>
          </div>
        </section>
      )}

      {/* Risk Acceptance Log */}
      <section>
        <h2 className="text-lg font-semibold text-ink-text mb-4">Risk Acceptance Log</h2>
        {riskLog.length === 0 ? (
          <p className="text-ink-muted text-sm">No risk decisions logged.</p>
        ) : (
          <div className="space-y-2">
            {riskLog.map(r => (
              <div key={r.id} className="bg-ink-surface border border-ink-border rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-text font-medium">{r.alert_type}</span>
                  <span className="text-ink-muted">{new Date(r.accepted_at).toLocaleDateString()}</span>
                </div>
                {r.reason && <div className="text-ink-muted mt-1">{r.reason}</div>}
                <div className="text-ink-dim text-xs mt-1">by {r.actor_id}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
