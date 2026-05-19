-- Survey responses — one row per completed survey
CREATE TABLE IF NOT EXISTS survey_responses (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  answers TEXT NOT NULL,           -- JSON: Record<questionId, answer>
  score REAL,                      -- extracted NPS/CSAT score
  freetext TEXT,
  path TEXT NOT NULL,
  tenant TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(survey_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_responses_tenant ON survey_responses(tenant, created_at DESC);

-- Feature requests — aggregated voting targets
CREATE TABLE IF NOT EXISTS feature_requests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  vote_count INTEGER NOT NULL DEFAULT 0,
  tenant TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feature_requests_votes ON feature_requests(vote_count DESC);

-- Feature votes — one per visitor per feature (dedup)
CREATE TABLE IF NOT EXISTS feature_votes (
  id TEXT PRIMARY KEY,
  feature_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  visitor_hash TEXT NOT NULL,
  tenant TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(feature_id, visitor_hash)
);

-- Feedback classifications — LLM analysis results
CREATE TABLE IF NOT EXISTS feedback_classifications (
  response_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  sentiment TEXT NOT NULL,
  confidence REAL NOT NULL,
  summary TEXT NOT NULL,
  classified_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_class_category ON feedback_classifications(category);
