import { createHash, randomUUID, timingSafeEqual } from "node:crypto"
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs"
import { readFileSync } from "node:fs"
import { basename, dirname, resolve, sep } from "node:path"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import type { Context } from "hono"
import type { DatabaseSync } from "node:sqlite"
import {
  cardPublishInputSchema,
  communityUpdateInputSchema,
  createAgentInputSchema,
  createChannelInputSchema,
  editMessageInputSchema,
  messageCreateInputSchema,
  profileUpdateInputSchema,
  readMarkerInputSchema,
  replaceChannelMembersInputSchema,
  updateAgentInputSchema,
  updateChannelInputSchema,
} from "@ada/protocol"
import type {
  Agent,
  Channel,
  DifficultyLevel,
  Material,
  Member,
  MentionIntent,
  Message,
  MessageReaction,
  Module,
  Person,
  Report,
  Thread,
} from "@ada/protocol"
import {
  addMaterial,
  createInvite,
  createMessage,
  findAgentByToken,
  findPersonByToken,
  findTeacher,
  generateToken,
  getAssignment,
  getCommunityInfo,
  getMember,
  getModule,
  getReport,
  joinWithInvite,
  listMembers,
  publishCard,
  reconcileReportWithCard,
  setMemberToken,
  repoRoot,
  setModuleStatus,
  updateModule,
  type AuthoredCardPublishInput,
  type ModulePatch,
  type PublishedCard,
  type SeedMaterial,
} from "./db.js"
import { canPostChannel, canReadChannel, getViewerCommunitySnapshot, getWorkspaceChannel, listWorkspaceChannels } from "./workspace-access.js"
import {
  createChannel as createWorkspaceChannel,
  deleteEmptyChannel,
  joinChannel,
  leaveChannel,
  replaceChannelMembers,
  updateChannel as updateWorkspaceChannel,
} from "./workspace-channels.js"
import {
  createAgent,
  deleteAgent,
  getWorkspaceAgent,
  listWorkspaceAgents,
  rotateAgentToken,
  updateAgent,
  updateCommunity,
  updateProfile,
  type CommunityInfo,
} from "./workspace-members.js"
import {
  addMessageReaction,
  createWorkspaceMessage,
  editWorkspaceMessage,
  markChannelRead,
  removeMessageReaction,
  tombstoneWorkspaceMessage,
  createWorkspaceThread,
  type ReadMarkerResult,
} from "./workspace-messages.js"
import {
  deleteAttachment,
  getAttachmentDownload,
  MAX_ATTACHMENT_BYTES,
  storeAttachment,
  type AttachmentRecord,
} from "./workspace-attachments.js"
import { WorkspaceError } from "./workspace-errors.js"
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

function readablePersonIds(channel: Channel, members: Member[]): string[] {
  const open = (channel.visibility ?? (channel.group === "private" ? "private" : "open")) === "open"
  return members
    .filter((member): member is Person => member.kind === "person" && (open || channel.memberIds.includes(member.id)))
    .map((member) => member.id)
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
  onChannelCreated?: (channel: Channel) => void
  onChannelUpdated?: (channel: Channel) => void
  onChannelDeleted?: (channelId: string, deletedBy: string) => void
  /** Browser sockets that could read the old channel receive a tombstone when
      a mutation removes their access; the channel payload itself is never
      sent to those sockets after the mutation. */
  onChannelAccessRevoked?: (channelId: string, memberIds: string[], deletedBy: string) => void
  onMemberUpdated?: (member: Member) => void
  onMemberDeleted?: (memberId: string) => void
  onMemberAccessRevoked?: (memberId: string, viewerIds: string[]) => void
  onCommunityUpdated?: (community: CommunityInfo) => void
  onMessageUpdated?: (message: Message) => void
  onMessageDeleted?: (message: Message) => void
  onMessageReactionsUpdated?: (messageId: string, reactions: MessageReaction[]) => void
  onChannelRead?: (read: ReadMarkerResult) => void
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

  /** Workspace mutations always run as an active person. In gated deployments
      identity comes only from the bearer token. Local development retains the
      existing authorId adapter so the identity chooser keeps working. */
  const workspaceActor = (context: Context<ApiEnv>, value?: unknown): Person => {
    const authenticated = context.get("me")
    const legacyId = isRecord(value) && typeof value.authorId === "string" ? value.authorId : undefined
    if (requireMembership && legacyId && legacyId !== authenticated?.id) {
      throw new WorkspaceError("forbidden", `Your token cannot write as "${legacyId}"`)
    }
    const actor = requireMembership ? authenticated : getMember(database, legacyId ?? "")
    if (!actor) throw new WorkspaceError("unauthorized", "Choose a person before changing the workspace")
    if (actor.kind !== "person") throw new WorkspaceError("forbidden", "Agents cannot use person workspace actions")
    return actor
  }

  const requestViewer = (context: Context<ApiEnv>): Member | undefined => {
    if (requireMembership) return context.get("me")
    const authorId = context.req.query("authorId")
    return authorId ? getMember(database, authorId) : undefined
  }

  const visibleAgent = (agent: Agent, viewer: Member | undefined): boolean => {
    if (!viewer) return true
    if (viewer.kind === "person" && viewer.role === "teacher") return true
    if (agent.scope === "personal" && agent.createdBy === viewer.id) return true
    return agent.channelIds.some((channelId) => canReadChannel(database, channelId, viewer))
  }

  const agentForViewer = (agent: Agent, viewer: Member | undefined): Agent => {
    if (!viewer || (viewer.kind === "person" && viewer.role === "teacher")
      || (agent.scope === "personal" && agent.createdBy === viewer.id)) return agent
    return { ...agent, channelIds: agent.channelIds.filter((channelId) => canReadChannel(database, channelId, viewer)) }
  }

  const viewersForAgent = (agent: Agent): string[] => {
    const members = listMembers(database)
    return members
      .filter((member): member is Person => member.kind === "person")
      .filter((member) => (agent.scope === "personal" && agent.createdBy === member.id)
        || agent.channelIds.some((channelId) => canReadChannel(database, channelId, member)))
      .map((member) => member.id)
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

  app.get("/api/community", (context) => {
    try {
      return context.json(getViewerCommunitySnapshot(database, options.presence, requestViewer(context)))
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.patch("/api/community", async (context) => {
    try {
      const raw = await context.req.json<unknown>()
      const actor = workspaceActor(context, raw)
      const community = updateCommunity(database, actor.id, parseInput(communityUpdateInputSchema, raw))
      options.onCommunityUpdated?.(community)
      return context.json(community, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.patch("/api/members/:memberId", async (context) => {
    try {
      const raw = await context.req.json<unknown>()
      const actor = workspaceActor(context, raw)
      const member = updateProfile(database, actor.id, context.req.param("memberId"), parseInput(profileUpdateInputSchema, raw))
      options.onMemberUpdated?.(member)
      return context.json(member, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.get("/api/channels", (context) => {
    const viewer = requestViewer(context)
    return context.json(listWorkspaceChannels(database).filter((channel) => !viewer || canReadChannel(database, channel.id, viewer)))
  })

  app.get("/api/channels/:channelId", (context) => {
    const channel = getWorkspaceChannel(database, context.req.param("channelId"))
    const viewer = requestViewer(context)
    if (!channel || (viewer && !canReadChannel(database, channel.id, viewer))) {
      return context.json({ error: "Channel does not exist", code: "not_found" }, 404)
    }
    return context.json(channel)
  })

  app.post("/api/channels", async (context) => {
    try {
      const raw = await context.req.json<unknown>()
      const actor = workspaceActor(context, raw)
      const channel = createWorkspaceChannel(database, parseInput(createChannelInputSchema, raw), actor)
      options.onChannelCreated?.(channel)
      return context.json(channel, 201)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.patch("/api/channels/:channelId", async (context) => {
    try {
      const raw = await context.req.json<unknown>()
      const actor = workspaceActor(context, raw)
      const channelId = context.req.param("channelId")
      const previous = getWorkspaceChannel(database, channelId)
      const previousReaders = previous ? readablePersonIds(previous, listMembers(database)) : []
      const channel = updateWorkspaceChannel(database, channelId, parseInput(updateChannelInputSchema, raw), actor)
      options.onChannelUpdated?.(channel)
      const revoked = previousReaders.filter((memberId) => !canReadChannel(database, channel.id, getMember(database, memberId) as Person))
      if (revoked.length > 0) options.onChannelAccessRevoked?.(channel.id, revoked, actor.id)
      return context.json(channel, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.put("/api/channels/:channelId/members", async (context) => {
    try {
      const raw = await context.req.json<unknown>()
      const actor = workspaceActor(context, raw)
      const channelId = context.req.param("channelId")
      const previous = getWorkspaceChannel(database, channelId)
      const previousReaders = previous ? readablePersonIds(previous, listMembers(database)) : []
      const channel = replaceChannelMembers(database, channelId, parseInput(replaceChannelMembersInputSchema, raw), actor)
      options.onChannelUpdated?.(channel)
      const revoked = previousReaders.filter((memberId) => !canReadChannel(database, channel.id, getMember(database, memberId) as Person))
      if (revoked.length > 0) options.onChannelAccessRevoked?.(channel.id, revoked, actor.id)
      return context.json(channel, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post("/api/channels/:channelId/join", async (context) => {
    try {
      const raw = await readOptionalJson(context)
      const actor = workspaceActor(context, raw)
      const channel = joinChannel(database, context.req.param("channelId"), actor)
      options.onChannelUpdated?.(channel)
      return context.json(channel, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.delete("/api/channels/:channelId/leave", async (context) => {
    try {
      const raw = await readOptionalJson(context)
      const actor = workspaceActor(context, raw)
      const channelId = context.req.param("channelId")
      const previous = getWorkspaceChannel(database, channelId)
      const previousReaders = previous ? readablePersonIds(previous, listMembers(database)) : []
      const channel = leaveChannel(database, channelId, actor)
      options.onChannelUpdated?.(channel)
      const revoked = previousReaders.filter((memberId) => !canReadChannel(database, channel.id, getMember(database, memberId) as Person))
      if (revoked.length > 0) options.onChannelAccessRevoked?.(channel.id, revoked, actor.id)
      return context.json(channel, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.delete("/api/channels/:channelId", async (context) => {
    try {
      const raw = await readOptionalJson(context)
      const actor = workspaceActor(context, raw)
      const channelId = context.req.param("channelId")
      const previous = getWorkspaceChannel(database, channelId)
      const previousReaders = previous ? readablePersonIds(previous, listMembers(database)) : []
      deleteEmptyChannel(database, channelId, actor)
      options.onChannelDeleted?.(channelId, actor.id)
      if (previousReaders.length > 0) options.onChannelAccessRevoked?.(channelId, previousReaders, actor.id)
      return context.body(null, 204)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.get("/api/agents", (context) => {
    const viewer = requestViewer(context)
    return context.json(listWorkspaceAgents(database).filter((agent) => visibleAgent(agent, viewer)).map((agent) => agentForViewer(agent, viewer)))
  })

  app.get("/api/agents/:agentId", (context) => {
    const viewer = requestViewer(context)
    const agent = getWorkspaceAgent(database, context.req.param("agentId"))
    if (!agent || !visibleAgent(agent, viewer)) {
      return context.json({ error: "Agent does not exist", code: "not_found" }, 404)
    }
    return context.json(agentForViewer(agent, viewer))
  })

  app.post("/api/agents", async (context) => {
    try {
      const raw = await context.req.json<unknown>()
      const actor = workspaceActor(context, raw)
      const result = createAgent(database, actor.id, parseInput(createAgentInputSchema, raw))
      options.onMemberUpdated?.(result.agent)
      return context.json(result, 201)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.patch("/api/agents/:agentId", async (context) => {
    try {
      const raw = await context.req.json<unknown>()
      const actor = workspaceActor(context, raw)
      const agentId = context.req.param("agentId")
      const previous = getWorkspaceAgent(database, agentId)
      const previousViewers = previous ? viewersForAgent(previous) : []
      const agent = updateAgent(database, actor.id, agentId, parseInput(updateAgentInputSchema, raw))
      options.onMemberUpdated?.(agent)
      const revoked = previousViewers.filter((viewerId) => !visibleAgent(agent, getMember(database, viewerId)))
      if (revoked.length > 0) options.onMemberAccessRevoked?.(agent.id, revoked)
      return context.json(agent, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post("/api/agents/:agentId/rotate-token", async (context) => {
    try {
      const raw = await readOptionalJson(context)
      const actor = workspaceActor(context, raw)
      const result = rotateAgentToken(database, actor.id, context.req.param("agentId"))
      options.onMemberUpdated?.(result.agent)
      return context.json(result, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.delete("/api/agents/:agentId", async (context) => {
    try {
      const raw = await readOptionalJson(context)
      const actor = workspaceActor(context, raw)
      const agentId = context.req.param("agentId")
      const previous = getWorkspaceAgent(database, agentId)
      const previousViewers = previous ? viewersForAgent(previous) : []
      const result = deleteAgent(database, actor.id, agentId)
      options.onMemberDeleted?.(result.agentId)
      if (previousViewers.length > 0) options.onMemberAccessRevoked?.(result.agentId, previousViewers)
      return context.body(null, 204)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post(
    "/api/channels/:channelId/attachments",
    bodyLimit({
      maxSize: MAX_ATTACHMENT_BYTES + 64 * 1024,
      onError: (context) => context.json({ error: "Attachment exceeds the 10 MiB upload limit", code: "invalid_input", field: "file" }, 413),
    }),
    async (context) => {
      try {
        const body = await context.req.parseBody()
        const actor = workspaceActor(context, body)
        const channelId = context.req.param("channelId")
        if (!canPostChannel(database, channelId, actor)) throw new WorkspaceError("not_channel_member", "You must be an active channel member to upload files")
        const file = body.file
        if (!(file instanceof File)) throw new WorkspaceError("invalid_input", "file is required", "file")
        const stored = storeAttachment(database, courseDir, {
          channelId,
          uploaderId: actor.id,
          name: file.name,
          mime: file.type || "application/octet-stream",
          bytes: new Uint8Array(await file.arrayBuffer()),
        })
        return context.json(publicAttachment(stored), 201)
      } catch (error) {
        return errorResponse(context, error)
      }
    },
  )

  app.get("/api/attachments/:attachmentId", (context) => {
    try {
      const download = getAttachmentDownload(database, courseDir, context.req.param("attachmentId"))
      const viewer = requestViewer(context)
      if (viewer && !canReadChannel(database, download.channelId, viewer)) throw new WorkspaceError("not_found", "Attachment not found")
      return new Response(download.bytes, {
        headers: {
          "content-type": download.mime,
          "content-length": String(download.size),
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(download.name)}`,
        },
      })
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.delete("/api/attachments/:attachmentId", async (context) => {
    try {
      const raw = await readOptionalJson(context)
      const actor = workspaceActor(context, raw)
      const removed = deleteAttachment(database, courseDir, context.req.param("attachmentId"), actor.id, actor.role === "teacher")
      return context.json(publicAttachment(removed), 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  /** A material's stored file, for runners (and clients) that don't share the
      server's disk: the runner syncs its local raw/ from here before an ingest
      (DECISIONS.md §20; capability delta course-modules). */
  app.get("/api/modules/:moduleId/materials/:materialId/raw", (context) => {
    const module = getModule(database, context.req.param("moduleId"))
    if (!module) return context.json({ error: `Module does not exist: ${context.req.param("moduleId")}` }, 404)
    const viewer = requestViewer(context)
    if (viewer && !canReadChannel(database, module.channelId, viewer)) {
      return context.json({ error: "Material does not exist", code: "not_found" }, 404)
    }
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
      const raw = await context.req.json<unknown>()
      const actor = workspaceActor(context, raw)
      const message = createWorkspaceMessage(database, actor.id, context.req.param("channelId"), parseInput(messageCreateInputSchema, raw))
      options.onMessageCreated?.(message)
      return context.json(message, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.patch("/api/messages/:messageId", async (context) => {
    try {
      const raw = await context.req.json<unknown>()
      const actor = workspaceActor(context, raw)
      const message = editWorkspaceMessage(database, actor.id, context.req.param("messageId"), parseInput(editMessageInputSchema, raw))
      options.onMessageUpdated?.(message)
      return context.json(message, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.delete("/api/messages/:messageId", async (context) => {
    try {
      const raw = await readOptionalJson(context)
      const actor = workspaceActor(context, raw)
      const message = tombstoneWorkspaceMessage(database, actor.id, context.req.param("messageId"))
      options.onMessageDeleted?.(message)
      return context.json(message, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.put("/api/messages/:messageId/reactions/:emoji", async (context) => {
    try {
      const raw = await readOptionalJson(context)
      const actor = workspaceActor(context, raw)
      const messageId = context.req.param("messageId")
      const reactions = addMessageReaction(database, actor.id, messageId, decodeURIComponent(context.req.param("emoji")))
      options.onMessageReactionsUpdated?.(messageId, reactions)
      return context.json(reactions, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.delete("/api/messages/:messageId/reactions/:emoji", async (context) => {
    try {
      const raw = await readOptionalJson(context)
      const actor = workspaceActor(context, raw)
      const messageId = context.req.param("messageId")
      const reactions = removeMessageReaction(database, actor.id, messageId, decodeURIComponent(context.req.param("emoji")))
      options.onMessageReactionsUpdated?.(messageId, reactions)
      return context.json(reactions, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.put("/api/channels/:channelId/read", async (context) => {
    try {
      const raw = await context.req.json<unknown>()
      const actor = workspaceActor(context, raw)
      const read = markChannelRead(database, actor.id, context.req.param("channelId"), parseInput(readMarkerInputSchema, raw))
      options.onChannelRead?.(read)
      return context.json(read, 200)
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
      const actor = workspaceActor(context, body)
      const thread = createWorkspaceThread(database, actor.id, body.rootMessageId)
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
      const previousFile = existsSync(absolutePath) ? readFileSync(absolutePath) : undefined
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
      let committed = false
      let updated: Module
      let message: Message
      try {
        database.exec("BEGIN IMMEDIATE")
        addMaterial(database, moduleId, material)
        updated = setModuleStatus(database, moduleId, "compiling")
        // Lowercase id so the standard @mention scan (mentions.ts) matches the agent's member id.
        message = createMessage(database, {
          channelId: module.channelId,
          authorId,
          paragraphs: [[{ kind: "text", text: `@ada ingest ${name} into ${moduleId}` }]],
        })
        database.exec("COMMIT")
        committed = true
      } catch (error) {
        try { database.exec("ROLLBACK") } catch { /* preserve original failure */ }
        if (!committed) {
          try {
            if (previousFile) writeFileSync(absolutePath, previousFile)
            else unlinkSync(absolutePath)
          } catch { /* preserve original failure */ }
        }
        throw error
      }
      options.onModuleUpdated?.(updated)
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
      const result = reconcileReportWithCard(database, reportId, module.id, {
        channelId: module.channelId,
        authorId,
        path,
        title,
        type: "decision",
        visibility: "channel",
        sources: [{ kind: "message", ref: report.id, label: "Agent report" }],
        body: decisionBody,
      }, `Revised after ${assignment?.title ?? "report"} · ${accepted.length} changes accepted`, {
        accepted, note, by: authorId,
      })
      const reconciled = result.report
      options.onCardPublished?.(result.published)
      options.onModuleUpdated?.(result.module)
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

interface InputSchema<T> {
  safeParse: (value: unknown) =>
    | { success: true; data: T }
    | { success: false; error: { issues: Array<{ message: string; path: PropertyKey[] }> } }
}

function parseInput<T>(schema: InputSchema<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  const issue = result.error.issues[0]
  throw new WorkspaceError("invalid_input", issue?.message ?? "Invalid request body", issue?.path.join("."))
}

async function readOptionalJson(context: Context): Promise<unknown> {
  const contentType = context.req.header("content-type") ?? ""
  const contentLength = context.req.header("content-length")
  if (!contentType.includes("application/json") || contentLength === "0") return {}
  return context.req.json<unknown>().catch(() => ({}))
}

function publicAttachment(record: AttachmentRecord): Omit<AttachmentRecord, "storagePath"> {
  const { storagePath: _storagePath, ...publicRecord } = record
  return publicRecord
}

function errorResponse(context: Context, error: unknown): Response {
  if (error instanceof WorkspaceError) {
    const payload = { error: error.message, code: error.code, ...(error.field ? { field: error.field } : {}) }
    switch (error.status) {
      case 401: return context.json(payload, 401)
      case 403: return context.json(payload, 403)
      case 404: return context.json(payload, 404)
      case 409: return context.json(payload, 409)
      case 413: return context.json(payload, 413)
      default: return context.json(payload, 400)
    }
  }
  const message = error instanceof Error ? error.message : "Internal error"
  const status = message.includes("does not exist") || message.includes("does not belong") ? 404 : 400
  return context.json({ error: message }, status)
}
