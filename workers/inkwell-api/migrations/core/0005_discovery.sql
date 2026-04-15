CREATE TABLE IF NOT EXISTS business_profiles (
  id TEXT PRIMARY KEY,
  business_name TEXT,
  industry TEXT,
  answers JSON NOT NULL,
  scores JSON,
  readiness_score INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS business_plans (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  title TEXT DEFAULT '90-Day Growth Plan',
  total_steps INTEGER,
  completed_steps INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES business_profiles(id)
);

CREATE TABLE IF NOT EXISTS plan_steps (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  module_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  week INTEGER,
  order_index INTEGER,
  status TEXT DEFAULT 'locked',
  completed_at TEXT,
  FOREIGN KEY (plan_id) REFERENCES business_plans(id)
);
