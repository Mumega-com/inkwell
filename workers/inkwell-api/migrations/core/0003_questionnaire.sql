-- Daily business questionnaire system
-- Stores questions sent to the owner and their answers

CREATE TABLE IF NOT EXISTS questionnaire_responses (
  id TEXT PRIMARY KEY,
  question_index INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  answer TEXT,
  answered_at TEXT,
  sent_at TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'sms'
);

CREATE INDEX IF NOT EXISTS idx_questionnaire_sent_at ON questionnaire_responses (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_questionnaire_unanswered ON questionnaire_responses (answer, sent_at DESC);
