PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS community (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  initial TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
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
  token TEXT UNIQUE,
  description TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  inactive_at TEXT
);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  description TEXT,
  member_count INTEGER,
  work_status TEXT,
  work_due TEXT,
  unread INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'open',
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  archived_at TEXT
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
  reactions TEXT,
  client_id TEXT,
  edited_at TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE INDEX IF NOT EXISTS messages_channel_at ON messages(channel_id, at);
CREATE INDEX IF NOT EXISTS messages_thread_at ON messages(thread_id, at);
CREATE UNIQUE INDEX IF NOT EXISTS messages_author_client
  ON messages(author_id, client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_channel_lifecycle ON messages(channel_id, deleted_at, edited_at, at);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (message_id, member_id, emoji)
);

CREATE INDEX IF NOT EXISTS message_reactions_message ON message_reactions(message_id, created_at);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  uploader_id TEXT NOT NULL REFERENCES members(id),
  message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS attachments_message ON attachments(message_id, created_at);
CREATE INDEX IF NOT EXISTS attachments_channel ON attachments(channel_id, created_at);

CREATE TABLE IF NOT EXISTS channel_reads (
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  last_read_at TEXT NOT NULL,
  PRIMARY KEY (channel_id, member_id)
);

CREATE INDEX IF NOT EXISTS channels_lifecycle ON channels(group_name, visibility, status);
CREATE INDEX IF NOT EXISTS members_agent_status ON members(kind, status);

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

/* ---- Hosted-demo tenancy --------------------------------------------------
   The original tables above are retained for the card-file compatibility
   path. These tables are the issue #1 source of truth: a user owns one
   bearer identity, memberships carry the per-community role, and every
   chat/configuration row carries an explicit community id. Tokens are never
   stored in clear text in these tables. */

CREATE TABLE IF NOT EXISTS tenant_users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  initials TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'card',
  token_digest TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_communities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  term TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES tenant_users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_memberships (
  community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed', 'left')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  ended_at TEXT,
  ended_by TEXT,
  PRIMARY KEY (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS tenant_memberships_user ON tenant_memberships(user_id, status);

CREATE TABLE IF NOT EXISTS tenant_invites (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
  code_digest TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  mode TEXT NOT NULL DEFAULT 'reusable' CHECK (mode IN ('single-use', 'reusable')),
  max_uses INTEGER,
  uses INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES tenant_users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS tenant_invites_community ON tenant_invites(community_id, created_at);

CREATE TABLE IF NOT EXISTS tenant_channels (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('open', 'private')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  kind TEXT NOT NULL DEFAULT 'channel' CHECK (kind IN ('channel', 'dm')),
  dm_agent_id TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS tenant_channels_community ON tenant_channels(community_id, status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_channels_active_name
  ON tenant_channels(community_id, lower(name)) WHERE status = 'active' AND kind = 'channel';
CREATE UNIQUE INDEX IF NOT EXISTS tenant_channels_agent_dm
  ON tenant_channels(community_id, created_by, dm_agent_id) WHERE kind = 'dm' AND status = 'active';

CREATE TABLE IF NOT EXISTS tenant_channel_members (
  channel_id TEXT NOT NULL REFERENCES tenant_channels(id) ON DELETE CASCADE,
  community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  member_kind TEXT NOT NULL CHECK (member_kind IN ('user', 'agent')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (channel_id, member_id, member_kind)
);

CREATE INDEX IF NOT EXISTS tenant_channel_members_community ON tenant_channel_members(community_id, member_id);

CREATE TABLE IF NOT EXISTS tenant_agents (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  system_role TEXT CHECK (system_role IS NULL OR system_role = 'ada'),
  avatar_url TEXT,
  instructions TEXT NOT NULL,
  runtime TEXT NOT NULL CHECK (runtime IN ('claude', 'codex', 'pi')),
  model TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  runner_token_digest TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_agents_primary ON tenant_agents(community_id) WHERE system_role = 'ada';

CREATE INDEX IF NOT EXISTS tenant_agents_community ON tenant_agents(community_id, status, created_at);

CREATE TABLE IF NOT EXISTS tenant_messages (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES tenant_channels(id),
  author_id TEXT NOT NULL,
  author_kind TEXT NOT NULL CHECK (author_kind IN ('user', 'agent')),
  body TEXT NOT NULL,
  thread_id TEXT,
  client_id TEXT,
  created_at TEXT NOT NULL,
  edited_at TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_messages_client ON tenant_messages(community_id, author_id, client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tenant_messages_channel ON tenant_messages(community_id, channel_id, created_at);

CREATE TABLE IF NOT EXISTS tenant_threads (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES tenant_channels(id),
  root_message_id TEXT NOT NULL UNIQUE REFERENCES tenant_messages(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_cards (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES tenant_channels(id),
  author_id TEXT NOT NULL,
  path TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  body TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  replaces TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (community_id, author_id, path)
);

CREATE INDEX IF NOT EXISTS tenant_cards_channel ON tenant_cards(community_id, channel_id, created_at);

CREATE TABLE IF NOT EXISTS educational_artifacts (
  id TEXT PRIMARY KEY, community_id TEXT NOT NULL, channel_id TEXT NOT NULL REFERENCES tenant_channels(id),
  author_id TEXT NOT NULL, version INTEGER NOT NULL, content TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS educational_artifacts_channel ON educational_artifacts(community_id, channel_id);
CREATE TABLE IF NOT EXISTS educational_artifact_versions (
  artifact_id TEXT NOT NULL REFERENCES educational_artifacts(id), version INTEGER NOT NULL,
  content TEXT NOT NULL, editor_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(artifact_id, version)
);
CREATE TABLE IF NOT EXISTS educational_work (
  artifact_id TEXT NOT NULL REFERENCES educational_artifacts(id), user_id TEXT NOT NULL,
  answers TEXT NOT NULL, version INTEGER NOT NULL, artifact_version INTEGER NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY(artifact_id, user_id)
);
CREATE TABLE IF NOT EXISTS educational_submissions (
  id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL REFERENCES educational_artifacts(id), user_id TEXT NOT NULL,
  artifact_version INTEGER NOT NULL, work_version INTEGER NOT NULL, answers TEXT NOT NULL, created_at TEXT NOT NULL,
  feedback TEXT NOT NULL DEFAULT '', reviewed_at TEXT,
  UNIQUE(artifact_id, user_id, work_version)
);
CREATE TABLE IF NOT EXISTS personal_inbox_reads (
  community_id TEXT NOT NULL, user_id TEXT NOT NULL, message_id TEXT NOT NULL,
  PRIMARY KEY(community_id, user_id, message_id)
);


CREATE TABLE IF NOT EXISTS memory_jobs (
  id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL, user_id TEXT NOT NULL, channel_id TEXT, thread_id TEXT,
  source_id TEXT NOT NULL, source_version INTEGER NOT NULL, purpose TEXT NOT NULL CHECK(purpose IN ('respond', 'consolidate')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'done', 'failed')),
  run_id TEXT UNIQUE, lease_until TEXT, attempts INTEGER NOT NULL DEFAULT 0,
  supplied TEXT, fingerprint TEXT, error TEXT, answer_message_id TEXT,
  created_at TEXT NOT NULL, completed_at TEXT,
  UNIQUE(agent_id, source_id, source_version, purpose)
);
CREATE INDEX IF NOT EXISTS memory_jobs_pending ON memory_jobs(agent_id, status, created_at);
