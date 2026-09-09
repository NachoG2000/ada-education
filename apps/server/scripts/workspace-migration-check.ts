import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { openDatabase } from "../src/db.js"
import { LATEST_SCHEMA_VERSION } from "../src/migrations.js"
import { seedCourse } from "../src/seed.js"

const scratch = mkdtempSync(join(tmpdir(), "ada-workspace-migration-"))
const legacyPath = join(scratch, "legacy.db")
const seededPath = join(scratch, "seeded.db")
const courseDir = join(scratch, "course")

try {
  const v7Path = join(scratch, "v7.db")
  const v7 = new DatabaseSync(v7Path)
  v7.exec(readFileSync(new URL("../src/schema.sql", import.meta.url), "utf8").replace(/  system_role TEXT.*\n/, "").replace(/CREATE UNIQUE INDEX IF NOT EXISTS tenant_agents_primary.*\n/, "").replace("runtime IN ('claude', 'codex', 'pi')", "runtime IN ('claude', 'codex')"))
  v7.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA user_version = 7;
    INSERT INTO tenant_users (id, display_name, initials, token_digest, created_at, updated_at) VALUES ('u', 'Teacher', 'T', 'user-digest', 'then', 'then');
    INSERT INTO tenant_communities VALUES ('c', 'Course', 'Term', 'u', 'then', 'then');
    INSERT INTO tenant_agents VALUES ('a', 'c', 'Course tutor', 'avatar', 'Rules', 'codex', 'model', 'u', 'active', 'runner-digest', 'then', 'now', NULL, NULL);
    INSERT INTO tenant_agents VALUES ('deleted', 'c', 'Old tutor', NULL, 'Old rules', 'claude', '', 'u', 'deleted', 'old-digest', 'then', 'now', 'now', 'u');
  `)
  const originalAgents = v7.prepare("SELECT * FROM tenant_agents ORDER BY id").all()
  v7.close()
  const upgraded = openDatabase(v7Path)
  assert.deepEqual(upgraded.prepare("SELECT * FROM tenant_agents ORDER BY id").all().map((row) => ({ ...row })), originalAgents.map((row) => ({ ...row, name: row.id === "a" ? "Ada" : row.name, system_role: row.id === "a" ? "ada" : null })), "v8/v9 preserve agent identity, rules and digests while branding the primary tutor")
  upgraded.prepare("UPDATE tenant_agents SET runtime = 'pi' WHERE id = 'a'").run()
  assert.throws(() => upgraded.prepare("UPDATE tenant_agents SET runtime = 'unknown' WHERE id = 'a'").run(), /CHECK constraint/)
  assert.deepEqual(upgraded.prepare("PRAGMA foreign_key_check").all(), [])
  assert(upgraded.prepare("SELECT name FROM sqlite_master WHERE name = 'tenant_agents_community'").get(), "v8 restores the agent index")
  upgraded.close()
  const upgradedAgain = openDatabase(v7Path)
  assert.equal(upgradedAgain.prepare("SELECT runtime FROM tenant_agents WHERE id = 'a'").get()?.runtime, "pi", "Pi survives reopening the migrated database")
  upgradedAgain.close()

  const legacy = new DatabaseSync(legacyPath)
  legacy.exec(`
    PRAGMA user_version = 1;
    CREATE TABLE community (id TEXT PRIMARY KEY, name TEXT NOT NULL, subtitle TEXT NOT NULL, initial TEXT NOT NULL);
    CREATE TABLE members (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, initials TEXT, tone TEXT, role TEXT,
      scope TEXT, created_by TEXT, figure_seed TEXT, figure_color TEXT, instructions TEXT,
      provider_mode TEXT, provider_model TEXT, runtime TEXT, model TEXT, token TEXT UNIQUE
    );
    CREATE TABLE channels (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, group_name TEXT NOT NULL, description TEXT,
      member_count INTEGER, work_status TEXT, work_due TEXT, unread INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY, channel_id TEXT NOT NULL REFERENCES channels(id),
      author_id TEXT NOT NULL REFERENCES members(id), at TEXT NOT NULL, paragraphs TEXT NOT NULL,
      thread_id TEXT, from_card TEXT, publishes TEXT, reactions TEXT
    );
    INSERT INTO community VALUES ('legacy', 'Legacy', 'Course', 'L');
    INSERT INTO members (id, kind, name, initials, role, token) VALUES ('teacher', 'person', 'Teacher', 'T', 'teacher', 'person-live-token');
    INSERT INTO channels (id, name, group_name) VALUES ('private-room', 'Private room', 'private');
  `)
  legacy.close()

  const migrated = openDatabase(legacyPath)
  assert.equal((migrated.prepare("PRAGMA user_version").get() as { user_version: number }).user_version, LATEST_SCHEMA_VERSION)
  assert.equal((migrated.prepare("SELECT visibility FROM channels WHERE id = 'private-room'").get() as { visibility: string }).visibility, "private")
  assert.equal((migrated.prepare("SELECT token FROM members WHERE id = 'teacher'").get() as { token: string }).token, "person-live-token")
  assert.equal((migrated.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('tenant_invites') WHERE name IN ('mode', 'revoked_at')").get() as { count: number }).count, 2, "invite management columns migrate together")
  assert.equal((migrated.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('members') WHERE name = 'avatar_url'").get() as { count: number }).count, 1, "retained agents gain the shared avatar field")
  migrated.close()

  const reopened = openDatabase(legacyPath)
  assert.equal((reopened.prepare("PRAGMA user_version").get() as { user_version: number }).user_version, LATEST_SCHEMA_VERSION, "second boot leaves the migration complete")
  assert.equal((reopened.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('channels') WHERE name = 'visibility'").get() as { count: number }).count, 1, "second boot does not duplicate migrated columns")
  reopened.close()

  const config = {
    id: "seed-check",
    name: "Seed check",
    subtitle: "Workspace",
    initial: "S",
    channels: [{ id: "questions", name: "Questions", group: "course" }],
    people: [{ id: "teacher", name: "Teacher", initials: "T", tone: "card", role: "teacher" }],
    agents: [{ id: "ada", name: "Ada", scope: "community", createdBy: "teacher", instructions: "Help", channelIds: ["questions"], token: "committed-token", runtime: "scripted" }],
  }
  // seedCourse only needs community.json when the fixture has no base docs or
  // materials, so this is a deliberately tiny real seed rather than a mock.
  mkdirSync(courseDir, { recursive: true })
  writeFileSync(join(courseDir, "community.json"), JSON.stringify(config))
  seedCourse({ courseDir, dbPath: seededPath })

  const live = openDatabase(seededPath)
  assert.equal((live.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('tenant_invites') WHERE name IN ('mode', 'revoked_at')").get() as { count: number }).count, 2, "fresh databases match the migrated invite shape")
  live.prepare("UPDATE members SET token = ? WHERE id = 'ada'").run("rotated-live-token")
  live.prepare("INSERT INTO channels (id, name, group_name, visibility, status, created_by) VALUES ('dynamic', 'Dynamic', 'course', 'open', 'active', 'teacher')").run()
  live.prepare("INSERT INTO channel_members (channel_id, member_id) VALUES ('dynamic', 'teacher')").run()
  live.close()

  seedCourse({ courseDir, dbPath: seededPath })
  const reseeded = openDatabase(seededPath)
  assert.equal((reseeded.prepare("SELECT token FROM members WHERE id = 'ada'").get() as { token: string }).token, "rotated-live-token", "re-seeding preserves a rotated agent token")
  assert(reseeded.prepare("SELECT 1 FROM channels WHERE id = 'dynamic'").get(), "re-seeding preserves dynamically-created channels")
  assert(reseeded.prepare("SELECT 1 FROM channel_members WHERE channel_id = 'dynamic' AND member_id = 'teacher'").get(), "re-seeding preserves dynamic memberships")
  reseeded.close()

  console.log("Workspace migration/seed checks passed")
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
