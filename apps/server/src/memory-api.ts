import type { DatabaseSync } from "node:sqlite"
import type { Context, Env, Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { memorySourceInputSchema } from "@ada/protocol"
import { CourseMemory } from "./memory.js"
import { extractMemoryText } from "./memory-ingest.js"
import { WorkspaceError } from "./workspace-errors.js"
import { queueMemorySource } from "./memory-jobs.js"

type Viewer = { user: { id: string }; communityId: string; role: "teacher" | "student" }
export function registerMemoryRoutes<E extends Env>(app: Hono<E>, db: DatabaseSync, authorize: (c: Context) => Viewer, failure: (c: Context, error: unknown) => Response): void {
  const base = "/api/communities/:communityId/memory"
  const service = (c: Context) => {
    const viewer = authorize(c)
    const memory = new CourseMemory(db, viewer.communityId)
    return { viewer, memory, audience: memory.actor(viewer.user.id) }
  }
  app.get(base, (c) => {
    try {
      const { memory, audience } = service(c)
      return c.json(memory.snapshot(audience))
    } catch (error) { return failure(c, error) }
  })
  app.get(`${base}/jobs`, (c) => {
    try {
      const { memory, audience } = service(c)
      const rows = db.prepare("SELECT id, source_id AS sourceId, source_version AS sourceVersion, channel_id AS channelId, thread_id AS threadId, user_id AS userId, purpose, status, error, created_at AS createdAt FROM memory_jobs WHERE community_id = ? ORDER BY created_at DESC LIMIT 200").all(memory.communityId) as Array<{ sourceId: string; userId: string }>
      const teacher = authorize(c).role === "teacher"
      return c.json(rows.filter((job) => { try { memory.sourceFor(audience, job.sourceId); return true } catch { return false } }).map(({ userId, ...job }) => ({ ...job, canRetry: teacher || userId === audience.userId })))
    } catch (error) { return failure(c, error) }
  })
  app.post(`${base}/jobs/:jobId/retry`, (c) => {
    try {
      const { memory, audience } = service(c)
      const job = db.prepare("SELECT source_id, user_id, status FROM memory_jobs WHERE community_id = ? AND id = ?").get(memory.communityId, c.req.param("jobId")) as { source_id: string; user_id: string; status: string } | undefined
      if (!job) throw new WorkspaceError("not_found", "Processing job not found")
      memory.sourceFor(audience, job.source_id)
      if (authorize(c).role !== "teacher" && job.user_id !== audience.userId) throw new WorkspaceError("forbidden", "Only the requester or a teacher can retry this job")
      if (job.status !== "failed") throw new WorkspaceError("conflict", "Only failed jobs can be retried")
      db.prepare("UPDATE memory_jobs SET status = 'pending', run_id = NULL, error = NULL WHERE id = ?").run(c.req.param("jobId"))
      return c.json({ ok: true })
    } catch (error) { return failure(c, error) }
  })
  app.post(`${base}/sources`, bodyLimit({ maxSize: 11 * 1024 * 1024 }), async (c) => {
    try {
      if (authorize(c).role !== "teacher") throw new WorkspaceError("forbidden", "Only teachers can upload study sources")
      const form = await c.req.formData()
      const file = form.get("file")
      if (!(file instanceof File)) throw new WorkspaceError("invalid_input", "Choose a study source file")
      const input = memorySourceInputSchema.parse(JSON.parse(String(form.get("metadata") ?? "{}")))
      const raw = new Uint8Array(await file.arrayBuffer())
      const extracted = await extractMemoryText(file.name, raw)
      // Membership is checked again after asynchronous extraction.
      const { viewer, memory } = service(c)
      const source = memory.ingest(viewer.user.id, { ...input, filename: file.name, raw, ...extracted })
      queueMemorySource(db, source)
      return c.json({ source }, 201)
    } catch (error) { return failure(c, error) }
  })
  app.get(`${base}/sources/:sourceId`, (c) => {
    try {
      const { memory, audience } = service(c)
      const version = c.req.query("version") ? Number(c.req.query("version")) : undefined
      const source = memory.sourceFor(audience, c.req.param("sourceId"), version)
      return c.json({ source, text: memory.files.text(source) })
    } catch (error) { return failure(c, error) }
  })
  app.get(`${base}/sources/:sourceId/raw`, (c) => {
    try {
      const { memory, audience } = service(c)
      const source = memory.sourceFor(audience, c.req.param("sourceId"), c.req.query("version") ? Number(c.req.query("version")) : undefined)
      return new Response(new Uint8Array(memory.files.raw(source)), { headers: {
        "Content-Type": "application/octet-stream", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(source.filename)}`,
      } })
    } catch (error) { return failure(c, error) }
  })
  app.post(`${base}/sources/:sourceId/revoke`, async (c) => {
    try {
      const input = await c.req.json<{ expectedVersion: number }>()
      const { viewer, memory } = service(c)
      return c.json({ source: memory.revoke(viewer.user.id, c.req.param("sourceId"), input.expectedVersion) })
    } catch (error) { return failure(c, error) }
  })
  app.post(`${base}/proposals`, async (c) => {
    try {
      const input: unknown = await c.req.json()
      const { memory, audience } = service(c)
      return c.json({ record: memory.propose(audience, input) }, 201)
    } catch (error) { return failure(c, error) }
  })
  app.post(`${base}/records/:recordId/review`, async (c) => {
    try {
      const input: unknown = await c.req.json()
      const { viewer, memory } = service(c)
      return c.json({ record: memory.review(viewer.user.id, c.req.param("recordId"), input) })
    } catch (error) { return failure(c, error) }
  })
  app.get(`${base}/records/:recordId/history`, (c) => {
    try {
      const { memory, audience } = service(c)
      const current = memory.files.record(c.req.param("recordId"))
      if (!current || !memory.canReadRecord(audience, current)) throw new WorkspaceError("not_found", "Memory not found")
      const records = Array.from({ length: current.revision }, (_, index) => memory.files.record(current.id, index + 1)!).filter((record) => memory.canReadRecord(audience, record))
      return c.json({ records })
    } catch (error) { return failure(c, error) }
  })
  app.get(`${base}/records/:recordId/okf`, (c) => {
    try {
      const { memory, audience } = service(c)
      const record = memory.files.record(c.req.param("recordId"))
      if (!record || !memory.canReadRecord(audience, record)) throw new WorkspaceError("not_found", "Memory not found")
      return c.text(memory.files.okf(record), 200, { "Content-Disposition": `attachment; filename="${record.id}.md"`, "Cache-Control": "private, no-store" })
    } catch (error) { return failure(c, error) }
  })
}
