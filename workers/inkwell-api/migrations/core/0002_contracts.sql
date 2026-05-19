CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  reference TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, sent, viewed, signed, active, delivered, completed

  -- Customer
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,

  -- Shipment
  vehicle_description TEXT,
  origin TEXT,
  destination TEXT,
  service_type TEXT, -- shared, container, roro

  -- Pricing
  rate REAL,
  currency TEXT DEFAULT 'CAD',
  payment_terms TEXT,
  service_inclusions TEXT,

  -- Insurance
  insurance_type TEXT, -- all_risk, total_loss, declined
  insurance_rate REAL,
  insurance_cost REAL,

  -- Signatures
  signed_by TEXT,
  signed_at TEXT,
  signed_ip TEXT,

  -- Tracking
  created_at TEXT DEFAULT (datetime('now')),
  sent_at TEXT,
  viewed_at TEXT,
  delivered_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_contracts_status
  ON contracts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contracts_email
  ON contracts (customer_email);

CREATE TABLE IF NOT EXISTS contract_milestones (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  step INTEGER NOT NULL,
  label TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, active, completed
  completed_at TEXT,
  note TEXT,
  FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

CREATE INDEX IF NOT EXISTS idx_contract_milestones_contract
  ON contract_milestones (contract_id, step);
