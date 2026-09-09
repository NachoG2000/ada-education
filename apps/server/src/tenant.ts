/* Issue #1's tenant domain.

   The first Ada schema represented one course with members carrying plaintext
   tokens. This module deliberately keeps that compatibility surface intact,
   while all new hosted-demo operations use these tables and require an
   explicit community id. A user token is a high-entropy bearer credential;
   only its SHA-256 digest is persisted. */
import { createHash, randomBytes, randomUUID } from "node:crypto"
import type { DatabaseSync } from "node:sqlite"
import { resolveTextMentions, agentTemplates, type RunnerHostAgent } from "@ada/protocol"
import type { Channel, Message, Person, Presence } from "@ada/protocol"
import { WorkspaceError } from "./workspace-errors.js"

type Row = Record<string, unknown>
const str = (v: unknown): string | undefined => typeof v === "string" ? v : undefined
const now = (): string => new Date().toISOString()
const digest = (token: string): string => createHash("sha256").update(token).digest("hex")
const token = (): string => randomBytes(32).toString("base64url")
const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)?.[0] ?? "" : parts[0]?.[1] ?? "")).toUpperCase()
}

export type TenantRole = "teacher" | "student"
export type TenantUser = {
  id: string
  displayName: string
  initials: string
  tone: Person["tone"]
  status: "active" | "removed"
  createdAt: string
  updatedAt: string
}
export type TenantMembership = TenantUser & { communityId: string; role: TenantRole }
export type TenantCommunity = {
  id: string
  name: string
  term: string
  createdBy: string
  createdAt: string
  updatedAt: string
  role?: TenantRole
}
export type TenantInvite = {
  id: string
  communityId: string
  role: TenantRole
  mode: "single-use" | "reusable"
  maxUses: number | null
  uses: number
  createdBy: string
  createdAt: string
  expiresAt?: string
  revokedAt?: string
}
export type TenantAgent = {
  systemRole?: "ada"
  kind: "agent"
  id: string
  communityId: string
  name: string
  avatarUrl?: string
  instructions: string
  runtime: "claude" | "codex" | "pi"
  model: string
  createdBy: string
  status: "active" | "deleted"
  channelIds: string[]
  presence: Presence | "offline"
  createdAt: string
  updatedAt: string
  deletedAt?: string
  deletedBy?: string
}
export type TenantChannel = Channel & {
  communityId: string
  kind: "channel" | "dm"
  dmAgentId?: string
}
export type TenantMessage = Message & {
  communityId: string
  authorKind: "user" | "agent"
  createdAt: string
  deletedBy?: string
}
export type TenantThread = {
  id: string
  communityId: string
  channelId: string
  rootMessageId: string
  replyIds: string[]
  createdAt: string
}
export type TenantCard = {
  id: string
  communityId: string
  channelId: string
  authorId: string
  path: string
  title: string
  type: string
  body: string
  version: number
  replaces?: string
  createdAt: string
}
export type TenantSnapshot = TenantCommunity & {
  members: Array<Person | TenantAgent>
  channels: TenantChannel[]
  agents: TenantAgent[]
  messages: TenantMessage[]
  threads: TenantThread[]
  cards: TenantCard[]
}

export type TenantAgentEnrollment = { runnerToken: string; setupCommand: string }
export type TenantAgentResult = { agent: TenantAgent; enrollment: TenantAgentEnrollment }

function fail(code: "invalid_input" | "unauthorized" | "forbidden" | "not_found" | "not_channel_member" | "channel_archived" | "conflict" | "history_conflict", message: string, field?: string): never {
  throw new WorkspaceError(code, message, field)
}

function transaction<T>(database: DatabaseSync, action: () => T): T {
  if (database.isTransaction) return action()
  database.exec("BEGIN IMMEDIATE")
  try {
    const result = action()
    database.exec("COMMIT")
    return result
  } catch (error) {
    try { database.exec("ROLLBACK") } catch { /* retain original error */ }
    throw error
  }
}

function userFromRow(row: Row): TenantUser {
  return {
    id: str(row.id) ?? "",
    displayName: str(row.display_name) ?? "",
    initials: str(row.initials) ?? "",
    tone: (str(row.tone) ?? "card") as Person["tone"],
    status: (str(row.status) ?? "active") as TenantUser["status"],
    createdAt: str(row.created_at) ?? "",
    updatedAt: str(row.updated_at) ?? "",
  }
}

function communityFromRow(row: Row, role?: TenantRole): TenantCommunity {
  return {
    id: str(row.id) ?? "",
    name: str(row.name) ?? "",
    term: str(row.term) ?? "",
    createdBy: str(row.created_by) ?? "",
    createdAt: str(row.created_at) ?? "",
    updatedAt: str(row.updated_at) ?? "",
    ...(role ? { role } : {}),
  }
}

function inviteFromRow(row: Row): TenantInvite {
  return {
    id: str(row.id) ?? "",
    communityId: str(row.community_id) ?? "",
    role: (str(row.role) ?? "student") as TenantRole,
    mode: (str(row.mode) ?? (Number(row.max_uses) === 1 ? "single-use" : "reusable")) as TenantInvite["mode"],
    maxUses: row.max_uses === null || row.max_uses === undefined ? null : Number(row.max_uses),
    uses: Number(row.uses ?? 0),
    createdBy: str(row.created_by) ?? "",
    createdAt: str(row.created_at) ?? "",
    ...(str(row.expires_at) ? { expiresAt: str(row.expires_at) } : {}),
    ...(str(row.revoked_at) ? { revokedAt: str(row.revoked_at) } : {}),
  }
}

function userRow(database: DatabaseSync, userId: string): Row {
  const row = database.prepare("SELECT * FROM tenant_users WHERE id = ?").get(userId) as Row | undefined
  if (!row || str(row.status) !== "active") fail("unauthorized", "User account is not active")
  return row
}

function communityRow(database: DatabaseSync, communityId: string): Row {
  const row = database.prepare("SELECT * FROM tenant_communities WHERE id = ?").get(communityId) as Row | undefined
  if (!row) fail("not_found", "Community does not exist")
  return row
}

function membershipRow(database: DatabaseSync, communityId: string, userId: string): Row {
  const row = database.prepare(`
    SELECT m.*, u.display_name, u.initials, u.tone, u.status AS user_status,
           u.created_at AS user_created_at, u.updated_at AS user_updated_at
    FROM tenant_memberships m JOIN tenant_users u ON u.id = m.user_id
    WHERE m.community_id = ? AND m.user_id = ? AND m.status = 'active'
  `).get(communityId, userId) as Row | undefined
  if (!row || str(row.user_status) !== "active") fail("forbidden", "You are not an active member of this community")
  return row
}

function role(database: DatabaseSync, communityId: string, userId: string): TenantRole {
  return (str(membershipRow(database, communityId, userId).role) ?? "student") as TenantRole
}

function teacher(database: DatabaseSync, communityId: string, userId: string): void {
  if (role(database, communityId, userId) !== "teacher") fail("forbidden", "Only a teacher can do this")
}

function userPerson(row: Row, communityId: string, membershipRole: TenantRole, presence: Presence | "offline" = "offline"): Person & { communityId: string } {
  return {
    kind: "person",
    id: str(row.id) ?? "",
    name: str(row.display_name) ?? "",
    initials: str(row.initials) ?? "",
    tone: (str(row.tone) ?? "card") as Person["tone"],
    role: membershipRole,
    presence: presence as Presence,
    communityId,
  }
}

function channelMemberIds(database: DatabaseSync, communityId: string, channelId: string): string[] {
  return (database.prepare("SELECT member_id FROM tenant_channel_members WHERE community_id = ? AND channel_id = ? ORDER BY created_at, member_id, member_kind")
    .all(communityId, channelId) as Row[]).map((row) => str(row.member_id) ?? "")
}

function channelFromRow(database: DatabaseSync, row: Row): TenantChannel {
  const id = str(row.id) ?? ""
  const communityId = str(row.community_id) ?? ""
  const memberIds = channelMemberIds(database, communityId, id)
  const memberCount = Number((database.prepare("SELECT COUNT(*) AS n FROM tenant_channel_members WHERE community_id = ? AND channel_id = ?").get(communityId, id) as Row).n ?? 0)
  return {
    id,
    communityId,
    name: str(row.name) ?? id,
    group: "course",
    visibility: (str(row.visibility) ?? "open") as Channel["visibility"],
    status: (str(row.status) ?? "active") as Channel["status"],
    createdBy: str(row.created_by),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    archivedAt: str(row.archived_at),
    description: str(row.description),
    memberIds,
    memberCount,
    unread: false,
    kind: (str(row.kind) ?? "channel") as TenantChannel["kind"],
    dmAgentId: str(row.dm_agent_id),
  }
}

function agentFromRow(database: DatabaseSync, row: Row, presence: ReadonlyMap<string, Presence | "offline"> = new Map()): TenantAgent {
  const id = str(row.id) ?? ""
  return {
    kind: "agent",
    id,
    communityId: str(row.community_id) ?? "",
    name: str(row.name) ?? id,
    ...(row.system_role === "ada" ? { systemRole: "ada" as const } : {}),
    ...(str(row.avatar_url) ? { avatarUrl: str(row.avatar_url) } : {}),
    instructions: str(row.instructions) ?? "",
    runtime: (str(row.runtime) ?? "claude") as TenantAgent["runtime"],
    model: str(row.model) ?? "",
    createdBy: str(row.created_by) ?? "",
    status: (str(row.status) ?? "active") as TenantAgent["status"],
    channelIds: (database.prepare("SELECT id FROM tenant_channels WHERE community_id = ? AND kind != 'dm' AND id IN (SELECT channel_id FROM tenant_channel_members WHERE member_id = ?) ORDER BY id")
      .all(str(row.community_id) ?? "", id) as Row[]).map((item) => str(item.id) ?? ""),
    presence: presence.get(id) ?? "offline",
    createdAt: str(row.created_at) ?? "",
    updatedAt: str(row.updated_at) ?? "",
    deletedAt: str(row.deleted_at),
    deletedBy: str(row.deleted_by),
  }
}

function messageFromRow(row: Row): TenantMessage {
  let body: Record<string, unknown> = {}
  try { body = JSON.parse(str(row.body) ?? "{}") as Record<string, unknown> } catch { /* invalid legacy body is empty */ }
  const paragraphs = Array.isArray(body.paragraphs) ? body.paragraphs : [[{ kind: "text", text: typeof body.text === "string" ? body.text : "" }]]
  return {
    id: str(row.id) ?? "",
    communityId: str(row.community_id) ?? "",
    channelId: str(row.channel_id) ?? "",
    authorId: str(row.author_id) ?? "",
    authorKind: (str(row.author_kind) ?? "user") as TenantMessage["authorKind"],
    at: str(row.created_at) ?? "",
    createdAt: str(row.created_at) ?? "",
    paragraphs: paragraphs as Message["paragraphs"],
    threadId: str(row.thread_id),
    clientId: str(row.client_id),
    editedAt: str(row.edited_at),
    deletedAt: str(row.deleted_at),
    deletedBy: str(row.deleted_by),
  }
}

function cardFromRow(row: Row): TenantCard {
  return {
    id: str(row.id) ?? "",
    communityId: str(row.community_id) ?? "",
    channelId: str(row.channel_id) ?? "",
    authorId: str(row.author_id) ?? "",
    path: str(row.path) ?? "",
    title: str(row.title) ?? "",
    type: str(row.type) ?? "note",
    body: str(row.body) ?? "",
    version: Number(row.version ?? 1),
    replaces: str(row.replaces),
    createdAt: str(row.created_at) ?? "",
  }
}

function activeCommunityAgent(database: DatabaseSync, communityId: string, agentId: string): Row {
  const row = database.prepare("SELECT * FROM tenant_agents WHERE id = ? AND community_id = ? AND status = 'active'").get(agentId, communityId) as Row | undefined
  if (!row) fail("not_found", "Agent does not exist")
  return row
}

function channelRow(database: DatabaseSync, communityId: string, channelId: string): Row {
  const row = database.prepare("SELECT * FROM tenant_channels WHERE id = ? AND community_id = ?").get(channelId, communityId) as Row | undefined
  if (!row) fail("not_found", "Channel does not exist")
  return row
}

function agentAssignmentChannel(database: DatabaseSync, communityId: string, channelId: string): void {
  const row = channelRow(database, communityId, channelId)
  if (str(row.kind) === "dm") fail("forbidden", "Agents cannot be assigned to a private user DM")
}

function channelMembership(database: DatabaseSync, communityId: string, channelId: string, memberId: string, memberKind?: "user" | "agent"): boolean {
  return Boolean(database.prepare(`SELECT 1 FROM tenant_channel_members WHERE community_id = ? AND channel_id = ? AND member_id = ? ${memberKind ? "AND member_kind = ?" : ""}`)
    .get(...(memberKind ? [communityId, channelId, memberId, memberKind] : [communityId, channelId, memberId])))
}

export function findTenantUserByToken(database: DatabaseSync, rawToken: string): TenantUser | undefined {
  const row = database.prepare("SELECT * FROM tenant_users WHERE token_digest = ? AND status = 'active'").get(digest(rawToken)) as Row | undefined
  return row ? userFromRow(row) : undefined
}

export function findTenantAgentByToken(database: DatabaseSync, rawToken: string): TenantAgent | undefined {
  const row = database.prepare("SELECT * FROM tenant_agents WHERE runner_token_digest = ? AND status = 'active'").get(digest(rawToken)) as Row | undefined
  if (!row) return undefined
  return agentFromRow(database, row)
}

export function createTenantUser(database: DatabaseSync, displayName: string): { user: TenantUser; token: string } {
  const name = displayName.trim().replace(/\s+/g, " ")
  if (!name || name.length > 160) fail("invalid_input", "displayName must be between 1 and 160 characters", "displayName")
  const rawToken = token()
  const timestamp = now()
  return transaction(database, () => {
    const id = `user-${randomUUID()}`
    database.prepare(`INSERT INTO tenant_users (id, display_name, initials, tone, token_digest, created_at, updated_at)
      VALUES (?, ?, ?, 'card', ?, ?, ?)`)
      .run(id, name, initials(name), digest(rawToken), timestamp, timestamp)
    const row = database.prepare("SELECT * FROM tenant_users WHERE id = ?").get(id) as Row
    return { user: userFromRow(row), token: rawToken }
  })
}

export function updateTenantUser(database: DatabaseSync, userId: string, displayName: string): TenantUser {
  userRow(database, userId)
  const name = displayName.trim().replace(/\s+/g, " ")
  if (!name || name.length > 160) fail("invalid_input", "displayName must be between 1 and 160 characters", "displayName")
  return transaction(database, () => {
    database.prepare("UPDATE tenant_users SET display_name = ?, initials = ?, updated_at = ? WHERE id = ?")
      .run(name, initials(name), now(), userId)
    return userFromRow(userRow(database, userId))
  })
}

export function sessionForUser(database: DatabaseSync, userId: string): { user: TenantUser; communities: TenantCommunity[] } {
  const user = userFromRow(userRow(database, userId))
  const rows = database.prepare(`SELECT c.*, m.role FROM tenant_communities c
    JOIN tenant_memberships m ON m.community_id = c.id
    WHERE m.user_id = ? AND m.status = 'active' ORDER BY c.created_at`).all(userId) as Row[]
  return { user, communities: rows.map((row) => communityFromRow(row, str(row.role) as TenantRole)) }
}

export function listTenantCommunities(database: DatabaseSync, userId: string): TenantCommunity[] {
  return sessionForUser(database, userId).communities
}

export function createTenantCommunity(database: DatabaseSync, userId: string, name: string, term: string, starters: { runtime: "claude" | "codex" | "pi"; model: string } = { runtime: "pi", model: "gpt-5.6-luna" }, includeCurator = true): TenantCommunity {
  userRow(database, userId)
  const cleanName = name.trim().replace(/\s+/g, " ")
  const cleanTerm = term.trim().replace(/\s+/g, " ")
  if (!cleanName || cleanName.length > 120) fail("invalid_input", "name must be between 1 and 120 characters", "name")
  if (!cleanTerm || cleanTerm.length > 120) fail("invalid_input", "term must be between 1 and 120 characters", "term")
  const timestamp = now()
  return transaction(database, () => {
    const id = `community-${randomUUID()}`
    database.prepare("INSERT INTO tenant_communities (id, name, term, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, cleanName, cleanTerm, userId, timestamp, timestamp)
    database.prepare("INSERT INTO tenant_memberships (community_id, user_id, role, created_at, updated_at) VALUES (?, ?, 'teacher', ?, ?)")
      .run(id, userId, timestamp, timestamp)
    new MemoryFiles(database, id).initialize()
    if (starters) {
      for (const template of agentTemplates) {
        if (template.id !== "tutor" && !includeCurator) continue
        const created = createTenantAgent(database, id, userId, {
        name: template.name, instructions: template.instructions, ...starters, channelIds: [],
      })
        if (template.id === "tutor") database.prepare("UPDATE tenant_agents SET system_role = 'ada' WHERE id = ?").run(created.agent.id)
      }
    }
    return communityFromRow(database.prepare("SELECT * FROM tenant_communities WHERE id = ?").get(id) as Row, "teacher")
  })
}

export function getTenantCommunity(database: DatabaseSync, communityId: string, userId: string): TenantCommunity {
  const row = communityRow(database, communityId)
  return communityFromRow(row, role(database, communityId, userId))
}

export function createTenantInvite(database: DatabaseSync, communityId: string, actorId: string, inviteRole: TenantRole, inviteMode: TenantInvite["mode"], maxUses: number | null, expiresAt?: string): TenantInvite & { code: string } {
  teacher(database, communityId, actorId)
  if (inviteMode !== "single-use" && inviteMode !== "reusable") fail("invalid_input", "mode must be single-use or reusable", "mode")
  if (inviteMode === "single-use" && maxUses !== 1) fail("invalid_input", "single-use invites must have one use", "maxUses")
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100_000)) fail("invalid_input", "maxUses must be null or an integer between 1 and 100000", "maxUses")
  const code = randomBytes(32).toString("base64url")
  const createdAt = now()
  const id = `invite-${randomUUID()}`
  transaction(database, () => {
    if (expiresAt && Number.isNaN(Date.parse(expiresAt))) fail("invalid_input", "expiresAt must be an ISO timestamp", "expiresAt")
    database.prepare(`INSERT INTO tenant_invites (id, community_id, code_digest, role, mode, max_uses, uses, created_by, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`).run(id, communityId, digest(code), inviteRole, inviteMode, maxUses, actorId, createdAt, expiresAt ?? null)
  })
  return { id, communityId, role: inviteRole, mode: inviteMode, maxUses, uses: 0, createdBy: actorId, createdAt, ...(expiresAt ? { expiresAt } : {}), code }
}

export function listTenantInvites(database: DatabaseSync, communityId: string, actorId: string): TenantInvite[] {
  teacher(database, communityId, actorId)
  const timestamp = now()
  const rows = database.prepare(`SELECT * FROM tenant_invites
    WHERE community_id = ? AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > ?)
      AND (max_uses IS NULL OR uses < max_uses)
    ORDER BY created_at DESC, id DESC`).all(communityId, timestamp) as Row[]
  return rows.map(inviteFromRow)
}

export function revokeTenantInvite(database: DatabaseSync, communityId: string, actorId: string, inviteId: string): TenantInvite {
  teacher(database, communityId, actorId)
  const row = database.prepare("SELECT * FROM tenant_invites WHERE community_id = ? AND id = ?").get(communityId, inviteId) as Row | undefined
  if (!row) fail("not_found", "Invite does not exist")
  if (str(row.revoked_at)) return inviteFromRow(row)
  return transaction(database, () => {
    database.prepare("UPDATE tenant_invites SET revoked_at = ? WHERE community_id = ? AND id = ?")
      .run(now(), communityId, inviteId)
    return inviteFromRow(database.prepare("SELECT * FROM tenant_invites WHERE community_id = ? AND id = ?").get(communityId, inviteId) as Row)
  })
}

export function redeemTenantInvite(database: DatabaseSync, code: string, userId: string): { membership: TenantMembership; consumed: boolean } {
  userRow(database, userId)
  if (!code.trim()) fail("invalid_input", "code is required", "code")
  return transaction(database, () => {
    const row = database.prepare("SELECT * FROM tenant_invites WHERE code_digest = ?").get(digest(code.trim())) as Row | undefined
    if (!row) fail("not_found", "Invite code does not exist")
    if (str(row.revoked_at)) fail("conflict", "Invite code has been revoked")
    const expiresAt = str(row.expires_at)
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) fail("conflict", "Invite code has expired")
    const maxUses = row.max_uses === null || row.max_uses === undefined ? null : Number(row.max_uses)
    const uses = Number(row.uses ?? 0)
    const communityId = str(row.community_id) ?? ""
    const existing = database.prepare("SELECT * FROM tenant_memberships WHERE community_id = ? AND user_id = ?").get(communityId, userId) as Row | undefined
    if (existing && str(existing.status) === "active") {
      const user = userFromRow(userRow(database, userId))
      return { membership: { ...user, communityId, role: (str(existing.role) ?? "student") as TenantRole }, consumed: false }
    }
    if (maxUses !== null && uses >= maxUses) fail("conflict", "Invite code has no uses remaining")
    const timestamp = now()
    if (existing) {
      database.prepare("UPDATE tenant_memberships SET role = ?, status = 'active', updated_at = ? WHERE community_id = ? AND user_id = ?")
        .run(str(row.role) ?? "student", timestamp, communityId, userId)
    } else {
      database.prepare("INSERT INTO tenant_memberships (community_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .run(communityId, userId, str(row.role) ?? "student", timestamp, timestamp)
    }
    database.prepare("UPDATE tenant_invites SET uses = uses + 1 WHERE id = ?").run(str(row.id) ?? "")
    const user = userFromRow(userRow(database, userId))
    return { membership: { ...user, communityId, role: (str(row.role) ?? "student") as TenantRole }, consumed: true }
  })
}

export function listTenantMembers(database: DatabaseSync, communityId: string, actorId: string): Array<TenantMembership> {
  membershipRow(database, communityId, actorId)
  const rows = database.prepare(`SELECT m.*, u.* FROM tenant_memberships m JOIN tenant_users u ON u.id = m.user_id
    WHERE m.community_id = ? AND m.status = 'active' ORDER BY m.created_at`).all(communityId) as Row[]
  return rows.map((row) => ({ ...userFromRow(row), communityId, role: (str(row.role) ?? "student") as TenantRole }))
}

export function updateTenantMembershipRole(database: DatabaseSync, communityId: string, actorId: string, targetId: string, nextRole: TenantRole): TenantMembership {
  teacher(database, communityId, actorId)
  if (nextRole !== "teacher" && nextRole !== "student") fail("invalid_input", "role must be teacher or student", "role")
  const target = membershipRow(database, communityId, targetId)
  const currentRole = (str(target.role) ?? "student") as TenantRole
  if (currentRole === nextRole) {
    return { ...userFromRow(userRow(database, targetId)), communityId, role: currentRole }
  }
  if (currentRole === "teacher" && nextRole === "student") {
    const count = Number((database.prepare("SELECT COUNT(*) AS n FROM tenant_memberships WHERE community_id = ? AND role = 'teacher' AND status = 'active'").get(communityId) as Row).n ?? 0)
    if (count <= 1) fail("conflict", "A community must retain at least one teacher")
  }
  return transaction(database, () => {
    database.prepare("UPDATE tenant_memberships SET role = ?, updated_at = ? WHERE community_id = ? AND user_id = ? AND status = 'active'")
      .run(nextRole, now(), communityId, targetId)
    return { ...userFromRow(userRow(database, targetId)), communityId, role: nextRole }
  })
}

export function removeTenantMember(database: DatabaseSync, communityId: string, actorId: string, targetId: string): TenantMembership {
  teacher(database, communityId, actorId)
  const target = membershipRow(database, communityId, targetId)
  if (targetId === actorId) fail("conflict", "Use leave to remove your own membership")
  if (str(target.role) === "teacher") {
    const count = Number((database.prepare("SELECT COUNT(*) AS n FROM tenant_memberships WHERE community_id = ? AND role = 'teacher' AND status = 'active'").get(communityId) as Row).n ?? 0)
    if (count <= 1) fail("conflict", "A community must retain at least one teacher")
  }
  return transaction(database, () => {
    const endedAt = now()
    database.prepare("UPDATE tenant_memberships SET status = 'removed', ended_at = ?, ended_by = ?, updated_at = ? WHERE community_id = ? AND user_id = ?")
      .run(endedAt, actorId, endedAt, communityId, targetId)
    database.prepare("DELETE FROM tenant_channel_members WHERE community_id = ? AND member_id = ? AND member_kind = 'user'")
      .run(communityId, targetId)
    return { ...userFromRow(userRow(database, targetId)), communityId, role: (str(target.role) ?? "student") as TenantRole, status: "removed" as const }
  })
}

export function leaveTenantCommunity(database: DatabaseSync, communityId: string, userId: string): void {
  const member = membershipRow(database, communityId, userId)
  if (str(member.role) === "teacher") {
    const count = Number((database.prepare("SELECT COUNT(*) AS n FROM tenant_memberships WHERE community_id = ? AND role = 'teacher' AND status = 'active'").get(communityId) as Row).n ?? 0)
    if (count <= 1) fail("conflict", "The last teacher cannot leave the community")
  }
  transaction(database, () => {
    const endedAt = now()
    database.prepare("UPDATE tenant_memberships SET status = 'left', ended_at = ?, updated_at = ? WHERE community_id = ? AND user_id = ?")
      .run(endedAt, endedAt, communityId, userId)
    database.prepare("DELETE FROM tenant_channel_members WHERE community_id = ? AND member_id = ? AND member_kind = 'user'")
      .run(communityId, userId)
  })
}

function canReadRow(database: DatabaseSync, communityId: string, channel: Row, userId: string): boolean {
  try { membershipRow(database, communityId, userId) } catch { return false }
  const kind = str(channel.kind) ?? "channel"
  if (kind === "dm") return role(database, communityId, userId) === "teacher" || channelMembership(database, communityId, str(channel.id) ?? "", userId, "user")
  // Open means discoverable. Reading history still requires an explicit join;
  // teachers are moderators and can inspect every channel in their community.
  return channelMembership(database, communityId, str(channel.id) ?? "", userId, "user") || role(database, communityId, userId) === "teacher"
}

export function canReadTenantChannel(database: DatabaseSync, communityId: string, channelId: string, userId: string): boolean {
  const row = database.prepare("SELECT * FROM tenant_channels WHERE id = ? AND community_id = ?").get(channelId, communityId) as Row | undefined
  return Boolean(row && canReadRow(database, communityId, row, userId))
}

function canPostTenantChannel(database: DatabaseSync, communityId: string, channelId: string, actorId: string): Row {
  const row = channelRow(database, communityId, channelId)
  if (str(row.status) === "archived") fail("channel_archived", "Archived channels reject new messages")
  membershipRow(database, communityId, actorId)
  if (!channelMembership(database, communityId, channelId, actorId, "user")) fail("not_channel_member", "Join this channel before posting")
  return row
}

function canPostTenantAgent(database: DatabaseSync, communityId: string, agentId: string, channelId: string): Row {
  activeCommunityAgent(database, communityId, agentId)
  const row = channelRow(database, communityId, channelId)
  if (str(row.status) === "archived") fail("channel_archived", "Archived channels reject new messages")
  if (!channelMembership(database, communityId, channelId, agentId, "agent")) fail("not_channel_member", "Agent is not assigned to this channel")
  return row
}

function canModerateTenantChannel(database: DatabaseSync, communityId: string, actorId: string, channelId: string): Row {
  const row = channelRow(database, communityId, channelId)
  membershipRow(database, communityId, actorId)
  if (role(database, communityId, actorId) !== "teacher" && !channelMembership(database, communityId, channelId, actorId, "user")) fail("not_channel_member", "You are not a member of this channel")
  return row
}

function nonEmptyBody(input: { paragraphs?: unknown; text?: string }): boolean {
  if (typeof input.text === "string" && input.text.trim()) return true
  if (!Array.isArray(input.paragraphs)) return false
  return input.paragraphs.some((paragraph) => Array.isArray(paragraph) && paragraph.some((block) => {
    if (!block || typeof block !== "object") return false
    const text = (block as { text?: unknown }).text
    return typeof text === "string" && text.trim().length > 0
  }))
}

export function listTenantChannels(database: DatabaseSync, communityId: string, userId: string, includeArchived = true): TenantChannel[] {
  membershipRow(database, communityId, userId)
  const rows = database.prepare("SELECT * FROM tenant_channels WHERE community_id = ? ORDER BY created_at").all(communityId) as Row[]
  return rows.filter((row) => (includeArchived || str(row.status) === "active") && canReadRow(database, communityId, row, userId)).map((row) => channelFromRow(database, row))
}

/** Public channel directory: metadata only, never private membership lists or
    message history. Students can discover open channels before joining. */
export function listTenantChannelDirectory(database: DatabaseSync, communityId: string, userId: string): Array<{
  id: string; communityId: string; name: string; description?: string; kind: "channel" | "dm"; visibility: "public" | "private"; status: "active" | "archived"; memberCount: number; createdAt: string
}> {
  membershipRow(database, communityId, userId)
  const rows = database.prepare("SELECT * FROM tenant_channels WHERE community_id = ? ORDER BY created_at").all(communityId) as Row[]
  return rows.filter((row) => {
    const kind = str(row.kind) ?? "channel"
    return kind === "channel" && str(row.visibility) === "open" && str(row.status) === "active"
  }).map((row) => {
    const channel = channelFromRow(database, row)
    return { id: channel.id, communityId, name: channel.name, ...(channel.description ? { description: channel.description } : {}), kind: "channel" as const, visibility: "public" as const, status: "active" as const, memberCount: channel.memberCount ?? 0, createdAt: channel.createdAt ?? now() }
  })
}

export function createTenantChannel(database: DatabaseSync, communityId: string, actorId: string, input: {
  name: string; description?: string; visibility?: "open" | "private"; memberIds?: string[]; agentIds?: string[]
}): TenantChannel {
  const actorRole = role(database, communityId, actorId)
  const name = input.name.trim().replace(/\s+/g, " ")
  if (!name || name.length > 80) fail("invalid_input", "name must be between 1 and 80 characters", "name")
  if (actorRole !== "teacher") fail("forbidden", "Only a teacher can create channels")
  const visibility = input.visibility ?? "open"
  const userIds = [...new Set([actorId, ...(input.memberIds ?? [])])]
  const agentIds = [...new Set(input.agentIds ?? [])]
  for (const id of userIds) membershipRow(database, communityId, id)
  for (const id of agentIds) activeCommunityAgent(database, communityId, id)
  const timestamp = now()
  return transaction(database, () => {
    const id = `channel-${randomUUID()}`
    database.prepare(`INSERT INTO tenant_channels (id, community_id, name, description, visibility, status, kind, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', 'channel', ?, ?, ?)`).run(id, communityId, name, input.description?.trim() || null, visibility, actorId, timestamp, timestamp)
    const insert = database.prepare("INSERT INTO tenant_channel_members (channel_id, community_id, member_id, member_kind, created_at) VALUES (?, ?, ?, ?, ?)")
    for (const userId of userIds) insert.run(id, communityId, userId, "user", timestamp)
    for (const agentId of agentIds) insert.run(id, communityId, agentId, "agent", timestamp)
    return channelFromRow(database, database.prepare("SELECT * FROM tenant_channels WHERE id = ?").get(id) as Row)
  })
}

export function updateTenantChannel(database: DatabaseSync, communityId: string, actorId: string, channelId: string, input: {
  name?: string; description?: string | null; visibility?: "open" | "private"; status?: "active" | "archived"; memberIds?: string[]; agentIds?: string[]
}): TenantChannel {
  teacher(database, communityId, actorId)
  const current = channelRow(database, communityId, channelId)
  if (str(current.kind) === "dm") fail("forbidden", "DM channels cannot be reconfigured")
  const name = input.name === undefined ? str(current.name) ?? channelId : input.name.trim().replace(/\s+/g, " ")
  if (!name || name.length > 80) fail("invalid_input", "name must be between 1 and 80 characters", "name")
  const status = input.status ?? (str(current.status) as "active" | "archived")
  const timestamp = now()
  return transaction(database, () => {
    database.prepare(`UPDATE tenant_channels SET name = ?, description = ?, visibility = ?, status = ?, updated_at = ?, archived_at = ? WHERE id = ? AND community_id = ?`)
      .run(name, input.description === undefined ? str(current.description) ?? null : input.description?.trim() || null,
        input.visibility ?? str(current.visibility) ?? "open", status, timestamp, status === "archived" ? str(current.archived_at) ?? timestamp : null, channelId, communityId)
    if (input.memberIds || input.agentIds) {
      const userIds = [...new Set(input.memberIds ?? [])]
      const agentIds = [...new Set(input.agentIds ?? [])]
      for (const id of userIds) membershipRow(database, communityId, id)
      for (const id of agentIds) activeCommunityAgent(database, communityId, id)
      database.prepare("DELETE FROM tenant_channel_members WHERE channel_id = ? AND community_id = ?").run(channelId, communityId)
      const insert = database.prepare("INSERT INTO tenant_channel_members (channel_id, community_id, member_id, member_kind, created_at) VALUES (?, ?, ?, ?, ?)")
      for (const id of userIds) insert.run(channelId, communityId, id, "user", timestamp)
      for (const id of agentIds) insert.run(channelId, communityId, id, "agent", timestamp)
    }
    return channelFromRow(database, database.prepare("SELECT * FROM tenant_channels WHERE id = ?").get(channelId) as Row)
  })
}

export function joinTenantChannel(database: DatabaseSync, communityId: string, actorId: string, channelId: string): TenantChannel {
  membershipRow(database, communityId, actorId)
  const row = channelRow(database, communityId, channelId)
  if (str(row.status) === "archived") fail("channel_archived", "Archived channels cannot accept members")
  if ((str(row.visibility) ?? "open") !== "open") fail("not_channel_member", "Private channels require an invitation")
  transaction(database, () => database.prepare("INSERT OR IGNORE INTO tenant_channel_members (channel_id, community_id, member_id, member_kind, created_at) VALUES (?, ?, ?, 'user', ?)").run(channelId, communityId, actorId, now()))
  return channelFromRow(database, channelRow(database, communityId, channelId))
}

export function leaveTenantChannel(database: DatabaseSync, communityId: string, actorId: string, channelId: string): TenantChannel {
  membershipRow(database, communityId, actorId)
  const row = channelRow(database, communityId, channelId)
  if (str(row.kind) === "dm") fail("forbidden", "DM membership is managed by the conversation")
  if (str(row.status) === "archived") fail("channel_archived", "Archived channels cannot change membership")
  const result = database.prepare("DELETE FROM tenant_channel_members WHERE channel_id = ? AND member_id = ? AND member_kind = 'user'").run(channelId, actorId) as { changes?: number }
  if (result.changes !== 1) fail("not_channel_member", "You are not a member of this channel")
  return channelFromRow(database, channelRow(database, communityId, channelId))
}

export function createTenantAgentDm(database: DatabaseSync, communityId: string, actorId: string, agentId: string): TenantChannel {
  membershipRow(database, communityId, actorId)
  const agent = activeCommunityAgent(database, communityId, agentId)
  return transaction(database, () => {
    const existing = database.prepare("SELECT * FROM tenant_channels WHERE community_id = ? AND kind = 'dm' AND created_by = ? AND dm_agent_id = ? AND status = 'active'")
      .get(communityId, actorId, agentId) as Row | undefined
    if (existing) return channelFromRow(database, existing)
    const id = `dm-${randomUUID()}`
    const timestamp = now()
    database.prepare(`INSERT INTO tenant_channels (id, community_id, name, description, visibility, status, kind, dm_agent_id, created_by, created_at, updated_at)
      VALUES (?, ?, ?, NULL, 'private', 'active', 'dm', ?, ?, ?, ?)`).run(id, communityId, `DM · ${str(agent.name) ?? agentId}`, agentId, actorId, timestamp, timestamp)
    const insert = database.prepare("INSERT INTO tenant_channel_members (channel_id, community_id, member_id, member_kind, created_at) VALUES (?, ?, ?, ?, ?)")
    insert.run(id, communityId, actorId, "user", timestamp)
    insert.run(id, communityId, agentId, "agent", timestamp)
    return channelFromRow(database, database.prepare("SELECT * FROM tenant_channels WHERE id = ?").get(id) as Row)
  })
}

function agentEnrollment(rawToken: string, communityId: string, agentId: string, runtime: string, model: string): TenantAgentEnrollment {
  const server = process.env.ADA_SERVER ?? "http://localhost:8787"
  const shell = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`
  const cwd = `$HOME/.ada/agents/${agentId}`
  const materials = `$HOME/.ada/communities/${communityId}/raw`
  return { runnerToken: rawToken, setupCommand: `npx tsx packages/runner/src/cli.ts --server ${shell(server)} --community ${shell(communityId)} --agent ${shell(agentId)} --cwd "${cwd}" --materials "${materials}" --runtime ${shell(runtime)} --model ${shell(model || "default")} --token ${shell(rawToken)}` }
}

export function listTenantAgents(database: DatabaseSync, communityId: string, actorId: string, presence: ReadonlyMap<string, Presence | "offline"> = new Map()): TenantAgent[] {
  membershipRow(database, communityId, actorId)
  const rows = database.prepare("SELECT * FROM tenant_agents WHERE community_id = ? ORDER BY created_at").all(communityId) as Row[]
  return rows.filter((row) => str(row.status) === "active").map((row) => agentFromRow(database, row, presence))
}

export function getTenantAgent(database: DatabaseSync, communityId: string, actorId: string, agentId: string, presence: ReadonlyMap<string, Presence | "offline"> = new Map()): TenantAgent {
  membershipRow(database, communityId, actorId)
  const row = database.prepare("SELECT * FROM tenant_agents WHERE community_id = ? AND id = ?").get(communityId, agentId) as Row | undefined
  if (!row) fail("not_found", "Agent does not exist")
  return agentFromRow(database, row, presence)
}

/** Runner authentication is already the authorization boundary. This lookup
    intentionally takes no user actor, but still pins the identity to the
    requested community and returns a safe projection (never the digest). */
export function getTenantAgentById(database: DatabaseSync, communityId: string, agentId: string, presence: ReadonlyMap<string, Presence | "offline"> = new Map()): TenantAgent | undefined {
  const row = database.prepare("SELECT * FROM tenant_agents WHERE community_id = ? AND id = ?").get(communityId, agentId) as Row | undefined
  return row ? agentFromRow(database, row, presence) : undefined
}

export function listTenantChannelAgents(database: DatabaseSync, communityId: string, channelId: string, presence: ReadonlyMap<string, Presence | "offline"> = new Map()): TenantAgent[] {
  const rows = database.prepare(`SELECT a.* FROM tenant_agents a
    JOIN tenant_channel_members cm ON cm.member_id = a.id AND cm.member_kind = 'agent' AND cm.community_id = a.community_id
    WHERE a.community_id = ? AND cm.channel_id = ? AND a.status = 'active' ORDER BY a.created_at`).all(communityId, channelId) as Row[]
  return rows.map((row) => agentFromRow(database, row, presence))
}

export function createTenantAgent(database: DatabaseSync, communityId: string, actorId: string, input: {
  name: string; avatarUrl?: string | null; instructions: string; runtime: "claude" | "codex" | "pi"; model?: string; channelIds?: string[]
}): TenantAgentResult {
  teacher(database, communityId, actorId)
  const name = input.name.trim().replace(/\s+/g, " ")
  if (!name || name.length > 80) fail("invalid_input", "name must be between 1 and 80 characters", "name")
  if (input.instructions.length > 20_000) fail("invalid_input", "instructions are too long", "instructions")
  for (const channelId of input.channelIds ?? []) agentAssignmentChannel(database, communityId, channelId)
  const rawToken = token()
  const id = `agent-${randomUUID()}`
  const timestamp = now()
  const agent = transaction(database, () => {
    database.prepare(`INSERT INTO tenant_agents (id, community_id, name, avatar_url, instructions, runtime, model, created_by, status, runner_token_digest, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`)
      .run(id, communityId, name, input.avatarUrl ?? null, input.instructions, input.runtime, input.model ?? "", actorId, digest(rawToken), timestamp, timestamp)
    for (const channelId of [...new Set(input.channelIds ?? [])]) database.prepare("INSERT INTO tenant_channel_members (channel_id, community_id, member_id, member_kind, created_at) VALUES (?, ?, ?, 'agent', ?)").run(channelId, communityId, id, timestamp)
    return agentFromRow(database, database.prepare("SELECT * FROM tenant_agents WHERE id = ?").get(id) as Row)
  })
  return { agent, enrollment: agentEnrollment(rawToken, communityId, id, input.runtime, input.model ?? "default") }
}

export function updateTenantAgent(database: DatabaseSync, communityId: string, actorId: string, agentId: string, input: {
  name?: string; avatarUrl?: string | null; instructions?: string; runtime?: "claude" | "codex" | "pi"; model?: string; channelIds?: string[]; status?: "active" | "deleted"
}, presence: ReadonlyMap<string, Presence | "offline"> = new Map()): TenantAgent {
  teacher(database, communityId, actorId)
  const current = activeCommunityAgent(database, communityId, agentId)
  if (current.system_role === "ada" && (input.status === "deleted" || input.name !== undefined && input.name !== "Ada")) fail("conflict", "Ada is the primary course agent and cannot be renamed or deleted")
  if (input.channelIds) for (const channelId of input.channelIds) agentAssignmentChannel(database, communityId, channelId)
  const status = input.status ?? (str(current.status) as TenantAgent["status"])
  const timestamp = now()
  return transaction(database, () => {
    database.prepare(`UPDATE tenant_agents SET name = ?, avatar_url = ?, instructions = ?, runtime = ?, model = ?, status = ?, deleted_at = ?, deleted_by = ?, updated_at = ? WHERE id = ? AND community_id = ?`)
      .run(input.name?.trim() ?? str(current.name) ?? "", input.avatarUrl === undefined ? str(current.avatar_url) ?? null : input.avatarUrl ?? null,
        input.instructions ?? str(current.instructions) ?? "", input.runtime ?? str(current.runtime) ?? "claude", input.model ?? str(current.model) ?? "",
        status, status === "deleted" ? str(current.deleted_at) ?? timestamp : null, status === "deleted" ? actorId : null, timestamp, agentId, communityId)
    if (input.channelIds) {
      database.prepare("DELETE FROM tenant_channel_members WHERE member_id = ? AND community_id = ? AND member_kind = 'agent' AND channel_id IN (SELECT id FROM tenant_channels WHERE community_id = ? AND kind != 'dm')").run(agentId, communityId, communityId)
      for (const channelId of [...new Set(input.channelIds)]) database.prepare("INSERT INTO tenant_channel_members (channel_id, community_id, member_id, member_kind, created_at) VALUES (?, ?, ?, 'agent', ?)").run(channelId, communityId, agentId, timestamp)
    }
    if (status === "deleted") {
      database.prepare("DELETE FROM tenant_channel_members WHERE member_id = ? AND community_id = ? AND member_kind = 'agent'").run(agentId, communityId)
      database.prepare("UPDATE tenant_channels SET status = 'archived', archived_at = ?, updated_at = ? WHERE community_id = ? AND kind = 'dm' AND dm_agent_id = ? AND status = 'active'").run(timestamp, timestamp, communityId, agentId)
    }
    return agentFromRow(database, database.prepare("SELECT * FROM tenant_agents WHERE id = ?").get(agentId) as Row, presence)
  })
}

export function rotateTenantAgentToken(database: DatabaseSync, communityId: string, actorId: string, agentId: string, presence: ReadonlyMap<string, Presence | "offline"> = new Map()): TenantAgentResult {
  teacher(database, communityId, actorId)
  const current = activeCommunityAgent(database, communityId, agentId)
  const rawToken = token()
  transaction(database, () => database.prepare("UPDATE tenant_agents SET runner_token_digest = ?, updated_at = ? WHERE id = ? AND community_id = ?").run(digest(rawToken), now(), agentId, communityId))
  return { agent: agentFromRow(database, database.prepare("SELECT * FROM tenant_agents WHERE id = ?").get(agentId) as Row, presence), enrollment: agentEnrollment(rawToken, communityId, agentId, str(current.runtime) ?? "claude", str(current.model) ?? "default") }
}

export function deleteTenantAgent(database: DatabaseSync, communityId: string, actorId: string, agentId: string, presence: ReadonlyMap<string, Presence | "offline"> = new Map()): TenantAgent {
  return updateTenantAgent(database, communityId, actorId, agentId, { status: "deleted" }, presence)
}

export function listTenantMessages(database: DatabaseSync, communityId: string, userId: string, channelId?: string): TenantMessage[] {
  membershipRow(database, communityId, userId)
  const rows = database.prepare(`SELECT * FROM tenant_messages WHERE community_id = ? ${channelId ? "AND channel_id = ?" : ""} ORDER BY created_at`).all(...(channelId ? [communityId, channelId] : [communityId])) as Row[]
  return rows.filter((row) => canReadTenantChannel(database, communityId, str(row.channel_id) ?? "", userId)).map(messageFromRow)
}

export function createTenantMessage(database: DatabaseSync, communityId: string, actorId: string, channelId: string, input: {
  paragraphs?: unknown; text?: string; threadId?: string; clientId?: string
}): TenantMessage {
  canPostTenantChannel(database, communityId, channelId, actorId)
  if (!nonEmptyBody(input)) fail("invalid_input", "Message cannot be empty")
  const identities = [...listTenantAgents(database, communityId, actorId), ...listTenantMembers(database, communityId, actorId)]
    .map((member) => ({ id: member.id, name: "name" in member ? member.name : member.displayName }))
  const paragraphs = (input.paragraphs ?? [[{ kind: "text", text: input.text ?? "" }]]) as Message["paragraphs"]
  const normalized = paragraphs.map((paragraph) => paragraph.flatMap((block) => block.kind === "text" ? resolveTextMentions(block.text, identities) : [block]))
  const body = { paragraphs: normalized }

  if (!Object.keys(body).length) fail("invalid_input", "Message body is required")
  if (input.threadId) {
    const thread = database.prepare("SELECT * FROM tenant_threads WHERE id = ? AND community_id = ? AND channel_id = ?").get(input.threadId, communityId, channelId)
    if (!thread) fail("not_found", "Thread does not exist")
  }
  if (input.clientId) {
    const existing = database.prepare("SELECT * FROM tenant_messages WHERE community_id = ? AND author_id = ? AND client_id = ?").get(communityId, actorId, input.clientId) as Row | undefined
    if (existing) return messageFromRow(existing)
  }
  const id = `message-${randomUUID()}`
  const timestamp = now()
  return transaction(database, () => {
    const channel = channelRow(database, communityId, channelId)
    const mentionedIds = new Set(normalized.flat().filter((block) => block.kind === "mention").map((block) => block.memberId))
    for (const memberId of mentionedIds) {
      const identity = identities.find((item) => item.id === memberId)
      if (!identity) fail("invalid_input", "A mentioned member is no longer available in this community")
      for (const block of normalized.flat()) if (block.kind === "mention" && block.memberId === memberId) block.text = `@${identity.name}`
      if (channelMembership(database, communityId, channelId, memberId)) continue
      const agent = database.prepare("SELECT id FROM tenant_agents WHERE id = ? AND community_id = ? AND status = 'active'").get(memberId, communityId)
      if (!agent || channel.kind === "dm") fail("forbidden", "Only members of this conversation can be mentioned")
      if (role(database, communityId, actorId) !== "teacher") fail("forbidden", "Only teachers can add an agent by mentioning it")
      database.prepare("INSERT INTO tenant_channel_members (channel_id, community_id, member_id, member_kind, created_at) VALUES (?, ?, ?, 'agent', ?)").run(channelId, communityId, memberId, timestamp)
      database.prepare("UPDATE tenant_agents SET updated_at = ? WHERE id = ?").run(timestamp, memberId)
      database.prepare("UPDATE tenant_channels SET updated_at = ? WHERE id = ?").run(timestamp, channelId)
    }
    database.prepare(`INSERT INTO tenant_messages (id, community_id, channel_id, author_id, author_kind, body, thread_id, client_id, created_at)
      VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?)`).run(id, communityId, channelId, actorId, JSON.stringify(body), input.threadId ?? null, input.clientId ?? null, timestamp)
    return messageFromRow(database.prepare("SELECT * FROM tenant_messages WHERE id = ?").get(id) as Row)
  })
}

export function createTenantAgentMessage(database: DatabaseSync, communityId: string, agentId: string, channelId: string, input: { paragraphs?: unknown; text?: string; threadId?: string }): TenantMessage {
  canPostTenantAgent(database, communityId, agentId, channelId)
  if (!nonEmptyBody(input)) fail("invalid_input", "Message cannot be empty")
  const body = input.paragraphs !== undefined ? { paragraphs: input.paragraphs } : { text: input.text ?? "" }
  if (input.threadId && !database.prepare("SELECT 1 FROM tenant_threads WHERE id = ? AND community_id = ? AND channel_id = ?").get(input.threadId, communityId, channelId)) fail("not_found", "Thread does not exist")
  const id = `message-${randomUUID()}`
  const timestamp = now()
  return transaction(database, () => {
    database.prepare(`INSERT INTO tenant_messages (id, community_id, channel_id, author_id, author_kind, body, thread_id, created_at)
      VALUES (?, ?, ?, ?, 'agent', ?, ?, ?)`).run(id, communityId, channelId, agentId, JSON.stringify(body), input.threadId ?? null, timestamp)
    return messageFromRow(database.prepare("SELECT * FROM tenant_messages WHERE id = ?").get(id) as Row)
  })
}

export function listTenantAgentContext(database: DatabaseSync, communityId: string, agentId: string, channelId: string, threadId?: string): TenantMessage[] {
  activeCommunityAgent(database, communityId, agentId)
  const rows = database.prepare(`SELECT * FROM tenant_messages WHERE community_id = ? AND channel_id = ?
    ${threadId ? "AND (thread_id = ? OR id = (SELECT root_message_id FROM tenant_threads WHERE id = ? AND community_id = ?))" : ""}
    ORDER BY created_at DESC LIMIT 50`).all(...(threadId ? [communityId, channelId, threadId, threadId, communityId] : [communityId, channelId])) as Row[]
  return rows.reverse().map(messageFromRow)
}

function messageInCommunity(database: DatabaseSync, communityId: string, messageId: string): Row {
  const row = database.prepare("SELECT * FROM tenant_messages WHERE id = ? AND community_id = ?").get(messageId, communityId) as Row | undefined
  if (!row) fail("not_found", "Message does not exist")
  return row
}

export function editTenantMessage(database: DatabaseSync, communityId: string, actorId: string, messageId: string, paragraphs: unknown): TenantMessage {
  const existing = messageInCommunity(database, communityId, messageId)
  if (!canReadTenantChannel(database, communityId, str(existing.channel_id) ?? "", actorId)) fail("not_found", "Message does not exist")
  canPostTenantChannel(database, communityId, str(existing.channel_id) ?? "", actorId)
  if (str(existing.deleted_at)) fail("conflict", "Deleted messages cannot be edited")
  if (str(existing.author_id) !== actorId) fail("forbidden", "Only the author can edit this message")
  if (!nonEmptyBody({ paragraphs })) fail("invalid_input", "Message cannot be empty")
  const editedAt = now()
  database.prepare("UPDATE tenant_messages SET body = ?, edited_at = ? WHERE id = ? AND community_id = ?").run(JSON.stringify({ paragraphs }), editedAt, messageId, communityId)
  return messageFromRow(messageInCommunity(database, communityId, messageId))
}

export function deleteTenantMessage(database: DatabaseSync, communityId: string, actorId: string, messageId: string): TenantMessage {
  const existing = messageInCommunity(database, communityId, messageId)
  if (!canReadTenantChannel(database, communityId, str(existing.channel_id) ?? "", actorId)) fail("not_found", "Message does not exist")
  canModerateTenantChannel(database, communityId, actorId, str(existing.channel_id) ?? "")
  if (str(existing.author_id) !== actorId && role(database, communityId, actorId) !== "teacher") fail("forbidden", "Only the author or a teacher can delete this message")
  if (str(existing.deleted_at)) return messageFromRow(existing)
  const deletedAt = now()
  database.prepare("UPDATE tenant_messages SET body = '{}', deleted_at = ?, deleted_by = ? WHERE id = ? AND community_id = ?").run(deletedAt, actorId, messageId, communityId)
  return messageFromRow(messageInCommunity(database, communityId, messageId))
}

export function createTenantThread(database: DatabaseSync, communityId: string, actorId: string, rootMessageId: string, channelId?: string): TenantThread {
  const root = messageInCommunity(database, communityId, rootMessageId)
  if (channelId !== undefined && str(root.channel_id) !== channelId) fail("forbidden", "Root message does not belong to this channel")
  canPostTenantChannel(database, communityId, str(root.channel_id) ?? "", actorId)
  const existing = database.prepare("SELECT * FROM tenant_threads WHERE root_message_id = ? AND community_id = ?").get(rootMessageId, communityId) as Row | undefined
  if (existing) return tenantThread(existing, database)
  const id = `thread-${randomUUID()}`
  const createdAt = now()
  return transaction(database, () => {
    database.prepare("INSERT INTO tenant_threads (id, community_id, channel_id, root_message_id, created_at) VALUES (?, ?, ?, ?, ?)").run(id, communityId, str(root.channel_id) ?? "", rootMessageId, createdAt)
    return tenantThread(database.prepare("SELECT * FROM tenant_threads WHERE id = ?").get(id) as Row, database)
  })
}

function tenantThread(row: Row, database: DatabaseSync): TenantThread {
  const id = str(row.id) ?? ""
  return {
    id,
    communityId: str(row.community_id) ?? "",
    channelId: str(row.channel_id) ?? "",
    rootMessageId: str(row.root_message_id) ?? "",
    replyIds: (database.prepare("SELECT id FROM tenant_messages WHERE thread_id = ? ORDER BY created_at").all(id) as Row[]).map((item) => str(item.id) ?? ""),
    createdAt: str(row.created_at) ?? "",
  }
}

export function listTenantThreads(database: DatabaseSync, communityId: string, userId: string, channelId?: string): TenantThread[] {
  membershipRow(database, communityId, userId)
  const rows = database.prepare(`SELECT * FROM tenant_threads WHERE community_id = ? ${channelId ? "AND channel_id = ?" : ""} ORDER BY created_at`).all(...(channelId ? [communityId, channelId] : [communityId])) as Row[]
  return rows.filter((row) => canReadTenantChannel(database, communityId, str(row.channel_id) ?? "", userId)).map((row) => tenantThread(row, database))
}

export function publishTenantCard(database: DatabaseSync, communityId: string, agentId: string, input: { channelId: string; path: string; title: string; type: string; body: string; sourceMessageIds?: string[]; replaces?: string }): TenantCard {
  activeCommunityAgent(database, communityId, agentId)
  canPostTenantAgent(database, communityId, agentId, input.channelId)
  for (const sourceId of input.sourceMessageIds ?? []) {
    const source = messageInCommunity(database, communityId, sourceId)
    if (str(source.channel_id) !== input.channelId) fail("forbidden", "Card sources must belong to the publication channel")
  }
  if (input.replaces && !database.prepare("SELECT 1 FROM tenant_cards WHERE id = ? AND community_id = ?").get(input.replaces, communityId)) {
    fail("not_found", "Replaced card does not exist in this community")
  }
  const timestamp = now()
  return transaction(database, () => {
    const existing = database.prepare("SELECT * FROM tenant_cards WHERE community_id = ? AND author_id = ? AND path = ?").get(communityId, agentId, input.path) as Row | undefined
    const version = Number(existing?.version ?? 0) + 1
    const id = str(existing?.id) ?? `card-${randomUUID()}`
    database.prepare(`INSERT INTO tenant_cards (id, community_id, channel_id, author_id, path, title, type, body, version, replaces, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(community_id, author_id, path) DO UPDATE SET channel_id=excluded.channel_id, title=excluded.title, type=excluded.type,
        body=excluded.body, version=excluded.version, replaces=excluded.replaces, created_at=excluded.created_at`).run(id, communityId, input.channelId, agentId, input.path, input.title, input.type, input.body, version, input.replaces ?? null, timestamp)
    return cardFromRow(database.prepare("SELECT * FROM tenant_cards WHERE id = ?").get(id) as Row)
  })
}

export function listTenantCards(database: DatabaseSync, communityId: string, agentId: string): TenantCard[] {
  activeCommunityAgent(database, communityId, agentId)
  const rows = database.prepare("SELECT * FROM tenant_cards WHERE community_id = ? ORDER BY created_at").all(communityId) as Row[]
  return rows.map((row) => ({
    id: str(row.id) ?? "", communityId, channelId: str(row.channel_id) ?? "", authorId: str(row.author_id) ?? "",
    path: str(row.path) ?? "", title: str(row.title) ?? "", type: str(row.type) ?? "note", body: str(row.body) ?? "",
    version: Number(row.version ?? 1), replaces: str(row.replaces), createdAt: str(row.created_at) ?? "",
  }))
}

export function getTenantSnapshot(database: DatabaseSync, communityId: string, userId: string, presence: ReadonlyMap<string, Presence | "offline"> = new Map()): TenantSnapshot {
  const community = getTenantCommunity(database, communityId, userId)
  const channels = listTenantChannels(database, communityId, userId)
  const channelIds = new Set(channels.map((channel) => channel.id))
  const members = listTenantMembers(database, communityId, userId).map((member) => userPerson({ id: member.id, display_name: member.displayName, initials: member.initials, tone: member.tone, status: member.status, created_at: member.createdAt, updated_at: member.updatedAt }, communityId, member.role, presence.get(member.id) ?? "offline"))
  const agents = listTenantAgents(database, communityId, userId, presence)
  const messages = listTenantMessages(database, communityId, userId).filter((message) => channelIds.has(message.channelId))
  const threads = listTenantThreads(database, communityId, userId).filter((thread) => channelIds.has(thread.channelId))
  const cards = (database.prepare("SELECT * FROM tenant_cards WHERE community_id = ? ORDER BY created_at").all(communityId) as Row[]).filter((row) => channelIds.has(str(row.channel_id) ?? "")).map(cardFromRow)
  return { ...community, members: [...members, ...agents], channels, agents, messages, threads, cards }
}

export function updateTenantCommunity(database: DatabaseSync, communityId: string, actorId: string, input: { name?: string; term?: string }): TenantCommunity {
  teacher(database, communityId, actorId)
  const current = communityRow(database, communityId)
  const name = input.name?.trim() || str(current.name) || ""
  const term = input.term?.trim() || str(current.term) || ""
  if (!name || !term) fail("invalid_input", "name and term cannot be empty")
  database.prepare("UPDATE tenant_communities SET name = ?, term = ?, updated_at = ? WHERE id = ?").run(name, term, now(), communityId)
  return communityFromRow(communityRow(database, communityId), "teacher")
}

export function findTenantMessage(database: DatabaseSync, communityId: string, messageId: string): TenantMessage | undefined {
  const row = database.prepare("SELECT * FROM tenant_messages WHERE community_id = ? AND id = ?").get(communityId, messageId) as Row | undefined
  return row ? messageFromRow(row) : undefined
}

export function tenantCommunityForAgent(database: DatabaseSync, agentId: string): string | undefined {
  return str((database.prepare("SELECT community_id FROM tenant_agents WHERE id = ? AND status = 'active'").get(agentId) as Row | undefined)?.community_id)
}

/** Import the old one-community database into the tenant tables. This is
    intentionally idempotent and only runs when the target row is absent; user
    edits and additional communities are never overwritten by a reseed. */
export function syncLegacyToTenant(database: DatabaseSync): void {
  const oldCommunity = database.prepare("SELECT * FROM community LIMIT 1").get() as Row | undefined
  if (!oldCommunity) return
  const communityId = str(oldCommunity.id) ?? "legacy-community"
  const timestamp = now()
  const legacyPeople = database.prepare("SELECT * FROM members WHERE kind = 'person'").all() as Row[]
  if (!database.prepare("SELECT 1 FROM tenant_communities WHERE id = ?").get(communityId)) {
    const teacherRow = legacyPeople.find((row) => str(row.role) === "teacher") ?? legacyPeople[0]
    const creatorId = str(teacherRow?.id) ?? `user-${randomUUID()}`
    transaction(database, () => {
      for (const person of legacyPeople) {
        const id = str(person.id) ?? `user-${randomUUID()}`
        const raw = str(person.token) ?? randomBytes(32).toString("base64url")
        database.prepare(`INSERT OR IGNORE INTO tenant_users (id, display_name, initials, tone, token_digest, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, str(person.name) ?? id, str(person.initials) ?? initials(str(person.name) ?? id), str(person.tone) ?? "card", digest(raw), timestamp, timestamp)
      }
      database.prepare("INSERT INTO tenant_communities (id, name, term, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(communityId, str(oldCommunity.name) ?? "Ada", str(oldCommunity.subtitle) ?? "Current term", creatorId, timestamp, timestamp)
      for (const person of legacyPeople) {
        database.prepare("INSERT OR IGNORE INTO tenant_memberships (community_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
          .run(communityId, str(person.id) ?? "", str(person.role) === "teacher" ? "teacher" : "student", timestamp, timestamp)
      }
      const oldChannels = database.prepare("SELECT * FROM channels").all() as Row[]
      for (const channel of oldChannels) {
        const id = str(channel.id) ?? `channel-${randomUUID()}`
        database.prepare(`INSERT OR IGNORE INTO tenant_channels (id, community_id, name, description, visibility, status, kind, created_by, created_at, updated_at, archived_at)
          VALUES (?, ?, ?, ?, ?, ?, 'channel', ?, ?, ?, ?)`)
          .run(id, communityId, str(channel.name) ?? id, str(channel.description) ?? null, str(channel.visibility) ?? "open", str(channel.status) ?? "active", str(channel.created_by) ?? creatorId, str(channel.created_at) ?? timestamp, str(channel.updated_at) ?? timestamp, str(channel.archived_at) ?? null)
        const memberships = database.prepare("SELECT member_id FROM channel_members WHERE channel_id = ?").all(id) as Row[]
        for (const member of memberships) database.prepare("INSERT OR IGNORE INTO tenant_channel_members (channel_id, community_id, member_id, member_kind, created_at) VALUES (?, ?, ?, ?, ?)").run(id, communityId, str(member.member_id) ?? "", legacyPeople.some((p) => p.id === member.member_id) ? "user" : "agent", timestamp)
      }
      const oldAgents = database.prepare("SELECT * FROM members WHERE kind = 'agent'").all() as Row[]
      for (const agent of oldAgents) {
        const id = str(agent.id) ?? `agent-${randomUUID()}`
        const raw = str(agent.token) ?? randomBytes(32).toString("base64url")
        database.prepare(`INSERT OR IGNORE INTO tenant_agents (id, community_id, name, instructions, runtime, model, created_by, status, runner_token_digest, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(id, communityId, str(agent.name) ?? id, str(agent.instructions) ?? "", str(agent.runtime) === "codex" ? "codex" : "claude", str(agent.model) ?? "", str(agent.created_by) ?? creatorId, str(agent.status) === "inactive" ? "deleted" : "active", digest(raw), timestamp, timestamp)
        const assigned = database.prepare("SELECT channel_id FROM channel_members WHERE member_id = ?").all(id) as Row[]
        for (const channel of assigned) database.prepare("INSERT OR IGNORE INTO tenant_channel_members (channel_id, community_id, member_id, member_kind, created_at) VALUES (?, ?, ?, 'agent', ?)").run(str(channel.channel_id) ?? "", communityId, id, timestamp)
      }
      const oldMessages = database.prepare("SELECT * FROM messages").all() as Row[]
      for (const message of oldMessages) database.prepare(`INSERT OR IGNORE INTO tenant_messages (id, community_id, channel_id, author_id, author_kind, body, thread_id, client_id, created_at, edited_at, deleted_at, deleted_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(str(message.id) ?? `message-${randomUUID()}`, communityId, str(message.channel_id) ?? "", str(message.author_id) ?? "", legacyPeople.some((p) => p.id === message.author_id) ? "user" : "agent", JSON.stringify({ paragraphs: JSON.parse(str(message.paragraphs) ?? "[]") }), str(message.thread_id) ?? null, str(message.client_id) ?? null, str(message.at) ?? timestamp, str(message.edited_at) ?? null, str(message.deleted_at) ?? null, str(message.deleted_by) ?? null)
      const oldThreads = database.prepare("SELECT * FROM threads").all() as Row[]
      for (const thread of oldThreads) {
        const root = database.prepare("SELECT channel_id FROM tenant_messages WHERE id = ?").get(str(thread.root_message_id) ?? "") as Row | undefined
        if (root) database.prepare("INSERT OR IGNORE INTO tenant_threads (id, community_id, channel_id, root_message_id, created_at) VALUES (?, ?, ?, ?, ?)").run(str(thread.id) ?? `thread-${randomUUID()}`, communityId, str(root.channel_id) ?? "", str(thread.root_message_id) ?? "", timestamp)
      }
      const oldCards = database.prepare("SELECT * FROM cards").all() as Row[]
      for (const card of oldCards) database.prepare(`INSERT OR IGNORE INTO tenant_cards (id, community_id, channel_id, author_id, path, title, type, body, version, replaces, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(str(card.id) ?? `card-${randomUUID()}`, communityId, str(card.channel_id) ?? "", str(card.author_id) ?? "", str(card.path) ?? str(card.id) ?? "", str(card.title) ?? "", str(card.type) ?? "note", str(card.body) ?? "", Number(card.version ?? 1), str(card.replaces) ?? null, str(card.published_at) ?? timestamp)
    })
  }
}

/** Called only after installation-host authentication, never with a user token. */
export function enrollRunnerHost(database: DatabaseSync, known: { agentId: string; runnerToken: string }[], defaults: { runtime: "claude" | "codex" | "pi"; model: string }): RunnerHostAgent[] {
  const credentials = new Map(known.map((entry) => [entry.agentId, entry.runnerToken]))
  return transaction(database, () => {
    const rows = database.prepare("SELECT id, community_id, runner_token_digest FROM tenant_agents WHERE status = 'active' ORDER BY id").all() as Row[]
    return rows.map((row) => {
      const agentId = str(row.id)!
      const existing = credentials.get(agentId)
      const runnerToken = existing && digest(existing) === row.runner_token_digest ? existing : token()
      database.prepare("UPDATE tenant_agents SET runner_token_digest = ?, runtime = ?, model = ? WHERE id = ?")
        .run(digest(runnerToken), defaults.runtime, defaults.model, agentId)
      return { agentId, communityId: str(row.community_id)!, runnerToken, ...defaults }
    })
  })
}

export function tenantWorkAgentsForMessage(database: DatabaseSync, message: TenantMessage, presence: ReadonlyMap<string, Presence | "offline"> = new Map()): TenantAgent[] {
  const channel = channelRow(database, message.communityId, message.channelId)
  if (channel.status !== "active") return []
  return listTenantChannelAgents(database, message.communityId, message.channelId, presence).filter((agent) => {
    if (channel.kind === "dm") return channel.dm_agent_id === agent.id && channel.created_by === message.authorId
    const mention = `@${agent.name}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return message.paragraphs.flat().some((block) => (block.kind === "mention" && block.memberId === agent.id) || block.kind === "text" && new RegExp(`(?:^|\\s)${mention}(?=$|\\s|[.,!?;:])`, "i").test(block.text))
  })
}
import { MemoryFiles } from "./memory-files.js"
