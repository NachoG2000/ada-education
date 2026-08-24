import { createHash, randomUUID, timingSafeEqual } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { readFileSync } from "node:fs"
import { basename, dirname, resolve, sep } from "node:path"
import { Hono } from "hono"
import type { Context } from "hono"
import type { DatabaseSync } from "node:sqlite"
import { messageBlockSchema, cardPublishInputSchema } from "@ada/protocol"
import type { DifficultyLevel, Material, Member, MentionIntent, Message, Module, Report, Thread } from "@ada/protocol"
import {
  addMaterial,
  createInvite,
  createMessage,
  createThread,
  findAgentByToken,
  findPersonByToken,
  findTeacher,
  generateToken,
  getAssignment,
  getCommunityInfo,
  getCommunitySnapshot,
  getMember,
  getModule,
  getReport,
  joinWithInvite,
  publishCard,
  setMemberToken,
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
import { hasWebDist, serveWebFile } from "./static.js"

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
    its decisions): they are the teacher's. There's no auth yet, but
    the server still refuses to attribute a course change to anyone else. */
function teacherOr403(database: DatabaseSync, context: Context, authorId: string): Response | undefined {
  const member = getMember(database, authorId)
  if (member?.kind === "person" && member.role === "teacher") return undefined
  return context.json({ error: `Only a teacher can do this (author "${authorId}" isn't one)` }, 403)
}

export interface ApiHooks {
  onMessageCreated?: (message: Message, hint?: { intent: MentionIntent; moduleId: string }) => void
  onMemberJoined?: (member: Member) => void
  onThreadCreated?: (thread: Thread) => void
  onCardPublished?: (published: PublishedCard) => void
  onModuleUpdated?: (module: Module) => void
  onReportUpdated?: (report: Report) => void
}

export interface ApiOptions extends ApiHooks {
  presence?: ReadonlyMap<string, "online" | "away" | "thinking" | "publishing">
  /** course directory (defaults to ADA_COURSE, same resolution as the seed) */
  courseDir?: string
  /** membership gating (DECISIONS.md §20): defaults to ADA_REQUIRE_MEMBERSHIP */
  requireMembership?: boolean
  /** the deploy's root token; claiming it binds the teacher (defaults to ADA_OWNER_TOKEN) */
  ownerToken?: string
  /** built SPA to serve same-origin (defaults to ADA_WEB_DIST or apps/web/dist) */
  webDist?: string
}

/** Equal-length hashing first, so comparing tokens never leaks length or bytes. */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest())
}

function bearerToken(context: Context): string | undefined {
  const header = context.req.header("authorization")
  if (!header?.toLowerCase().startsWith("bearer ")) return undefined
  const token = header.slice(7).trim()
  return token || undefined
}

type ApiEnv = { Variables: { me?: Member } }

export function createApi(database: DatabaseSync, options: ApiOptions = {}): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>()
  const courseDir = resolve(repoRoot, options.courseDir ?? process.env.ADA_COURSE ?? "data/neural-networks-2026")
  const requireMembership = options.requireMembership ?? ["1", "true"].includes(process.env.ADA_REQUIRE_MEMBERSHIP ?? "")
  const ownerToken = options.ownerToken ?? process.env.ADA_OWNER_TOKEN

  app.get("/health", (context) => context.json({ ok: true }))

  /** The course's public face: what the join screen may show before any auth. */
  app.get("/api/course", (context) => {
    const info = getCommunityInfo(database)
    if (!info) return context.json({ error: "The course isn't seeded yet" }, 404)
    return context.json({ ...info, requireMembership })
  })

  /* Membership gating (DECISIONS.md §20, off for local dev): everything under
     /api needs a person token except the join doors. Agents (the runner's
     snapshot fetch and raw sync) authenticate reads with their own token;
     their writes stay on the runner WS, which has its own check. */
  app.use("/api/*", async (context, next) => {
    if (!requireMembership) return next()
    const path = context.req.path
    const method = context.req.method
    if (path === "/api/course" || (method === "POST" && (path === "/api/claim" || path === "/api/join"))) return next()
    const token = bearerToken(context)
    if (!token) return context.json({ error: "This course requires membership. Join with an invite link, or claim it with the owner token." }, 401)
    const person = findPersonByToken(database, token)
    if (person) {
      context.set("me", person)
      return next()
    }
    if (method === "GET") {
      const agent = findAgentByToken(database, token)
      if (agent) {
        context.set("me", agent)
        return next()
      }
    }
    return context.json({ error: "That token doesn't belong to anyone in this course." }, 401)
  })

  /** Gated writes speak for the token's owner and no one else. Ungated (local
      dev) keeps trusting the claimed authorId, exactly as before. */
  const authorOr403 = (context: Context<ApiEnv>, authorId: string): Response | undefined => {
    if (!requireMembership) return undefined
    const me = context.get("me")
    if (me && me.id === authorId) return undefined
    return context.json({ error: `Your token is "${me?.id ?? "nobody"}"; you can't write as "${authorId}".` }, 403)
  }

  /** Owner token → the teacher's person token. Re-claiming rotates it: the
      owner token is the root of trust and must always recover access. */
  app.post("/api/claim", async (context) => {
    try {
      const body = await context.req.json<unknown>()
      if (!isRecord(body) || typeof body.token !== "string" || !body.token) {
        return context.json({ error: "token is required" }, 400)
      }
      if (!ownerToken || !safeEqual(body.token, ownerToken)) {
        return context.json({ error: "That isn't this course's owner token." }, 401)
      }
      const teacher = findTeacher(database)
      if (!teacher) return context.json({ error: "The course has no teacher to claim." }, 409)
      const personToken = generateToken()
      setMemberToken(database, teacher.id, personToken)
      return context.json({ personId: teacher.id, name: teacher.name, personToken }, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  /** Teacher mints a single-use invite link for a student. */
  app.post("/api/invites", async (context) => {
    try {
      let teacherId: string
      if (requireMembership) {
        teacherId = context.get("me")?.id ?? ""
      } else {
        const body = await context.req.json<unknown>().catch(() => ({}))
        teacherId = isRecord(body) && typeof body.authorId === "string" ? body.authorId : ""
      }
      const denied = teacherOr403(database, context, teacherId)
      if (denied) return denied
      const invite = createInvite(database, teacherId)
      return context.json({ token: invite.token, joinHash: `#join?token=${invite.token}` }, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  /** A student turns an invite into a person of their own. */
  app.post("/api/join", async (context) => {
    try {
      const body = await context.req.json<unknown>()
      if (!isRecord(body) || typeof body.token !== "string" || typeof body.name !== "string") {
        return context.json({ error: "token and name are required" }, 400)
      }
      const { person, personToken } = joinWithInvite(database, body.token, body.name)
      options.onMemberJoined?.(person)
      return context.json({ personId: person.id, name: person.name, personToken }, 200)
    } catch (error) {
      if (error instanceof Error && error.message === "Invite already used") {
        return context.json({ error: "This invite was already used. Ask for a new link." }, 410)
      }
      return errorResponse(context, error)
    }
  })

  app.get("/api/community", (context) => context.json(getCommunitySnapshot(database, options.presence)))

  /** A material's stored file, for runners (and clients) that don't share the
      server's disk: the runner syncs its local raw/ from here before an ingest
      (DECISIONS.md §20; capability delta course-modules). */
  app.get("/api/modules/:moduleId/materials/:materialId/raw", (context) => {
    const module = getModule(database, context.req.param("moduleId"))
    if (!module) return context.json({ error: `Module does not exist: ${context.req.param("moduleId")}` }, 404)
    const material = module.materials.find((item) => item.id === context.req.param("materialId"))
    if (!material) return context.json({ error: `Material does not exist: ${context.req.param("materialId")}` }, 404)
    const rawRoot = resolve(courseDir, "raw")
    const absolutePath = resolve(rawRoot, material.path)
    if (!absolutePath.startsWith(rawRoot + sep)) return context.json({ error: "material path resolves outside the course" }, 400)
    try {
      return context.text(readFileSync(absolutePath, "utf8"))
    } catch {
      return context.json({ error: `The material's file is missing: ${material.path}` }, 404)
    }
  })

  app.post("/api/channels/:channelId/messages", async (context) => {
    try {
      const body = await context.req.json<unknown>()
      if (!isRecord(body) || typeof body.authorId !== "string" || !isParagraphs(body.paragraphs)) {
        return context.json({ error: "authorId and paragraphs are required" }, 400)
      }
      const deniedAuthor = authorOr403(context, body.authorId)
      if (deniedAuthor) return deniedAuthor
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
      const deniedAuthor = authorOr403(context, input.authorId)
      if (deniedAuthor) return deniedAuthor
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
      const deniedAuthor = authorOr403(context, authorId)
      if (deniedAuthor) return deniedAuthor
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
      const deniedPatchAuthor = authorOr403(context, body.authorId)
      if (deniedPatchAuthor) return deniedPatchAuthor
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
      const deniedReconcileAuthor = authorOr403(context, authorId)
      if (deniedReconcileAuthor) return deniedReconcileAuthor
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

  /* The built SPA, same-origin, registered last so it never shadows /api.
     Absent in dev (Vite serves and proxies); present after `npm run build`. */
  const webDist = options.webDist ?? resolve(repoRoot, process.env.ADA_WEB_DIST ?? "apps/web/dist")
  if (hasWebDist(webDist)) {
    app.get("*", (context) => serveWebFile(webDist, new URL(context.req.url).pathname))
  }

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
