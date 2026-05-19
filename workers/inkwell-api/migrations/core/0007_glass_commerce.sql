-- Glass Commerce Engine tables
CREATE TABLE IF NOT EXISTS glass_transactions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    stripe_tx_id TEXT UNIQUE,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    tx_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    settled_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_glass_tx_tenant ON glass_transactions(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS glass_royalties (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES glass_transactions(id),
    recipient_type TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT DEFAULT 'unpaid',
    payout_date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_glass_royalty_tx ON glass_royalties(transaction_id);

CREATE TABLE IF NOT EXISTS glass_metering (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    billing_cycle_start TEXT NOT NULL,
    recorded_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_glass_meter_tenant ON glass_metering(tenant_id, billing_cycle_start);
