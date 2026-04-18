import { Hono } from 'hono'
import type { AppBindings } from '../types'

export const diagnosticsRoutes = new Hono<AppBindings>()

// ── Types ────────────────────────────────────────────────────────────────────

type Severity = 'INFO' | 'WARNING' | 'ACTION_REQUIRED'

interface SquadHealth {
  squad_id: string
  name: string
  conductance: number
  force: number
  coherence: number
  tasks_completed: number
  tasks_failed: number
  success_rate: number
  idle_days: number
}

interface SnapshotRow {
  squad_id: string
  conductance: number
  force: number
  coherence: number
  tasks_completed: number
  tasks_failed: number
  snapshot_date: string
}

interface AlertRow {
  id: string
  squad_id: string
  severity: string
  narrative: string
  acknowledged: number
  created_at: string
}

// ── Narrative templates (deterministic, no LLM) ─────────────────────────────

function getSeverity(squad: SquadHealth): Severity {
  if (squad.conductance < 0.3) return 'ACTION_REQUIRED'
  if (squad.idle_days > 7) return 'ACTION_REQUIRED'
  if (squad.conductance < 0.7) return 'WARNING'
  if (squad.success_rate < 70 && squad.tasks_completed + squad.tasks_failed > 0) return 'WARNING'
  return 'INFO'
}

function generateNarrative(squad: SquadHealth): string {
  if (squad.conductance >= 0.7) {
    return `Your ${squad.name} squad is performing well. Conductance is at ${squad.conductance.toFixed(1)}, and it completed ${squad.tasks_completed} tasks recently.`
  }
  if (squad.conductance >= 0.3) {
    const action = squad.tasks_failed > 3
      ? 'Review recent task failures for patterns.'
      : 'Monitor closely — performance may recover on its own.'
    return `Your ${squad.name} squad's conductance dropped to ${squad.conductance.toFixed(1)}. ${action}`
  }
  const action = squad.idle_days > 7
    ? `It has been idle for ${squad.idle_days} days. Consider updating the task queue or adjusting the squad's skills.`
    : `Recent task success rate is ${squad.success_rate}%. Review the squad's configuration.`
  return `Your ${squad.name} squad has stalled — conductance is at ${squad.conductance.toFixed(1)}. ${action}`
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTenantId(c: { get: (key: 'tenant_slug') => string | null }): string {
  return c.get('tenant_slug') ?? 'default'
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/diagnostics/health — Squad health overview for tenant
diagnosticsRoutes.get('/health', async (c) => {
  const tenantId = getTenantId(c)
  const db = c.get('db_core')

  const latestSnapshots = await db.query<SnapshotRow>(`
    SELECT s.squad_id, s.conductance, s.force, s.coherence,
           s.tasks_completed, s.tasks_failed, s.snapshot_date
    FROM diagnostics_snapshots s
    INNER JOIN (
      SELECT squad_id, MAX(snapshot_date) AS max_date
      FROM diagnostics_snapshots
      WHERE tenant_id = ?
      GROUP BY squad_id
    ) latest ON s.squad_id = latest.squad_id AND s.snapshot_date = latest.max_date
    WHERE s.tenant_id = ?
  `, [tenantId, tenantId])

  const today = new Date()
  const squads = latestSnapshots.map((row) => {
    const totalTasks = row.tasks_completed + row.tasks_failed
    const successRate = totalTasks > 0
      ? Math.round((row.tasks_completed / totalTasks) * 100)
      : 100
    const snapshotDate = new Date(row.snapshot_date)
    const idleDays = Math.floor((today.getTime() - snapshotDate.getTime()) / (1000 * 60 * 60 * 24))

    const squad: SquadHealth = {
      squad_id: row.squad_id,
      name: row.squad_id,
      conductance: row.conductance,
      force: row.force,
      coherence: row.coherence,
      tasks_completed: row.tasks_completed,
      tasks_failed: row.tasks_failed,
      success_rate: successRate,
      idle_days: idleDays,
    }

    return {
      squad_id: squad.squad_id,
      name: squad.name,
      conductance: squad.conductance,
      force: squad.force,
      coherence: squad.coherence,
      severity: getSeverity(squad),
      narrative: generateNarrative(squad),
      tasks_completed: squad.tasks_completed,
      tasks_failed: squad.tasks_failed,
      success_rate: squad.success_rate,
      idle_days: squad.idle_days,
      snapshot_date: row.snapshot_date,
    }
  })

  return c.json({ tenant_id: tenantId, squads })
})

// GET /api/diagnostics/squad/:id/history — 30-day time series for a squad
diagnosticsRoutes.get('/squad/:id/history', async (c) => {
  const tenantId = getTenantId(c)
  const squadId = c.req.param('id')
  const since = daysAgoIso(30)
  const db = c.get('db_core')

  const snapshots = await db.query<SnapshotRow>(`
    SELECT snapshot_date, conductance, force, coherence,
           tasks_completed, tasks_failed
    FROM diagnostics_snapshots
    WHERE tenant_id = ? AND squad_id = ? AND snapshot_date >= ?
    ORDER BY snapshot_date ASC
  `, [tenantId, squadId, since])

  return c.json({
    tenant_id: tenantId,
    squad_id: squadId,
    period_days: 30,
    snapshots,
  })
})

// GET /api/diagnostics/alerts — Unacknowledged alerts
diagnosticsRoutes.get('/alerts', async (c) => {
  const tenantId = getTenantId(c)
  const db = c.get('db_core')

  const alerts = await db.query<AlertRow>(`
    SELECT id, squad_id, severity, narrative, acknowledged, created_at
    FROM diagnostics_alerts
    WHERE tenant_id = ? AND acknowledged = 0
    ORDER BY
      CASE severity
        WHEN 'ACTION_REQUIRED' THEN 0
        WHEN 'WARNING' THEN 1
        WHEN 'INFO' THEN 2
      END,
      created_at DESC
  `, [tenantId])

  return c.json({
    tenant_id: tenantId,
    alerts,
  })
})

// POST /api/diagnostics/alerts/:id/acknowledge — Dismiss an alert
diagnosticsRoutes.post('/alerts/:id/acknowledge', async (c) => {
  const tenantId = getTenantId(c)
  const alertId = c.req.param('id')
  const db = c.get('db_core')

  const result = await db.execute(`
    UPDATE diagnostics_alerts
    SET acknowledged = 1
    WHERE id = ? AND tenant_id = ?
  `, [alertId, tenantId])

  if (result.changes === 0) {
    return c.json({ error: 'Alert not found or already acknowledged' }, 404)
  }

  return c.json({ success: true, alert_id: alertId })
})
