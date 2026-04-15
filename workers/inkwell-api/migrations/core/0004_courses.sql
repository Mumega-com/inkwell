CREATE TABLE IF NOT EXISTS course_enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  course_slug TEXT NOT NULL,
  purchased_at TEXT NOT NULL,
  stripe_session_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(student_id, course_slug)
);

CREATE TABLE IF NOT EXISTS course_progress (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  course_slug TEXT NOT NULL,
  lesson_slug TEXT NOT NULL,
  completed_at TEXT,
  quiz_score INTEGER,
  UNIQUE(student_id, course_slug, lesson_slug)
);

CREATE TABLE IF NOT EXISTS course_certificates (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  course_slug TEXT NOT NULL,
  student_name TEXT NOT NULL,
  issued_at TEXT DEFAULT (datetime('now')),
  certificate_number TEXT UNIQUE NOT NULL
);
