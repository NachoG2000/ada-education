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
  createCommunityAgentInputSchema,
  createCommunityChannelInputSchema,
  createCommunityInputSchema,
  createInviteInputSchema,
  createAgentDmInputSchema,
  createScopedMessageInputSchema,
  createScopedThreadInputSchema,
  createUserInputSchema,
  editScopedMessageInputSchema,
  redeemInviteInputSchema,
  updateCommunityAgentInputSchema,
  updateCommunityChannelInputSchema,
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
  Presence,
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
import {
  canReadTenantChannel,
  createTenantAgent,
  createTenantAgentDm,
  createTenantChannel,
  createTenantCommunity,
  createTenantInvite,
  createTenantMessage,
  createTenantThread,
  createTenantUser,
  deleteTenantAgent,
  deleteTenantMessage,
  editTenantMessage,
  findTenantUserByToken,
  getTenantCommunity,
  getTenantAgent,
  getTenantSnapshot,
  joinTenantChannel,
  leaveTenantChannel,
  leaveTenantCommunity,
  listTenantAgents,
  listTenantChannelDirectory,
  listTenantChannels,
  listTenantCommunities,
  listTenantMembers,
  listTenantMessages,
  redeemTenantInvite,
  removeTenantMember,
  rotateTenantAgentToken,
  sessionForUser,
  updateTenantAgent,
  updateTenantChannel,
  updateTenantCommunity,
  type TenantChannel,
  type TenantAgent,
  type TenantMembership,
  type TenantUser,
} from "./tenant.js"

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
  /** Versioned, tenant-scoped events for the hosted WebSocket boundary. The
      callback receives a mutation only after its SQLite transaction succeeds. */
  onTenantEvent?: (event: { communityId: string; type: string; payload: unknown }) => void
  onTenantMembershipEnded?: (userId: string, communityId: string) => void
  onTenantMessageCreated?: (message: ReturnType<typeof createTenantMessage>) => void
  onTenantWork?: (message: ReturnType<typeof createTenantMessage>) => void
  onTenantAgentRevoked?: (agentId: string, communityId: string) => void
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
  /** Hosted runner presence is separate from the legacy seeded-course map. */
  hostedPresence?: ReadonlyMap<string, "online" | "offline" | "thinking" | "publishing">
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

function hostedBearer(context: Context): string | undefined {
  const header = context.req.header("authorization")
  if (!header || !/^bearer\s+/i.test(header)) return undefined
  const value = header.slice(7).trim()
  return value || undefined
}

function hostedUser(context: Context, database: DatabaseSync): TenantUser {
  const raw = hostedBearer(context)
  if (!raw) throw new WorkspaceError("unauthorized", "A bearer user token is required")
  const user = findTenantUserByToken(database, raw)
  if (!user) throw new WorkspaceError("unauthorized", "User token is invalid or expired")
  return user
}

function hostedMembership(database: DatabaseSync, communityId: string, userId: string): { id: string; userId: string; communityId: string; role: "teacher" | "student"; status: "active"; joinedAt: string; updatedAt?: string } {
  const row = database.prepare("SELECT * FROM tenant_memberships WHERE community_id = ? AND user_id = ? AND status = 'active'").get(communityId, userId) as Record<string, unknown> | undefined
  if (!row) throw new WorkspaceError("forbidden", "You are not an active member of this community")
  return {
    id: String(row.community_id) + ":" + String(row.user_id),
    userId: String(row.user_id),
    communityId: String(row.community_id),
    role: (String(row.role) === "teacher" ? "teacher" : "student"),
    status: "active",
    joinedAt: String(row.created_at),
    ...(row.updated_at ? { updatedAt: String(row.updated_at) } : {}),
  }
}

function hostedUserProjection(user: TenantUser): { id: string; displayName: string; createdAt: string; updatedAt?: string } {
  return { id: user.id, displayName: user.displayName, createdAt: user.createdAt, ...(user.updatedAt ? { updatedAt: user.updatedAt } : {}) }
}

function hostedCommunitySummary(database: DatabaseSync, communityId: string, userId: string): Record<string, unknown> {
  const community = getTenantCommunity(database, communityId, userId)
  const membership = hostedMembership(database, communityId, userId)
  return {
    id: community.id,
    name: community.name,
    term: community.term,
    initial: community.name.slice(0, 2).toUpperCase(),
    createdAt: community.createdAt,
    ...(community.updatedAt ? { updatedAt: community.updatedAt } : {}),
    membership,
  }
}

function hostedChannel(database: DatabaseSync, channel: TenantChannel): Record<string, unknown> {
  const rows = database.prepare("SELECT member_id, member_kind FROM tenant_channel_members WHERE community_id = ? AND channel_id = ? ORDER BY created_at, member_id, member_kind").all(channel.communityId, channel.id) as Array<Record<string, unknown>>
  return {
    id: channel.id,
    communityId: channel.communityId,
    name: channel.name,
    ...(channel.description ? { description: channel.description } : {}),
    kind: channel.kind,
    visibility: channel.visibility === "open" ? "public" : "private",
    status: channel.status ?? "active",
    createdBy: channel.createdBy ?? "",
    createdAt: channel.createdAt ?? new Date(0).toISOString(),
    ...(channel.updatedAt ? { updatedAt: channel.updatedAt } : {}),
    ...(channel.archivedAt ? { archivedAt: channel.archivedAt } : {}),
    memberIds: rows.filter((row) => row.member_kind === "user").map((row) => String(row.member_id)),
    agentIds: rows.filter((row) => row.member_kind === "agent").map((row) => String(row.member_id)),
    ...(channel.kind === "dm" && channel.dmAgentId ? { agentId: channel.dmAgentId, ownerId: channel.createdBy } : {}),
  }
}

function hostedAgent(agent: TenantAgent, viewerId?: string, database?: DatabaseSync): Record<string, unknown> {
  const visibleChannelIds = viewerId && database
    ? agent.channelIds.filter((channelId) => canReadTenantChannel(database, agent.communityId, channelId, viewerId))
    : agent.channelIds
  const base = {
    id: agent.id,
    communityId: agent.communityId,
    name: agent.name,
    ...(agent.avatarUrl ? { avatarUrl: agent.avatarUrl } : {}),
    instructions: agent.instructions,
    runtime: agent.runtime,
    model: agent.model || "default",
    channelIds: visibleChannelIds,
    createdBy: agent.createdBy,
    createdAt: agent.createdAt,
    ...(agent.updatedAt ? { updatedAt: agent.updatedAt } : {}),
  }
  return agent.status === "deleted"
    ? { ...base, status: "deleted", deletedAt: agent.deletedAt ?? agent.updatedAt, deletedBy: agent.deletedBy ?? agent.createdBy }
    : { ...base, status: "active" }
}

function hostedCommunityAgent(agent: TenantAgent, viewerId?: string, database?: DatabaseSync): Record<string, unknown> {
  const presence = agent.presence === "away" ? "offline" : agent.presence
  return { ...hostedAgent(agent, viewerId, database), presence }
}

function hostedCommunityMember(communityId: string, member: TenantMembership, presence: ReadonlyMap<string, string> = new Map()): Record<string, unknown> {
  return {
    id: member.id,
    communityId,
    displayName: member.displayName,
    initials: member.initials,
    role: member.role,
    status: "active",
    joinedAt: member.createdAt,
    presence: presence.get(member.id) === "away" ? "offline" : (presence.get(member.id) ?? "offline"),
  }
}

function hostedDirectoryAgents(database: DatabaseSync, communityId: string, userId: string, presence: ReadonlyMap<string, Presence | "offline"> = new Map()): Array<Record<string, unknown>> {
  return listTenantAgents(database, communityId, userId, presence).map((agent) => ({
    id: agent.id, communityId, name: agent.name, ...(agent.avatarUrl ? { avatarUrl: agent.avatarUrl } : {}),
    runtime: agent.runtime, model: agent.model || "default", status: agent.status,
  }))
}

function hostedMessage(message: ReturnType<typeof createTenantMessage>): Record<string, unknown> {
  return {
    id: message.id,
    communityId: message.communityId,
    channelId: message.channelId,
    authorId: message.authorId,
    at: message.at,
    paragraphs: message.paragraphs,
    ...(message.threadId ? { threadId: message.threadId } : {}),
    ...(message.clientId ? { clientId: message.clientId } : {}),
    ...(message.editedAt ? { editedAt: message.editedAt } : {}),
    ...(message.deletedAt ? { deletedAt: message.deletedAt, ...(message.deletedBy ? { deletedBy: message.deletedBy } : {}) } : {}),
  }
}

export function createApi(database: DatabaseSync, options: ApiOptions = {}): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>()
  const tenantEvent = (communityId: string, type: string, payload: unknown): void => {
    options.onTenantEvent?.({ communityId, type, payload })
  }
  const courseDir = resolve(repoRoot, options.courseDir ?? process.env.ADA_COURSE ?? "data/neural-networks-2026")
  const requireMembership = options.requireMembership ?? ["1", "true"].includes(process.env.ADA_REQUIRE_MEMBERSHIP ?? "")
  const ownerToken = options.ownerToken ?? process.env.ADA_OWNER_TOKEN

  app.get("/health", (context) => context.json({ ok: true }))

  /** The course's public face: name and subtitle, nothing else — a client
      learns the course is gated from the 401 on /api/community. */
  app.get("/api/course", (context) => {
    const info = getCommunityInfo(database)
    if (!info) return context.json({ error: "The course isn't seeded yet" }, 404)
    return context.json(info)
  })

  /* Membership gating (DECISIONS.md §20, off for local dev): everything under
     /api needs a person token except the join doors. Hosted runner writes are
     authenticated on their first WebSocket frame and scoped to one agent. */
  app.use("/api/*", async (context, next) => {
    /* Hosted issue #1 routes have their own global-user authentication and
       must remain reachable on a fresh, unseeded database. */
    const hostedPath = context.req.path
    if (hostedPath === "/api/users" || hostedPath === "/api/session"
      || hostedPath === "/api/invites/redeem" || hostedPath.startsWith("/api/communities")) return next()
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

  /* -----------------------------------------------------------------------
     Hosted issue #1 API. These routes deliberately live beside (and do not
     reinterpret) the legacy course routes below. Every handler resolves the
     actor from Authorization and the tenant from the path; request bodies
     never select an acting user or community. */
  app.post("/api/users", async (context) => {
    try {
      const raw = await context.req.json<unknown>()
      const parsed = parseInput(createUserInputSchema, raw) as { displayName: string }
      const created = createTenantUser(database, parsed.displayName)
      return context.json({
        user: hostedUserProjection(created.user),
        token: created.token,
      }, 201)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.get("/api/session", (context) => {
    try {
      const user = hostedUser(context, database)
      const session = sessionForUser(database, user.id)
      return context.json({
        user: hostedUserProjection(session.user),
        communities: session.communities.map((community) => hostedCommunitySummary(database, community.id, user.id)),
      })
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.get("/api/communities", (context) => {
    try {
      const user = hostedUser(context, database)
      return context.json(listTenantCommunities(database, user.id).map((community) => hostedCommunitySummary(database, community.id, user.id)))
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post("/api/communities", async (context) => {
    try {
      const user = hostedUser(context, database)
      const body = parseInput(createCommunityInputSchema, await context.req.json<unknown>()) as { name: string; term: string }
      const community = createTenantCommunity(database, user.id, body.name, body.term)
      const summary = hostedCommunitySummary(database, community.id, user.id)
      const { membership: _membership, ...record } = summary
      tenantEvent(community.id, "community.updated", { community: record })
      return context.json({ community: summary, membership: hostedMembership(database, community.id, user.id) }, 201)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  const hostedCommunityId = (context: Context): string => {
    const id = context.req.param("communityId")
    if (!id) throw new WorkspaceError("invalid_input", "communityId is required", "communityId")
    return id
  }
  const hostedMember = (context: Context): { user: TenantUser; communityId: string; role: "teacher" | "student" } => {
    const user = hostedUser(context, database)
    const communityId = hostedCommunityId(context)
    const membership = hostedMembership(database, communityId, user.id)
    return { user, communityId, role: membership.role }
  }

  app.get("/api/communities/:communityId", (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const snapshot = getTenantSnapshot(database, communityId, user.id, options.hostedPresence)
      const members = listTenantMembers(database, communityId, user.id).map((member) => hostedCommunityMember(communityId, member))
      const agents = snapshot.agents.map((agent) => hostedCommunityAgent(agent, user.id, database))
      const directoryChannels = listTenantChannelDirectory(database, communityId, user.id)
      return context.json({
        community: {
          id: communityId,
          name: snapshot.name,
          term: snapshot.term,
          initial: snapshot.name.slice(0, 2).toUpperCase(),
          createdAt: snapshot.createdAt,
          ...(snapshot.updatedAt ? { updatedAt: snapshot.updatedAt } : {}),
        },
        membership: hostedMembership(database, communityId, user.id),
        members,
        agents,
        channels: snapshot.channels.map((channel) => hostedChannel(database, channel)),
        directory: {
          communityId,
          channels: directoryChannels,
          agents: snapshot.agents.map((agent) => ({ id: agent.id, communityId, name: agent.name, ...(agent.avatarUrl ? { avatarUrl: agent.avatarUrl } : {}), runtime: agent.runtime, model: agent.model || "default", status: agent.status })),
          updatedAt: snapshot.updatedAt ?? new Date().toISOString(),
        },
        messages: snapshot.messages.map(hostedMessage),
        threads: snapshot.threads,
      })
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.patch("/api/communities/:communityId", async (context) => {
    try {
      const { user, communityId, role: memberRole } = hostedMember(context)
      if (memberRole !== "teacher") throw new WorkspaceError("forbidden", "Only a teacher can update a community")
      const raw = await context.req.json<unknown>()
      if (!isRecord(raw)) throw new WorkspaceError("invalid_input", "Request body must be an object")
      const community = updateTenantCommunity(database, communityId, user.id, { name: typeof raw.name === "string" ? raw.name : undefined, term: typeof raw.term === "string" ? raw.term : undefined })
      const summary = hostedCommunitySummary(database, community.id, user.id)
      const { membership: _membership, ...record } = summary
      tenantEvent(community.id, "community.updated", { community: record })
      return context.json(summary)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post("/api/communities/:communityId/invites", async (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const body = parseInput(createInviteInputSchema, await context.req.json<unknown>()) as { role: "teacher" | "student"; mode: "single-use" | "reusable"; maxUses?: number; expiresAt?: string }
      const invite = createTenantInvite(database, communityId, user.id, body.role, body.mode === "single-use" ? 1 : body.maxUses ?? null, body.expiresAt)
      return context.json({ invite: { id: invite.id, communityId, role: invite.role, mode: body.mode, createdBy: invite.createdBy, createdAt: invite.createdAt, ...(invite.expiresAt ? { expiresAt: invite.expiresAt } : {}), uses: invite.uses, ...(invite.maxUses !== null ? { maxUses: invite.maxUses } : {}) }, code: invite.code }, 201)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post("/api/invites/redeem", async (context) => {
    try {
      const user = hostedUser(context, database)
      const raw = await context.req.json<unknown>()
      const body = parseInput(redeemInviteInputSchema, raw) as { code: string }
      const redeemed = redeemTenantInvite(database, body.code, user.id)
      const communityId = redeemed.membership.communityId
      const membership = hostedMembership(database, communityId, user.id)
      if (redeemed.consumed) tenantEvent(communityId, "membership.created", { membership })
      return context.json({ community: hostedCommunitySummary(database, communityId, user.id), membership })
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.get("/api/communities/:communityId/members", (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const members = listTenantMembers(database, communityId, user.id)
      return context.json(members.map((member) => ({ id: `${communityId}:${member.id}`, userId: member.id, communityId, role: member.role, status: "active", joinedAt: member.createdAt, user: hostedUserProjection(member) })))
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.delete("/api/communities/:communityId/members/:userId", async (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const removed = removeTenantMember(database, communityId, user.id, context.req.param("userId"))
      const membership = { id: `${communityId}:${removed.id}`, userId: removed.id, communityId, role: removed.role, status: "removed" as const, joinedAt: removed.createdAt, removedAt: new Date().toISOString(), removedBy: user.id }
      tenantEvent(communityId, "membership.removed", { membership })
      options.onTenantMembershipEnded?.(removed.id, communityId)
      return context.json(membership)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.delete("/api/communities/:communityId/membership", async (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const membership = hostedMembership(database, communityId, user.id)
      leaveTenantCommunity(database, communityId, user.id)
      const ended = { ...membership, status: "left" as const, leftAt: new Date().toISOString() }
      tenantEvent(communityId, "membership.left", { membership: ended })
      options.onTenantMembershipEnded?.(user.id, communityId)
      return context.json(ended)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.get("/api/communities/:communityId/channels/browse", (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      return context.json(listTenantChannelDirectory(database, communityId, user.id))
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.get("/api/communities/:communityId/channels", (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const includeArchived = context.req.query("includeArchived") !== "false"
      return context.json(listTenantChannels(database, communityId, user.id, includeArchived).map((channel) => hostedChannel(database, channel)))
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post("/api/communities/:communityId/channels", async (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const body = parseInput(createCommunityChannelInputSchema, await context.req.json<unknown>()) as { name: string; description?: string; kind: "channel"; visibility: "public" | "private" }
      const channel = createTenantChannel(database, communityId, user.id, { name: body.name, description: body.description, visibility: body.visibility === "public" ? "open" : "private", memberIds: [user.id] })
      const projected = hostedChannel(database, channel)
      tenantEvent(communityId, "channel.created", { channel: projected })
      tenantEvent(communityId, "directory.updated", { channels: listTenantChannelDirectory(database, communityId, user.id), agents: hostedDirectoryAgents(database, communityId, user.id, options.hostedPresence) })
      return context.json(projected, 201)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post("/api/communities/:communityId/dms", async (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const body = parseInput(createAgentDmInputSchema, await context.req.json<unknown>()) as { agentId: string }
      const channel = createTenantAgentDm(database, communityId, user.id, body.agentId)
      const projected = hostedChannel(database, channel)
      const dm = { channelId: channel.id, communityId, agentId: body.agentId, ownerId: user.id, createdAt: channel.createdAt, status: (channel.status ?? "active") as "active" | "archived", ...(channel.archivedAt ? { archivedAt: channel.archivedAt } : {}) }
      tenantEvent(communityId, "agent.dm.created", { dm, channel: projected })
      return context.json({ channel: projected, dm }, 201)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.patch("/api/communities/:communityId/channels/:channelId", async (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const body = parseInput(updateCommunityChannelInputSchema, await context.req.json<unknown>()) as { name?: string; description?: string | null; visibility?: "public" | "private"; status?: "active" | "archived" }
      const channel = updateTenantChannel(database, communityId, user.id, context.req.param("channelId"), { name: body.name, description: body.description, visibility: body.visibility ? body.visibility === "public" ? "open" : "private" : undefined, status: body.status })
      const projected = hostedChannel(database, channel)
      tenantEvent(communityId, channel.status === "archived" ? "channel.archived" : "channel.updated", { channel: projected })
      tenantEvent(communityId, "directory.updated", { channels: listTenantChannelDirectory(database, communityId, user.id), agents: hostedDirectoryAgents(database, communityId, user.id, options.hostedPresence) })
      return context.json(projected)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post("/api/communities/:communityId/channels/:channelId/join", async (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const channel = joinTenantChannel(database, communityId, user.id, context.req.param("channelId"))
      const projected = hostedChannel(database, channel)
      tenantEvent(communityId, "channel.updated", { channel: projected })
      tenantEvent(communityId, "directory.updated", { channels: listTenantChannelDirectory(database, communityId, user.id), agents: hostedDirectoryAgents(database, communityId, user.id, options.hostedPresence) })
      return context.json(projected)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.delete("/api/communities/:communityId/channels/:channelId/leave", async (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const channel = leaveTenantChannel(database, communityId, user.id, context.req.param("channelId"))
      const projected = hostedChannel(database, channel)
      tenantEvent(communityId, "channel.updated", { channel: projected })
      tenantEvent(communityId, "directory.updated", { channels: listTenantChannelDirectory(database, communityId, user.id), agents: hostedDirectoryAgents(database, communityId, user.id, options.hostedPresence) })
      return context.json(projected)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.get("/api/communities/:communityId/agents", (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      return context.json(listTenantAgents(database, communityId, user.id, options.hostedPresence).map((agent) => hostedAgent(agent, user.id, database)))
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post("/api/communities/:communityId/agents", async (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const body = parseInput(createCommunityAgentInputSchema, await context.req.json<unknown>()) as { name: string; avatarUrl?: string | null; instructions: string; runtime: "claude" | "codex"; model: string; channelIds: string[] }
      const result = createTenantAgent(database, communityId, user.id, body)
      const agent = hostedAgent(result.agent, user.id, database)
      tenantEvent(communityId, "agent.created", { agent })
      tenantEvent(communityId, "directory.updated", { channels: listTenantChannelDirectory(database, communityId, user.id), agents: hostedDirectoryAgents(database, communityId, user.id, options.hostedPresence) })
      return context.json({ agent, enrollment: { agentId: result.agent.id, communityId, runnerToken: result.enrollment.runnerToken, setupCommand: result.enrollment.setupCommand, issuedAt: new Date().toISOString() } }, 201)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.get("/api/communities/:communityId/agents/:agentId", (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      return context.json(hostedAgent(getTenantAgent(database, communityId, user.id, context.req.param("agentId"), options.hostedPresence), user.id, database))
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.patch("/api/communities/:communityId/agents/:agentId", async (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const body = parseInput(updateCommunityAgentInputSchema, await context.req.json<unknown>()) as { name?: string; avatarUrl?: string | null; instructions?: string; runtime?: "claude" | "codex"; model?: string; channelIds?: string[] }
      const agent = updateTenantAgent(database, communityId, user.id, context.req.param("agentId"), body, options.hostedPresence)
      const projected = hostedAgent(agent, user.id, database)
      tenantEvent(communityId, "agent.updated", { agent: projected })
      tenantEvent(communityId, "directory.updated", { channels: listTenantChannelDirectory(database, communityId, user.id), agents: hostedDirectoryAgents(database, communityId, user.id, options.hostedPresence) })
      return context.json(projected)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post("/api/communities/:communityId/agents/:agentId/enrollment", async (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const result = rotateTenantAgentToken(database, communityId, user.id, context.req.param("agentId"), options.hostedPresence)
      const agent = hostedAgent(result.agent, user.id, database)
      tenantEvent(communityId, "agent.updated", { agent })
      options.onTenantAgentRevoked?.(result.agent.id, communityId)
      return context.json({ agent, enrollment: { agentId: result.agent.id, communityId, runnerToken: result.enrollment.runnerToken, setupCommand: result.enrollment.setupCommand, issuedAt: new Date().toISOString() } })
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.delete("/api/communities/:communityId/agents/:agentId", async (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const agent = deleteTenantAgent(database, communityId, user.id, context.req.param("agentId"), options.hostedPresence)
      const projected = hostedAgent(agent, user.id, database)
      tenantEvent(communityId, "agent.deleted", { agent: projected })
      tenantEvent(communityId, "directory.updated", { channels: listTenantChannelDirectory(database, communityId, user.id), agents: hostedDirectoryAgents(database, communityId, user.id, options.hostedPresence) })
      options.onTenantAgentRevoked?.(agent.id, communityId)
      return context.json(projected)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.get("/api/communities/:communityId/channels/:channelId/messages", (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      if (!canReadTenantChannel(database, communityId, context.req.param("channelId"), user.id)) throw new WorkspaceError("not_found", "Channel does not exist")
      return context.json(listTenantMessages(database, communityId, user.id, context.req.param("channelId")).map(hostedMessage))
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post("/api/communities/:communityId/channels/:channelId/messages", async (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const raw = await context.req.json<unknown>()
      const body = parseInput(createScopedMessageInputSchema, { ...(isRecord(raw) ? raw : {}), channelId: context.req.param("channelId") }) as { paragraphs: unknown; threadId?: string; clientId?: string }
      const message = createTenantMessage(database, communityId, user.id, context.req.param("channelId"), body)
      const projected = hostedMessage(message)
      tenantEvent(communityId, "message.created", { message: projected })
      options.onTenantMessageCreated?.(message)
      options.onTenantWork?.(message)
      return context.json(projected, 201)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.patch("/api/communities/:communityId/messages/:messageId", async (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const body = parseInput(editScopedMessageInputSchema, await context.req.json<unknown>()) as { paragraphs: unknown }
      const message = editTenantMessage(database, communityId, user.id, context.req.param("messageId"), body.paragraphs)
      tenantEvent(communityId, "message.updated", { message: hostedMessage(message) })
      return context.json(hostedMessage(message))
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.delete("/api/communities/:communityId/messages/:messageId", async (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const deleted = deleteTenantMessage(database, communityId, user.id, context.req.param("messageId"))
      const tombstone = { id: deleted.id, communityId, channelId: deleted.channelId, authorId: deleted.authorId, status: "deleted" as const, deletedAt: deleted.deletedAt ?? new Date().toISOString(), deletedBy: deleted.deletedBy ?? user.id }
      tenantEvent(communityId, "message.deleted", { message: tombstone })
      return context.json(tombstone)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post("/api/communities/:communityId/threads", async (context) => {
    try {
      const { user, communityId } = hostedMember(context)
      const body = parseInput(createScopedThreadInputSchema, await context.req.json<unknown>()) as { channelId: string; rootMessageId: string }
      const thread = createTenantThread(database, communityId, user.id, body.rootMessageId, body.channelId)
      tenantEvent(communityId, "thread.created", { thread })
      return context.json(thread)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

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
      // Bytes, not text: decoding and re-encoding would corrupt a pdf.
      const bytes = readFileSync(absolutePath)
      return context.body(new Uint8Array(bytes), 200, { "content-type": "application/octet-stream" })
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
    app.get("*", (context) => {
      const pathname = new URL(context.req.url).pathname
      // An unmatched API path is a 404, never the app shell: the SPA fallback
      // must not shadow the API namespace.
      if (pathname === "/api" || pathname.startsWith("/api/")) {
        return context.json({ error: `No such endpoint: ${pathname}` }, 404)
      }
      return serveWebFile(webDist, pathname)
    })
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
