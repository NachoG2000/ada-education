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
