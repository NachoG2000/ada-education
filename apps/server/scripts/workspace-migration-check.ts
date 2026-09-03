import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { openDatabase } from "../src/db.js"
import { seedCourse } from "../src/seed.js"

const scratch = mkdtempSync(join(tmpdir(), "ada-workspace-migration-"))
const legacyPath = join(scratch, "legacy.db")
const seededPath = join(scratch, "seeded.db")
const courseDir = join(scratch, "course")

try {
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
  assert.equal((migrated.prepare("PRAGMA user_version").get() as { user_version: number }).user_version, 2)
  assert.equal((migrated.prepare("SELECT visibility FROM channels WHERE id = 'private-room'").get() as { visibility: string }).visibility, "private")
  assert.equal((migrated.prepare("SELECT token FROM members WHERE id = 'teacher'").get() as { token: string }).token, "person-live-token")
  migrated.close()

  const reopened = openDatabase(legacyPath)
  assert.equal((reopened.prepare("PRAGMA user_version").get() as { user_version: number }).user_version, 2, "second boot leaves the migration complete")
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
