import type { DatabaseSync } from "node:sqlite"

/** The schema version represented by schema.sql and the migrations below. */
export const LATEST_SCHEMA_VERSION = 2

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
]
