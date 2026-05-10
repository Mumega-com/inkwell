import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

interface Workflow {
  id: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
  schedule?: string
  tags: string[]
}

interface Run {
  id: string
  status: 'success' | 'error' | 'running' | 'waiting'
  startedAt: string
  finishedAt?: string
  durationMs?: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

function cronLabel(expr: string): string {
  if (expr === '0 * * * *') return 'Every hour'
  if (expr === '0 6 * * *') return 'Daily at 6:00 AM'
  if (expr === '0 9 * * *') return 'Daily at 9:00 AM'
  if (expr === '0 9 * * 1-5') return 'Weekdays at 9:00 AM'
  if (expr === '0 0 * * 0') return 'Weekly on Sunday'
  if (expr === '0 0 1 * *') return 'Monthly on the 1st'
  return expr
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

const STATUS_ICON: Record<string, string> = {
  success: '✓',
  error: '✗',
  running: '↻',
  waiting: '◷',
}

const STATUS_COLOR: Record<string, string> = {
  success: '#22c55e',
  error: '#ef4444',
  running: '#f59e0b',
  waiting: '#6b7280',
}

// ── Card ───────────────────────────────────────────────────────────────────

interface WorkflowCardProps {
  workflow: Workflow
  apiUrl: string
  token: string
  tenantSlug: string
  onToggle: (id: string, newActive: boolean) => void
  onScheduleUpdate: (id: string, cron: string) => void
}

function WorkflowCard({
  workflow,
  apiUrl,
  token,
  tenantSlug,
  onToggle,
  onScheduleUpdate,
}: WorkflowCardProps) {
  const [runs, setRuns] = useState<Run[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [runsLoaded, setRunsLoaded] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [scheduleInput, setScheduleInput] = useState(workflow.schedule ?? '')
  const [scheduleSaving, setScheduleSaving] = useState(false)

  const headers = { Authorization: `Bearer ${token}` }

  // Lazily load the most recent runs when card first renders
  useEffect(() => {
    if (runsLoaded) return
    setRunsLoading(true)
    fetch(
      `${apiUrl}/api/dashboard/workflows/${workflow.id}/runs?tenant_slug=${tenantSlug}&limit=10`,
      { headers },
    )
      .then(r => r.json())
      .then(data => {
        setRuns((data as { runs: Run[] }).runs ?? [])
        setRunsLoaded(true)
        setRunsLoading(false)
      })
      .catch(() => setRunsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleToggle() {
    setToggling(true)
    try {
      const res = await fetch(
        `${apiUrl}/api/dashboard/workflows/${workflow.id}/toggle?tenant_slug=${tenantSlug}`,
        { method: 'POST', headers },
      )
      if (res.ok) {
        const data = await res.json() as { id: string; active: boolean }
        onToggle(data.id, data.active)
      }
    } finally {
      setToggling(false)
    }
  }

  async function handleScheduleSave() {
    if (!scheduleInput.trim()) return
    setScheduleSaving(true)
    try {
      const res = await fetch(
        `${apiUrl}/api/dashboard/workflows/${workflow.id}/schedule?tenant_slug=${tenantSlug}`,
        {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ cronExpression: scheduleInput.trim() }),
        },
      )
      if (res.ok) {
        onScheduleUpdate(workflow.id, scheduleInput.trim())
        setEditingSchedule(false)
      }
    } finally {
      setScheduleSaving(false)
    }
  }

  const lastRun = runs[0]

  return (
    <div style={{
      background: 'var(--ink-surface)',
      border: '1px solid var(--ink-border)',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '12px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <span style={{ color: 'var(--ink-text)', fontWeight: 600, fontSize: '15px', flex: 1 }}>
          {workflow.name}
        </span>

        {/* Status badge / toggle */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'transparent',
            border: `1px solid ${workflow.active ? '#22c55e40' : 'var(--ink-border)'}`,
            borderRadius: '20px',
            padding: '4px 10px',
            cursor: toggling ? 'wait' : 'pointer',
            color: workflow.active ? '#22c55e' : 'var(--ink-muted)',
            fontSize: '13px',
            transition: 'all 0.15s',
          }}
        >
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: workflow.active ? '#22c55e' : 'var(--ink-muted)',
            display: 'inline-block',
          }} />
          {workflow.active ? 'Active' : 'Inactive'}
        </button>
      </div>

      {/* Schedule row */}
      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {workflow.schedule && !editingSchedule && (
          <>
            <span style={{ color: 'var(--ink-muted)', fontSize: '13px' }}>
              Schedule: <span style={{ color: 'var(--ink-text)' }}>{cronLabel(workflow.schedule)}</span>
            </span>
            <button
              onClick={() => { setScheduleInput(workflow.schedule ?? ''); setEditingSchedule(true) }}
              style={{
                background: 'transparent',
                border: '1px solid var(--ink-border)',
                borderRadius: '4px',
                padding: '2px 8px',
                color: 'var(--ink-muted)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Edit
            </button>
          </>
        )}

        {!workflow.schedule && !editingSchedule && (
          <button
            onClick={() => { setScheduleInput(''); setEditingSchedule(true) }}
            style={{
              background: 'transparent',
              border: '1px dashed var(--ink-border)',
              borderRadius: '4px',
              padding: '2px 8px',
              color: 'var(--ink-dim)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            + Add schedule
          </button>
        )}

        {editingSchedule && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <input
              value={scheduleInput}
              onChange={e => setScheduleInput(e.target.value)}
              placeholder="e.g. 0 9 * * 1-5"
              style={{
                background: 'var(--ink-bg)',
                border: '1px solid var(--ink-border)',
                borderRadius: '4px',
                padding: '4px 8px',
                color: 'var(--ink-text)',
                fontSize: '13px',
                width: '180px',
              }}
            />
            <button
              onClick={handleScheduleSave}
              disabled={scheduleSaving || !scheduleInput.trim()}
              style={{
                background: 'var(--ink-primary)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 10px',
                color: 'var(--ink-bg)',
                fontSize: '12px',
                cursor: scheduleSaving ? 'wait' : 'pointer',
                fontWeight: 600,
              }}
            >
              {scheduleSaving ? '...' : 'Save'}
            </button>
            <button
              onClick={() => setEditingSchedule(false)}
              style={{
                background: 'transparent',
                border: '1px solid var(--ink-border)',
                borderRadius: '4px',
                padding: '4px 10px',
                color: 'var(--ink-muted)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Last run status */}
      <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--ink-muted)' }}>
        {runsLoading && <span>Loading run history...</span>}
        {!runsLoading && lastRun && (
          <span>
            Last run:{' '}
            <span style={{ color: STATUS_COLOR[lastRun.status] }}>
              {STATUS_ICON[lastRun.status]} {lastRun.status}
            </span>{' '}
            — {relativeTime(lastRun.startedAt)}
          </span>
        )}
        {!runsLoading && runsLoaded && !lastRun && (
          <span style={{ color: 'var(--ink-dim)' }}>No runs yet</span>
        )}
      </div>

      {/* Run history toggle */}
      {runsLoaded && runs.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          <button
            onClick={() => setExpanded(prev => !prev)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: 'var(--ink-muted)',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ transform: expanded ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>▶</span>
            {expanded ? 'Hide' : `Show ${runs.length} runs`}
          </button>

          {expanded && (
            <div style={{ marginTop: '8px', overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--ink-muted)', borderBottom: '1px solid var(--ink-border)' }}>
                    <th style={{ textAlign: 'left', padding: '4px 8px 4px 0' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px' }}>Started</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px' }}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map(run => (
                    <tr key={run.id} style={{ borderBottom: '1px solid var(--ink-border)', opacity: 0.7 }}>
                      <td style={{ padding: '4px 8px 4px 0', color: STATUS_COLOR[run.status] }}>
                        {STATUS_ICON[run.status]} {run.status}
                      </td>
                      <td style={{ padding: '4px 8px', color: 'var(--ink-muted)' }}>
                        {relativeTime(run.startedAt)}
                      </td>
                      <td style={{ padding: '4px 8px', color: 'var(--ink-muted)' }}>
                        {run.durationMs !== undefined ? formatDuration(run.durationMs) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {workflow.tags.length > 0 && (
        <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {workflow.tags.map(tag => (
            <span
              key={tag}
              style={{
                background: 'var(--ink-bg)',
                border: '1px solid var(--ink-border)',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '11px',
                color: 'var(--ink-dim)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Panel ─────────────────────────────────────────────────────────────

export default function WorkflowsPanel() {
  const [apiUrl, setApiUrl] = useState('')
  const [token, setToken] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const url = localStorage.getItem('mumega_api_url') || 'https://portal.mumega.com'
    const tok = localStorage.getItem('mumega_auth_token') ?? ''
    const slug = localStorage.getItem('mumega_tenant_slug') ?? ''
    setApiUrl(url)
    setToken(tok)
    setTenantSlug(slug)

    if (!tok || !slug) {
      setError('API credentials not configured')
      setLoading(false)
      return
    }

    fetch(`${url}/api/dashboard/workflows?tenant_slug=${slug}`, {
      headers: { Authorization: `Bearer ${tok}` },
    })
      .then(async r => {
        if (r.status === 404) {
          const body = await r.json() as { error?: string }
          if (body.error === 'no_automation_configured') {
            setError('no_automation_configured')
          } else {
            setError('Failed to load workflows')
          }
          setLoading(false)
          return
        }
        if (!r.ok) {
          setError('Failed to load workflows')
          setLoading(false)
          return
        }
        const data = await r.json() as { workflows: Workflow[] }
        setWorkflows(data.workflows ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load workflows')
        setLoading(false)
      })
  }, [])

  const handleToggle = useCallback((id: string, newActive: boolean) => {
    setWorkflows(prev => prev.map(wf => wf.id === id ? { ...wf, active: newActive } : wf))
  }, [])

  const handleScheduleUpdate = useCallback((id: string, cron: string) => {
    setWorkflows(prev => prev.map(wf => wf.id === id ? { ...wf, schedule: cron } : wf))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-muted)' }}>
        Loading workflows...
      </div>
    )
  }

  if (error === 'no_automation_configured') {
    return (
      <div style={{
        padding: '32px',
        textAlign: 'center',
        color: 'var(--ink-muted)',
        background: 'var(--ink-surface)',
        border: '1px solid var(--ink-border)',
        borderRadius: '8px',
      }}>
        <div style={{ fontSize: '24px', marginBottom: '12px' }}>⟳</div>
        <div style={{ color: 'var(--ink-text)', fontWeight: 600, marginBottom: '8px' }}>
          No automation provider configured
        </div>
        <div style={{ fontSize: '14px', marginBottom: '16px' }}>
          Add your n8n instance in Settings to connect your workflows.
        </div>
        <a
          href="/dashboard/settings"
          style={{
            display: 'inline-block',
            background: 'var(--ink-primary)',
            color: 'var(--ink-bg)',
            padding: '8px 16px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          Go to Settings
        </a>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#ef4444' }}>
        {error}
      </div>
    )
  }

  const activeCount = workflows.filter(wf => wf.active).length

  return (
    <div>
      {/* Summary bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div style={{
          background: 'var(--ink-surface)',
          border: '1px solid var(--ink-border)',
          borderRadius: '8px',
          padding: '16px',
        }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--ink-primary)' }}>
            {workflows.length}
          </div>
          <div style={{ color: 'var(--ink-muted)', fontSize: '13px', marginTop: '4px' }}>
            Total Workflows
          </div>
        </div>
        <div style={{
          background: 'var(--ink-surface)',
          border: '1px solid var(--ink-border)',
          borderRadius: '8px',
          padding: '16px',
        }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#22c55e' }}>
            {activeCount}
          </div>
          <div style={{ color: 'var(--ink-muted)', fontSize: '13px', marginTop: '4px' }}>
            Active
          </div>
        </div>
        <div style={{
          background: 'var(--ink-surface)',
          border: '1px solid var(--ink-border)',
          borderRadius: '8px',
          padding: '16px',
        }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--ink-text)' }}>
            {workflows.length - activeCount}
          </div>
          <div style={{ color: 'var(--ink-muted)', fontSize: '13px', marginTop: '4px' }}>
            Inactive
          </div>
        </div>
      </div>

      {/* Workflow cards */}
      {workflows.length === 0 ? (
        <p style={{ color: 'var(--ink-muted)', fontSize: '14px' }}>
          No workflows found in your automation provider.
        </p>
      ) : (
        <div>
          {workflows.map(wf => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              apiUrl={apiUrl}
              token={token}
              tenantSlug={tenantSlug}
              onToggle={handleToggle}
              onScheduleUpdate={handleScheduleUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
