import { randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { basename, dirname, resolve, sep } from "node:path"
import { Hono } from "hono"
import type { Context } from "hono"
import type { DatabaseSync } from "node:sqlite"
import { messageBlockSchema, cardPublishInputSchema } from "@ada/protocol"
import type { DifficultyLevel, Material, MentionIntent, Message, Module, Report, Thread } from "@ada/protocol"
import {
  addMaterial,
  createMessage,
  createThread,
  getAssignment,
  getCommunitySnapshot,
  getMember,
  getModule,
  getReport,
  publishCard,
  reconcileReport,
  repoRoot,
  setModuleStatus,
  updateModule,
  type AuthoredCardPublishInput,
  type MessageInput,
  type ModulePatch,
  type PublishedCard,
  type SeedMaterial,
} from "./db.js"

const MATERIAL_KINDS: Material["kind"][] = ["markdown", "pdf", "slides", "link"]
const DIFFICULTY_LEVELS: DifficultyLevel[] = ["intro", "core", "advanced"]

/** A file name as uploaded: one path segment, no traversal, a sane charset.
    Anything else is rejected rather than repaired — a surprising rename is
    worse than a clear error. */
const MATERIAL_NAME = /^[A-Za-z0-9][A-Za-z0-9 ._()-]{0,119}$/
function safeMaterialName(name: string): string | undefined {
  if (name !== basename(name)) return undefined
  if (!MATERIAL_NAME.test(name) || name.includes("..")) return undefined
  return name
}

/** The routes below change the course itself (its material, its difficulty,
    its decisions): they are the teacher's. There's no auth this weekend, but
    the server still refuses to attribute a course change to anyone else. */
function teacherOr403(database: DatabaseSync, context: Context, authorId: string): Response | undefined {
  const member = getMember(database, authorId)
  if (member?.kind === "person" && member.role === "teacher") return undefined
  return context.json({ error: `Only a teacher can do this (author "${authorId}" isn't one)` }, 403)
}

export interface ApiHooks {
  onMessageCreated?: (message: Message, hint?: { intent: MentionIntent; moduleId: string }) => void
  onThreadCreated?: (thread: Thread) => void
  onCardPublished?: (published: PublishedCard) => void
  onModuleUpdated?: (module: Module) => void
  onReportUpdated?: (report: Report) => void
}

export interface ApiOptions extends ApiHooks {
  presence?: ReadonlyMap<string, "online" | "away" | "thinking" | "publishing">
  /** course directory (defaults to ADA_COURSE, same resolution as the seed) */
  courseDir?: string
}

export function createApi(database: DatabaseSync, options: ApiOptions = {}): Hono {
  const app = new Hono()
  const courseDir = resolve(repoRoot, options.courseDir ?? process.env.ADA_COURSE ?? "data/neural-networks-2026")

  app.get("/api/community", (context) => context.json(getCommunitySnapshot(database, options.presence)))

  app.post("/api/channels/:channelId/messages", async (context) => {
    try {
      const body = await context.req.json<unknown>()
      if (!isRecord(body) || typeof body.authorId !== "string" || !isParagraphs(body.paragraphs)) {
        return context.json({ error: "authorId and paragraphs are required" }, 400)
      }
      const input: MessageInput = {
        channelId: context.req.param("channelId"),
        authorId: body.authorId,
        paragraphs: body.paragraphs,
        threadId: optionalString(body.threadId),
        fromCard: isRecord(body.fromCard) && typeof body.fromCard.cardId === "string" && typeof body.fromCard.ago === "string"
          ? { cardId: body.fromCard.cardId, ago: body.fromCard.ago }
          : undefined,
      }
      const message = createMessage(database, input)
      options.onMessageCreated?.(message)
      return context.json(message, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post("/api/threads", async (context) => {
    try {
      const body = await context.req.json<unknown>()
      if (!isRecord(body) || typeof body.rootMessageId !== "string") {
        return context.json({ error: "rootMessageId is required" }, 400)
      }
      const thread = createThread(database, body.rootMessageId)
      options.onThreadCreated?.(thread)
      return context.json(thread, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post("/api/cards", async (context) => {
    try {
      const body = await context.req.json<unknown>()
      const input = cardInput(body)
      if (!input) return context.json({ error: "missing required card fields" }, 400)
      const published = publishCard(database, input)
      options.onCardPublished?.(published)
      return context.json(published, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  /** Teacher uploads study material for a module: writes the raw file, marks the module `compiling`,
      then posts the mention that fires the runner's ingest path (design §8). */
  app.post("/api/modules/:moduleId/materials", async (context) => {
    try {
      const moduleId = context.req.param("moduleId")
      const module = getModule(database, moduleId)
      if (!module) return context.json({ error: `Module does not exist: ${moduleId}` }, 404)
      const body = await context.req.json<unknown>()
      if (!isRecord(body) || typeof body.name !== "string" || typeof body.kind !== "string" || typeof body.authorId !== "string") {
        return context.json({ error: "name, kind and authorId are required" }, 400)
      }
      const kind = body.kind as Material["kind"]
      if (!MATERIAL_KINDS.includes(kind)) return context.json({ error: `Unknown material kind: ${body.kind}` }, 400)
      const text = typeof body.text === "string" ? body.text : undefined
      const size = typeof body.size === "number" ? body.size : undefined
      const authorId = body.authorId
      const denied = teacherOr403(database, context, authorId)
      if (denied) return denied
      const name = safeMaterialName(body.name)
      if (!name) return context.json({ error: "name must be a plain file name (letters, digits, spaces, . _ ( ) -)" }, 400)

      // Materials land under the uploading teacher's own raw folder (design §8).
      const relativePath = `${authorId}/modules/${moduleId}/${name}`
      const rawRoot = resolve(courseDir, "raw")
      const absolutePath = resolve(rawRoot, relativePath)
      if (!absolutePath.startsWith(rawRoot + sep)) return context.json({ error: "name resolves outside the course" }, 400)
      mkdirSync(dirname(absolutePath), { recursive: true })
      const content = text
        ?? (kind === "markdown" ? "" : `# ${name}\n\n(binary material uploaded on ${new Date().toISOString().slice(0, 10)})`)
      writeFileSync(absolutePath, content, "utf8")

      const material: SeedMaterial = {
        id: randomUUID(),
        name,
        kind,
        size,
        path: relativePath,
        uploadedAt: new Date().toISOString(),
      }
      addMaterial(database, moduleId, material)
      const updated = setModuleStatus(database, moduleId, "compiling")
      options.onModuleUpdated?.(updated)

      // Lowercase id so the standard @mention scan (mentions.ts) matches the agent's member id.
      const message = createMessage(database, {
        channelId: module.channelId,
        authorId,
        paragraphs: [[{ kind: "text", text: `@ada ingest ${name} into ${moduleId}` }]],
      })
      options.onMessageCreated?.(message, { intent: "ingest", moduleId })

      return context.json(updated, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  /** Teacher sets or overrides a module's difficulty/objectives by hand. */
  app.patch("/api/modules/:moduleId", async (context) => {
    try {
      const moduleId = context.req.param("moduleId")
      if (!getModule(database, moduleId)) return context.json({ error: `Module does not exist: ${moduleId}` }, 404)
      const body = await context.req.json<unknown>()
      if (!isRecord(body) || typeof body.authorId !== "string") {
        return context.json({ error: "authorId is required" }, 400)
      }
      const deniedPatch = teacherOr403(database, context, body.authorId)
      if (deniedPatch) return deniedPatch
      const patch: ModulePatch = {}
      if (body.difficulty !== undefined) {
        if (!isRecord(body.difficulty) || typeof body.difficulty.level !== "string"
          || !DIFFICULTY_LEVELS.includes(body.difficulty.level as DifficultyLevel)) {
          return context.json({ error: "difficulty.level must be intro, core or advanced" }, 400)
        }
        patch.difficulty = {
          level: body.difficulty.level as DifficultyLevel,
          rationale: typeof body.difficulty.rationale === "string" ? body.difficulty.rationale : undefined,
          setBy: body.authorId,
        }
      }
      if (body.objectives !== undefined) {
        if (!Array.isArray(body.objectives) || !body.objectives.every((item) => typeof item === "string")) {
          return context.json({ error: "objectives must be an array of strings" }, 400)
        }
        patch.objectives = body.objectives as string[]
      }
      const updated = updateModule(database, moduleId, patch)
      options.onModuleUpdated?.(updated)
      return context.json(updated, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  /** Teacher reconciles a report into the module: publishes the decision card and revises the module. */
  app.post("/api/reports/:reportId/reconcile", async (context) => {
    try {
      const reportId = context.req.param("reportId")
      const report = getReport(database, reportId)
      if (!report) return context.json({ error: `Report does not exist: ${reportId}` }, 404)
      const module = getModule(database, report.moduleId)
      if (!module) return context.json({ error: `Module does not exist: ${report.moduleId}` }, 404)
      const body = await context.req.json<unknown>()
      if (!isRecord(body) || !Array.isArray(body.accepted) || !body.accepted.every((item) => typeof item === "string")
        || typeof body.note !== "string" || typeof body.authorId !== "string") {
        return context.json({ error: "accepted (string[]), note and authorId are required" }, 400)
      }
      const accepted = body.accepted as string[]
      const note = body.note
      const authorId = body.authorId
      const deniedReconcile = teacherOr403(database, context, authorId)
      if (deniedReconcile) return deniedReconcile
      const assignment = report.assignmentId ? getAssignment(database, report.assignmentId) : undefined

      const acceptedTexts = accepted
        .map((id) => report.recommendations.find((rec) => rec.id === id)?.text)
        .filter((text): text is string => Boolean(text))
      const decisionBody = [
        "## Accepted",
        acceptedTexts.length > 0 ? acceptedTexts.map((text, index) => `${index + 1}. ${text}`).join("\n") : "(none)",
        "## Note",
        note,
      ].join("\n\n")
      const path = `${authorId}/decisions/${module.id}-revision-${report.assignmentId ?? report.id}.md`
      const title = `${module.title} · revision after ${assignment?.title ?? "report"}`
      const published = publishCard(database, {
        channelId: module.channelId,
        authorId,
        path,
        title,
        type: "decision",
        visibility: "channel",
        sources: [{ kind: "message", ref: report.id, label: "Agent report" }],
        body: decisionBody,
      })
      options.onCardPublished?.(published)

      const revisedModule = updateModule(database, module.id, {
        revision: `Revised after ${assignment?.title ?? "report"} · ${accepted.length} changes accepted`,
      })
      options.onModuleUpdated?.(revisedModule)

      const reconciled = reconcileReport(database, reportId, { accepted, note, by: authorId, cardId: published.card.id })
      options.onReportUpdated?.(reconciled)

      return context.json(reconciled, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  return app
}

export const createApiApp = createApi

function cardInput(value: unknown): AuthoredCardPublishInput | undefined {
  if (!isRecord(value) || typeof value.authorId !== "string") return undefined
  const parsed = cardPublishInputSchema.safeParse(value)
  if (!parsed.success) return undefined
  return {
    ...parsed.data,
    authorId: value.authorId,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isParagraphs(value: unknown): value is MessageInput["paragraphs"] {
  return Array.isArray(value) && value.every((paragraph) => Array.isArray(paragraph)
    && paragraph.every((block) => messageBlockSchema.safeParse(block).success))
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function errorResponse(context: Context, error: unknown): Response {
  const message = error instanceof Error ? error.message : "Internal error"
  const status = message.includes("does not exist") || message.includes("does not belong") ? 404 : 400
  return context.json({ error: message }, status)
}
