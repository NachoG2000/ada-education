import type { DatabaseSync } from "node:sqlite"

/** The schema version represented by schema.sql and the migrations below. */
export const LATEST_SCHEMA_VERSION = 4

const BACKFILL_TIME = "1970-01-01T00:00:00.000Z"

type Migration = {
  version: number
  apply: (database: DatabaseSync) => void
}

/** Upgrade an existing database in ordered, all-or-nothing transactions. */
export function migrateDatabase(database: DatabaseSync): void {
  const current = Number((database.prepare("PRAGMA user_version").get() as { user_version?: unknown }).user_version ?? 0)
  if (!Number.isInteger(current) || current < 0) throw new Error(`Invalid SQLite schema version: ${String(current)}`)
  if (current > LATEST_SCHEMA_VERSION) {
    throw new Error(`SQLite schema version ${current} is newer than this server supports (latest ${LATEST_SCHEMA_VERSION})`)
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue
    database.exec("BEGIN IMMEDIATE")
    try {
      migration.apply(database)
      database.exec(`PRAGMA user_version = ${migration.version}`)
      database.exec("COMMIT")
    } catch (error) {
      database.exec("ROLLBACK")
      throw error
    }
  }
}

const MIGRATIONS: Migration[] = [
  {
    version: 2,
    apply(database) {
      database.exec(`
        ALTER TABLE community ADD COLUMN updated_at TEXT NOT NULL DEFAULT '${BACKFILL_TIME}';

        ALTER TABLE members ADD COLUMN description TEXT;
        ALTER TABLE members ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
        ALTER TABLE members ADD COLUMN created_at TEXT NOT NULL DEFAULT '${BACKFILL_TIME}';
        ALTER TABLE members ADD COLUMN updated_at TEXT NOT NULL DEFAULT '${BACKFILL_TIME}';
        ALTER TABLE members ADD COLUMN inactive_at TEXT;

        ALTER TABLE channels ADD COLUMN visibility TEXT NOT NULL DEFAULT 'open';
        ALTER TABLE channels ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
        ALTER TABLE channels ADD COLUMN created_by TEXT;
        ALTER TABLE channels ADD COLUMN created_at TEXT NOT NULL DEFAULT '${BACKFILL_TIME}';
        ALTER TABLE channels ADD COLUMN updated_at TEXT NOT NULL DEFAULT '${BACKFILL_TIME}';
        ALTER TABLE channels ADD COLUMN archived_at TEXT;

        ALTER TABLE messages ADD COLUMN client_id TEXT;
        ALTER TABLE messages ADD COLUMN edited_at TEXT;
        ALTER TABLE messages ADD COLUMN deleted_at TEXT;
        ALTER TABLE messages ADD COLUMN deleted_by TEXT;

        CREATE TABLE message_reactions (
          message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
          member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          emoji TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (message_id, member_id, emoji)
        );

        CREATE TABLE attachments (
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

        CREATE TABLE channel_reads (
          channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
          member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          last_read_at TEXT NOT NULL,
          PRIMARY KEY (channel_id, member_id)
        );

        CREATE UNIQUE INDEX messages_author_client
          ON messages(author_id, client_id)
          WHERE client_id IS NOT NULL;
        CREATE INDEX channels_lifecycle ON channels(group_name, visibility, status);
        CREATE INDEX members_agent_status ON members(kind, status);
        CREATE INDEX message_reactions_message ON message_reactions(message_id, created_at);
        CREATE INDEX attachments_message ON attachments(message_id, created_at);
        CREATE INDEX attachments_channel ON attachments(channel_id, created_at);
        CREATE INDEX messages_channel_lifecycle ON messages(channel_id, deleted_at, edited_at, at);
      `)

      // Existing rows receive stable values so opening the same database twice
      // never changes its contents merely because a migration ran.
      database.exec(`
        UPDATE community SET updated_at = '${BACKFILL_TIME}' WHERE updated_at IS NULL;
        UPDATE members SET created_at = '${BACKFILL_TIME}' WHERE created_at IS NULL;
        UPDATE members SET updated_at = '${BACKFILL_TIME}' WHERE updated_at IS NULL;
        UPDATE channels SET visibility = CASE WHEN group_name = 'private' THEN 'private' ELSE 'open' END;
        UPDATE channels SET status = 'active' WHERE status IS NULL OR status = '';
        UPDATE channels
        SET created_by = COALESCE(
          created_by,
          (SELECT id FROM members WHERE kind = 'person' AND role = 'teacher' ORDER BY id LIMIT 1),
          (SELECT id FROM members WHERE kind = 'person' ORDER BY id LIMIT 1)
        );
        UPDATE channels SET created_at = '${BACKFILL_TIME}' WHERE created_at IS NULL;
        UPDATE channels SET updated_at = '${BACKFILL_TIME}' WHERE updated_at IS NULL;
      `)
    },
  },
  {
    version: 3,
    apply(database) {
      /* Issue #1 tenancy. Keep this DDL in the migration as well as
         schema.sql: existing local databases must be upgraded without a
         destructive reset. */
      database.exec(`
        CREATE TABLE IF NOT EXISTS tenant_users (
          id TEXT PRIMARY KEY, display_name TEXT NOT NULL, initials TEXT NOT NULL,
          tone TEXT NOT NULL DEFAULT 'card', token_digest TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tenant_communities (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, term TEXT NOT NULL,
          created_by TEXT NOT NULL REFERENCES tenant_users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tenant_memberships (
          community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed', 'left')),
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL, ended_at TEXT, ended_by TEXT,
          PRIMARY KEY (community_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS tenant_memberships_user ON tenant_memberships(user_id, status);
        CREATE TABLE IF NOT EXISTS tenant_invites (
          id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
          code_digest TEXT NOT NULL UNIQUE, role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
          max_uses INTEGER, uses INTEGER NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL REFERENCES tenant_users(id), created_at TEXT NOT NULL, expires_at TEXT
        );
        CREATE INDEX IF NOT EXISTS tenant_invites_community ON tenant_invites(community_id, created_at);
        CREATE TABLE IF NOT EXISTS tenant_channels (
          id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
          name TEXT NOT NULL, description TEXT, visibility TEXT NOT NULL CHECK (visibility IN ('open', 'private')),
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
          kind TEXT NOT NULL DEFAULT 'channel' CHECK (kind IN ('channel', 'dm')), dm_agent_id TEXT,
          created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT
        );
        CREATE INDEX IF NOT EXISTS tenant_channels_community ON tenant_channels(community_id, status, created_at);
        CREATE UNIQUE INDEX IF NOT EXISTS tenant_channels_active_name ON tenant_channels(community_id, lower(name))
          WHERE status = 'active' AND kind = 'channel';
        CREATE UNIQUE INDEX IF NOT EXISTS tenant_channels_agent_dm ON tenant_channels(community_id, created_by, dm_agent_id)
          WHERE kind = 'dm' AND status = 'active';
        CREATE TABLE IF NOT EXISTS tenant_channel_members (
          channel_id TEXT NOT NULL REFERENCES tenant_channels(id) ON DELETE CASCADE,
          community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
          member_id TEXT NOT NULL, member_kind TEXT NOT NULL CHECK (member_kind IN ('user', 'agent')),
          created_at TEXT NOT NULL, PRIMARY KEY (channel_id, member_id)
        );
        CREATE INDEX IF NOT EXISTS tenant_channel_members_community ON tenant_channel_members(community_id, member_id);
        CREATE TABLE IF NOT EXISTS tenant_agents (
          id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
          name TEXT NOT NULL, avatar_url TEXT, instructions TEXT NOT NULL,
          runtime TEXT NOT NULL CHECK (runtime IN ('claude', 'codex')), model TEXT NOT NULL DEFAULT '',
          created_by TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
          runner_token_digest TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, deleted_by TEXT
        );
        CREATE INDEX IF NOT EXISTS tenant_agents_community ON tenant_agents(community_id, status, created_at);
        CREATE TABLE IF NOT EXISTS tenant_messages (
          id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
          channel_id TEXT NOT NULL REFERENCES tenant_channels(id), author_id TEXT NOT NULL,
          author_kind TEXT NOT NULL CHECK (author_kind IN ('user', 'agent')), body TEXT NOT NULL,
          thread_id TEXT, client_id TEXT, created_at TEXT NOT NULL, edited_at TEXT, deleted_at TEXT, deleted_by TEXT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS tenant_messages_client ON tenant_messages(community_id, author_id, client_id)
          WHERE client_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS tenant_messages_channel ON tenant_messages(community_id, channel_id, created_at);
        CREATE TABLE IF NOT EXISTS tenant_threads (
          id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
          channel_id TEXT NOT NULL REFERENCES tenant_channels(id), root_message_id TEXT NOT NULL UNIQUE REFERENCES tenant_messages(id),
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tenant_cards (
          id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
          channel_id TEXT NOT NULL REFERENCES tenant_channels(id), author_id TEXT NOT NULL, path TEXT NOT NULL,
          title TEXT NOT NULL, type TEXT NOT NULL, body TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
          replaces TEXT, created_at TEXT NOT NULL, UNIQUE (community_id, author_id, path)
        );
        CREATE INDEX IF NOT EXISTS tenant_cards_channel ON tenant_cards(community_id, channel_id, created_at);
      `)
    },
  },
  {
    version: 4,
    apply(database) {
      /* The original tenant membership key omitted member_kind. Rebuild the
         small join table so a user and agent with the same external id cannot
         collide, while retaining all rows on upgrade. */
      database.exec(`
        CREATE TABLE tenant_channel_members_v4 (
          channel_id TEXT NOT NULL REFERENCES tenant_channels(id) ON DELETE CASCADE,
          community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
          member_id TEXT NOT NULL,
          member_kind TEXT NOT NULL CHECK (member_kind IN ('user', 'agent')),
          created_at TEXT NOT NULL,
          PRIMARY KEY (channel_id, member_id, member_kind)
        );
        INSERT OR IGNORE INTO tenant_channel_members_v4 (channel_id, community_id, member_id, member_kind, created_at)
          SELECT channel_id, community_id, member_id, member_kind, created_at FROM tenant_channel_members;
        DROP TABLE tenant_channel_members;
        ALTER TABLE tenant_channel_members_v4 RENAME TO tenant_channel_members;
        CREATE INDEX tenant_channel_members_community ON tenant_channel_members(community_id, member_id);
      `)
    },
  },
]
