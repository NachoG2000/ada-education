import { randomUUID } from "node:crypto"
import type { DatabaseSync } from "node:sqlite"
import type { Context, Hono, Env } from "hono"
import { z } from "zod"
import { artifactWriteSchema, workInputSchema, type CourseArtifact, type ArtifactWork, type ArtifactSubmission } from "@ada/protocol"
import { canReadTenantChannel } from "./tenant.js"
import { WorkspaceError } from "./workspace-errors.js"

type Viewer = { user: { id: string }; communityId: string; role: "teacher" | "student" }
type Row = Record<string, any>
const missing = () => new WorkspaceError("not_found", "This resource is unavailable")
const conflict = () => new WorkspaceError("conflict", "This content changed. Reload the latest version before saving; your draft has been kept.")
const project = (row: Row): CourseArtifact => ({ id: row.id, communityId: row.community_id, channelId: row.channel_id, authorId: row.author_id, version: row.version, content: JSON.parse(row.content), createdAt: row.created_at, updatedAt: row.updated_at })

export function registerEducationRoutes<E extends Env>(app: Hono<E>, db: DatabaseSync, authorize: (c: Context) => Viewer, failure: (c: Context, e: unknown) => Response) {
  const base = "/api/communities/:communityId"
  function channel(v: Viewer, channelId: string, edit = false) {
    if (!canReadTenantChannel(db, v.communityId, channelId, v.user.id)) throw missing()
    const row = db.prepare("SELECT * FROM tenant_channels WHERE id = ? AND community_id = ?").get(channelId, v.communityId) as Row
    if (edit) {
      if (row.status !== "active") throw new WorkspaceError("channel_archived", "This conversation is read-only")
      if (row.kind === "dm" ? row.created_by !== v.user.id : v.role !== "teacher") throw new WorkspaceError("forbidden", "Only the teacher can manage shared artifacts; personal artifacts belong to the DM owner")
    }
    return row
  }
  function artifact(v: Viewer, artifactId: string, edit = false) {
    const row = db.prepare("SELECT * FROM educational_artifacts WHERE id = ? AND community_id = ? AND deleted_at IS NULL").get(artifactId, v.communityId) as Row | undefined
    if (!row) throw missing()
    channel(v, row.channel_id, edit)
    return row
  }
  function getWork(v: Viewer, a: Row): ArtifactWork {
    const row = db.prepare("SELECT * FROM educational_work WHERE artifact_id = ? AND user_id = ?").get(a.id, v.user.id) as Row | undefined
    return { artifactId: a.id, userId: v.user.id, answers: row ? JSON.parse(row.answers) : {}, version: row?.version ?? 0, artifactVersion: row?.artifact_version ?? a.version, updatedAt: row?.updated_at ?? null }
  }
  function canWork(v: Viewer, a: Row) {
    const c = channel(v, a.channel_id)
    if (c.status !== "active") throw new WorkspaceError("channel_archived", "This conversation is read-only")
    if (c.kind === "dm" && c.created_by !== v.user.id) throw new WorkspaceError("forbidden", "Only the conversation owner can save personal work")
  }
  app.get(`${base}/channels/:channelId/artifacts`, (c) => {
    try { const v = authorize(c); channel(v, c.req.param("channelId")); return c.json((db.prepare("SELECT * FROM educational_artifacts WHERE community_id = ? AND channel_id = ? AND deleted_at IS NULL ORDER BY created_at, id").all(v.communityId, c.req.param("channelId")) as Row[]).map(project)) } catch (e) { return failure(c, e) }
  })
  app.post(`${base}/channels/:channelId/artifacts`, async (c) => {
    try {
      const { content } = artifactWriteSchema.parse(await c.req.json())
      const v = authorize(c); const channelId = c.req.param("channelId"); channel(v, channelId, true)
      const id = `artifact-${randomUUID()}`; const now = new Date().toISOString()
      db.exec("BEGIN IMMEDIATE")
      try {
        db.prepare("INSERT INTO educational_artifacts VALUES (?, ?, ?, ?, 1, ?, ?, ?, NULL)").run(id, v.communityId, channelId, v.user.id, JSON.stringify(content), now, now)
        db.prepare("INSERT INTO educational_artifact_versions VALUES (?, 1, ?, ?, ?)").run(id, JSON.stringify(content), v.user.id, now)
        db.exec("COMMIT")
      } catch (e) { db.exec("ROLLBACK"); throw e }
      return c.json(project(artifact(v, id)), 201)
    } catch (e) { return failure(c, e) }
  })
  app.get(`${base}/artifacts/:artifactId`, (c) => {
    try { return c.json(project(artifact(authorize(c), c.req.param("artifactId")))) } catch (e) { return failure(c, e) }
  })
  app.get(`${base}/artifacts/:artifactId/versions`, (c) => {
    try {
      const a = artifact(authorize(c), c.req.param("artifactId"))
      return c.json((db.prepare("SELECT * FROM educational_artifact_versions WHERE artifact_id = ? ORDER BY version DESC").all(a.id) as Row[]).map((r) => project({ ...a, version: r.version, content: r.content, updated_at: r.created_at })))
    } catch (e) { return failure(c, e) }
  })
  app.put(`${base}/artifacts/:artifactId`, async (c) => {
    try {
      const body = artifactWriteSchema.parse(await c.req.json())
      const v = authorize(c); const a = artifact(v, c.req.param("artifactId"), true)
      if (body.version === undefined || body.version !== a.version) throw conflict()
      const now = new Date().toISOString(); db.exec("BEGIN IMMEDIATE")
      try {
        const changed = db.prepare("UPDATE educational_artifacts SET content = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?").run(JSON.stringify(body.content), now, a.id, body.version)
        if (!changed.changes) throw conflict()
        db.prepare("INSERT INTO educational_artifact_versions VALUES (?, ?, ?, ?, ?)").run(a.id, body.version + 1, JSON.stringify(body.content), v.user.id, now)
        db.exec("COMMIT")
      } catch (e) { db.exec("ROLLBACK"); throw e }
      return c.json(project(artifact(v, a.id)))
    } catch (e) { return failure(c, e) }
  })
  app.delete(`${base}/artifacts/:artifactId`, (c) => {
    try { const a = artifact(authorize(c), c.req.param("artifactId"), true); db.prepare("UPDATE educational_artifacts SET deleted_at = ? WHERE id = ?").run(new Date().toISOString(), a.id); return c.json({ ok: true }) } catch (e) { return failure(c, e) }
  })
  app.get(`${base}/artifacts/:artifactId/work`, (c) => {
    try { const v = authorize(c); return c.json(getWork(v, artifact(v, c.req.param("artifactId")))) } catch (e) { return failure(c, e) }
  })
  app.put(`${base}/artifacts/:artifactId/work`, async (c) => {
    try {
      const body = workInputSchema.parse(await c.req.json())
      const v = authorize(c); const a = artifact(v, c.req.param("artifactId")); canWork(v, a); const current = getWork(v, a)
      if (body.version !== current.version || body.artifactVersion !== a.version) throw conflict()
      const ids = new Set(project(a).content.prompts.map((p) => p.id))
      if (Object.keys(body.answers).some((key) => !ids.has(key))) throw new WorkspaceError("invalid_input", "An answer belongs to a removed prompt")
      db.prepare("INSERT INTO educational_work VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(artifact_id, user_id) DO UPDATE SET answers = excluded.answers, version = excluded.version, artifact_version = excluded.artifact_version, updated_at = excluded.updated_at").run(a.id, v.user.id, JSON.stringify(body.answers), current.version + 1, a.version, new Date().toISOString())
      return c.json(getWork(v, a))
    } catch (e) { return failure(c, e) }
  })
  app.get(`${base}/artifacts/:artifactId/submissions`, (c) => {
    try {
      const v = authorize(c); const a = artifact(v, c.req.param("artifactId")); const rows = db.prepare("SELECT s.*, u.display_name FROM educational_submissions s JOIN tenant_users u ON u.id = s.user_id WHERE s.artifact_id = ? ORDER BY s.created_at DESC").all(a.id) as Row[]
      return c.json(rows.filter((r) => v.role === "teacher" || r.user_id === v.user.id).map((r): ArtifactSubmission => ({ id: r.id, artifactId: r.artifact_id, userId: r.user_id, displayName: r.display_name, artifactVersion: r.artifact_version, answers: JSON.parse(r.answers), createdAt: r.created_at, feedback: r.feedback, reviewedAt: r.reviewed_at })))
    } catch (e) { return failure(c, e) }
  })
  app.post(`${base}/artifacts/:artifactId/submissions`, async (c) => {
    try {
      const { version } = z.object({ version: z.number().int().positive() }).strict().parse(await c.req.json())
      const v = authorize(c); const a = artifact(v, c.req.param("artifactId")); canWork(v, a); const work = getWork(v, a)
      if (project(a).content.kind !== "assignment" || !Object.values(work.answers).some((text) => text.trim())) throw new WorkspaceError("invalid_input", "Save assignment work before submitting")
      if (work.version !== version || work.artifactVersion !== a.version) throw conflict()
      db.prepare("INSERT OR IGNORE INTO educational_submissions (id, artifact_id, user_id, artifact_version, work_version, answers, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(`submission-${randomUUID()}`, a.id, v.user.id, a.version, work.version, JSON.stringify(work.answers), new Date().toISOString())
      return c.json({ ok: true }, 201)
    } catch (e) { return failure(c, e) }
  })
  app.put(`${base}/artifacts/:artifactId/submissions/:submissionId`, async (c) => {
    try {
      const { feedback } = z.object({ feedback: z.string().trim().min(1).max(20_000) }).strict().parse(await c.req.json())
      const v = authorize(c); const a = artifact(v, c.req.param("artifactId")); if (v.role !== "teacher") throw new WorkspaceError("forbidden", "Only teachers can review submissions")
      canWork(v, a)
      const result = db.prepare("UPDATE educational_submissions SET feedback = ?, reviewed_at = ? WHERE artifact_id = ? AND id = ?").run(feedback, new Date().toISOString(), a.id, c.req.param("submissionId"))
      if (!result.changes) throw missing()
      return c.json({ ok: true })
    } catch (e) { return failure(c, e) }
  })
  app.get(`${base}/inbox/reads`, (c) => {
    try { const v = authorize(c); return c.json((db.prepare("SELECT message_id FROM personal_inbox_reads WHERE community_id = ? AND user_id = ?").all(v.communityId, v.user.id) as Row[]).map((r) => r.message_id)) } catch (e) { return failure(c, e) }
  })
  app.put(`${base}/inbox/reads`, async (c) => {
    try {
      const { messageId, read } = z.object({ messageId: z.string().min(1).max(200), read: z.boolean() }).strict().parse(await c.req.json())
      const v = authorize(c)
      const message = db.prepare("SELECT channel_id FROM tenant_messages WHERE id = ? AND community_id = ?").get(messageId, v.communityId) as Row | undefined
      if (!message) throw missing(); channel(v, message.channel_id)
      if (read) db.prepare("INSERT OR IGNORE INTO personal_inbox_reads VALUES (?, ?, ?)").run(v.communityId, v.user.id, messageId)
      else db.prepare("DELETE FROM personal_inbox_reads WHERE community_id = ? AND user_id = ? AND message_id = ?").run(v.communityId, v.user.id, messageId)
      return c.json({ ok: true })
    } catch (e) { return failure(c, e) }
  })
}
