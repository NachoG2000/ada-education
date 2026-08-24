PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS community (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  initial TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('person', 'agent')),
  name TEXT NOT NULL,
  initials TEXT,
  tone TEXT,
  role TEXT,
  scope TEXT,
  created_by TEXT,
  figure_seed TEXT,
  figure_color TEXT,
  instructions TEXT,
  provider_mode TEXT,
  provider_model TEXT,
  runtime TEXT,
  model TEXT,
  token TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  description TEXT,
  member_count INTEGER,
  work_status TEXT,
  work_due TEXT,
  unread INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, member_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  author_id TEXT NOT NULL REFERENCES members(id),
  at TEXT NOT NULL,
  paragraphs TEXT NOT NULL,
  thread_id TEXT,
  from_card TEXT,
  publishes TEXT,
  reactions TEXT
);

CREATE INDEX IF NOT EXISTS messages_channel_at ON messages(channel_id, at);
CREATE INDEX IF NOT EXISTS messages_thread_at ON messages(thread_id, at);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  root_message_id TEXT NOT NULL UNIQUE REFERENCES messages(id),
  published_card_id TEXT
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES members(id),
  path TEXT NOT NULL,
  version INTEGER NOT NULL,
  visibility TEXT NOT NULL,
  sources TEXT NOT NULL,
  replaces TEXT,
  base INTEGER,
  state TEXT,
  published_at TEXT NOT NULL,
  body TEXT NOT NULL,
  UNIQUE (author_id, path)
);

/* ---- Modules, assignments, feedback and reports (DECISIONS.md §16) ------- */

CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  idx INTEGER NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  objectives TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  status TEXT NOT NULL,
  revision TEXT
);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  size INTEGER,
  path TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS materials_module ON materials(module_id);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES modules(id),
  channel_id TEXT NOT NULL REFERENCES channels(id),
  title TEXT NOT NULL,
  due TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id),
  student_id TEXT NOT NULL REFERENCES members(id),
  agent_id TEXT NOT NULL REFERENCES members(id),
  at TEXT NOT NULL,
  body TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS feedback_student ON feedback(student_id);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES members(id),
  student_id TEXT NOT NULL REFERENCES members(id),
  module_id TEXT NOT NULL REFERENCES modules(id),
  assignment_id TEXT REFERENCES assignments(id),
  at TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  reconciled TEXT
);

CREATE INDEX IF NOT EXISTS reports_student ON reports(student_id);

-- Single-use invite links (membership gating; DECISIONS.md §20). A used invite
-- keeps its row: who joined through it is part of the course's audit trail.
CREATE TABLE IF NOT EXISTS invites (
  token TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
  created_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  used_by TEXT REFERENCES members(id),
  used_at TEXT
);
