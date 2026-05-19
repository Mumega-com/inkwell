-- Transparent Diagnostics Engine tables
-- Stores physics-based routing metrics (G/F/C) snapshots and alerts

CREATE TABLE IF NOT EXISTS diagnostics_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    squad_id TEXT NOT NULL,
    conductance REAL NOT NULL DEFAULT 0.5,
    force REAL NOT NULL DEFAULT 0.0,
    coherence REAL NOT NULL DEFAULT 0.5,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    cost_cents INTEGER DEFAULT 0,
    snapshot_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_diag_snap ON diagnostics_snapshots(tenant_id, squad_id, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS diagnostics_alerts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    squad_id TEXT NOT NULL,
    severity TEXT NOT NULL,
    narrative TEXT NOT NULL,
    acknowledged INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_diag_alerts ON diagnostics_alerts(tenant_id, acknowledged, created_at DESC);
