import { mkdirSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes, randomUUID } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import { LATEST_SCHEMA_VERSION, migrateDatabase } from "./migrations.js"
import type {
  Agent,
  Assignment,
  Card,
  CardType,
  Channel,
  CommunitySnapshot,
  Difficulty,
  DifficultyLevel,
  Feedback,
  Material,
  Member,
  Message,
  MessageBlock,
  Module,
  ModuleStatus,
  ModuleSuggestInput,
  Person,
  Presence,
  Report,
  ReportCreateInput,
  Thread,
  Visibility,
  WorkStatus,
} from "@ada/protocol"
import type { CardPublishInput as ProtocolCardPublishInput } from "@ada/protocol"
import { WorkspaceError } from "./workspace-errors.js"
import { syncLegacyToTenant } from "./tenant.js"

export type PresenceMap = ReadonlyMap<string, Presence>

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")

export interface MessageInput {
  channelId: string
  authorId: string
  paragraphs: MessageBlock[][]
  threadId?: string
  fromCard?: { cardId: string; ago: string }
  publishes?: string
}

export type AuthoredCardPublishInput = ProtocolCardPublishInput & { authorId: string }

export interface PublishedCard {
  card: Card
  message: Message
}

export type AgentRecord = Agent & { token: string; runtime?: string; model?: string }

type Row = Record<string, unknown>

const asString = (value: unknown): string | undefined => typeof value === "string" ? value : undefined
const asNumber = (value: unknown): number | undefined => typeof value === "number" ? value : undefined
const asBoolean = (value: unknown): boolean => value === 1 || value === true

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== "string") return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function openDatabase(filePath?: string): DatabaseSync {
  const configuredPath = filePath ?? process.env.ADA_DB ?? "apps/server/data/ada.db"
  const path = configuredPath === ":memory:" ? configuredPath : resolve(repoRoot, configuredPath)
  mkdirSync(dirname(path), { recursive: true })
  const database = new DatabaseSync(path, { timeout: 5_000 })
  const hasExistingSchema = Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'community'").get())
  // Legacy tables must be upgraded before the current schema can create
  // indexes that reference v2 columns. Replaying schema.sql afterwards is
  // safe because its DDL is CREATE IF NOT EXISTS.
  database.exec("PRAGMA foreign_keys = ON")
  if (hasExistingSchema) {
    migrateDatabase(database)
    database.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"))
  } else {
    database.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"))
    // schema.sql is the current fresh-database shape. Existing files take the
    // ordered migration path above; a fresh file starts at that same version.
    database.exec(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION}`)
  }
  // Import an existing singleton database into the hosted-demo projection.
  // The operation is idempotent and intentionally happens after migrations so
  // a normal empty startup still needs no community.json.
  syncLegacyToTenant(database)
  return database
}

export function seedCommunity(database: DatabaseSync, input: {
  id: string
  name: string
  subtitle: string
  initial: string
}): void {
  database.prepare(`
    INSERT INTO community (id, name, subtitle, initial) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, subtitle = excluded.subtitle, initial = excluded.initial
  `).run(input.id, input.name, input.subtitle, input.initial)
}

export interface SeedPerson {
  id: string
  name: string
  initials: string
  tone: Person["tone"]
  role?: Person["role"]
}

export interface SeedAgent {
  id: string
  name: string
  scope: Agent["scope"]
  createdBy: string
  instructions: string
  channelIds: string[]
  token: string
  figureSeed?: string
  figureColor?: Agent["figureColor"]
  provider?: Agent["provider"]
  runtime?: string
  model?: string
  /** Explicit deploy-time override; ordinary seed values never replace a live token. */
  tokenOverride?: boolean
}

export function upsertPerson(database: DatabaseSync, person: SeedPerson): void {
  database.prepare(`
    INSERT INTO members (id, kind, name, initials, tone, role)
    VALUES (?, 'person', ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET kind = 'person', name = excluded.name, initials = excluded.initials,
      tone = excluded.tone, role = excluded.role
  `).run(person.id, person.name, person.initials, person.tone, person.role ?? null)
}

export function upsertAgent(database: DatabaseSync, agent: SeedAgent): void {
  const provider = agent.provider ?? { mode: "subscription", model: "" }
  database.prepare(`
    INSERT INTO members (id, kind, name, scope, created_by, figure_seed, figure_color, instructions,
      provider_mode, provider_model, runtime, model, token)
    VALUES (?, 'agent', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET kind = 'agent', name = excluded.name, scope = excluded.scope,
      created_by = excluded.created_by, figure_seed = excluded.figure_seed, figure_color = excluded.figure_color,
      instructions = excluded.instructions, provider_mode = excluded.provider_mode,
      provider_model = excluded.provider_model, runtime = excluded.runtime, model = excluded.model,
      token = CASE WHEN ? = 1 THEN excluded.token ELSE members.token END
  `).run(agent.id, agent.name, agent.scope, agent.createdBy, agent.figureSeed ?? null,
    agent.figureColor ?? null, agent.instructions, provider.mode, provider.model,
    agent.runtime ?? null, agent.model ?? provider.model, agent.token, agent.tokenOverride ? 1 : 0)
  for (const channelId of agent.channelIds) addChannelMember(database, channelId, agent.id)
}

export interface SeedChannel {
  id: string
  name: string
  group: Channel["group"]
  visibility?: Channel["visibility"]
  description?: string
  memberIds?: string[]
  memberCount?: number
  work?: Channel["work"]
}

export function upsertChannel(database: DatabaseSync, channel: SeedChannel): void {
  database.prepare(`
    INSERT INTO channels (id, name, group_name, visibility, description, member_count, work_status, work_due)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, group_name = excluded.group_name,
      visibility = excluded.visibility, description = excluded.description, member_count = excluded.member_count,
      work_status = excluded.work_status, work_due = excluded.work_due
  `).run(channel.id, channel.name, channel.group, channel.visibility ?? (channel.group === "private" ? "private" : "open"), channel.description ?? null,
    channel.memberCount ?? null, channel.work?.status ?? null, channel.work?.due ?? null)
  for (const memberId of channel.memberIds ?? []) addChannelMember(database, channel.id, memberId)
}

export function addChannelMember(database: DatabaseSync, channelId: string, memberId: string): void {
  database.prepare("INSERT OR IGNORE INTO channel_members (channel_id, member_id) VALUES (?, ?)").run(channelId, memberId)
}

export function listMembers(database: DatabaseSync, presence: PresenceMap = new Map()): Member[] {
  const rows = database.prepare("SELECT * FROM members ORDER BY rowid").all() as Row[]
  return rows.map((row) => {
    const id = asString(row.id) ?? ""
    const currentPresence = presence.get(id) ?? (row.kind === "agent" ? "away" : "online")
    if (row.kind === "agent") {
      const channelIds = (database.prepare("SELECT channel_id FROM channel_members WHERE member_id = ? ORDER BY channel_id")
        .all(id) as Row[]).map((item) => asString(item.channel_id) ?? "")
      return {
        kind: "agent",
        id,
        name: asString(row.name) ?? id,
        scope: (asString(row.scope) ?? "community") as Agent["scope"],
        createdBy: asString(row.created_by) ?? "",
        figureSeed: asString(row.figure_seed),
        figureColor: asString(row.figure_color) as Agent["figureColor"],
        instructions: asString(row.instructions) ?? "",
        provider: {
          mode: (asString(row.provider_mode) ?? "subscription") as Agent["provider"]["mode"],
          model: asString(row.provider_model) ?? "",
        },
        channelIds,
        presence: currentPresence as Presence,
      } satisfies Agent
    }
    return {
      kind: "person",
      id,
      name: asString(row.name) ?? id,
      initials: asString(row.initials) ?? "",
      tone: (asString(row.tone) ?? "card") as Person["tone"],
      role: asString(row.role) as Person["role"],
      presence: currentPresence as Presence,
    } satisfies Person
  })
}

/** The community's public face: what the join screens may show before auth. */
export function getCommunityInfo(database: DatabaseSync): { name: string; subtitle: string } | undefined {
  const row = database.prepare("SELECT name, subtitle FROM community LIMIT 1").get() as Row | undefined
  if (!row) return undefined
  return { name: asString(row.name) ?? "", subtitle: asString(row.subtitle) ?? "" }
}

export function getMember(database: DatabaseSync, memberId: string, presence?: PresenceMap): Member | undefined {
  return listMembers(database, presence).find((member) => member.id === memberId)
}

export function findAgentByToken(database: DatabaseSync, token: string): AgentRecord | undefined {
  const row = database.prepare("SELECT id, token, runtime, model FROM members WHERE kind = 'agent' AND token = ?").get(token) as Row | undefined
  const id = row && asString(row.id)
  if (!id) return undefined
  const member = getMember(database, id)
  return member?.kind === "agent" ? {
    ...member,
    token: asString(row.token) ?? token,
    runtime: asString(row.runtime),
    model: asString(row.model) ?? member.provider.model,
  } : undefined
}

/* ---- Membership: person tokens and single-use invites (DECISIONS.md §20) ----
   A person's token lives in the same `members.token` column agents use, scoped
   by `kind` on lookup. Tokens are minted here (claim/join) and never touched
   by the seed's upserts, so a re-seed can't lock anyone out. */

export function generateToken(): string {
  return randomBytes(24).toString("base64url")
}

export function findPersonByToken(database: DatabaseSync, token: string): Person | undefined {
  const row = database.prepare("SELECT id FROM members WHERE kind = 'person' AND token = ?").get(token) as Row | undefined
  const id = row && asString(row.id)
  if (!id) return undefined
  const member = getMember(database, id)
  return member?.kind === "person" ? member : undefined
}

export function setMemberToken(database: DatabaseSync, memberId: string, token: string): void {
  database.prepare("UPDATE members SET token = ? WHERE id = ?").run(token, memberId)
}

/** The course's teacher: the person the owner token claims. */
export function findTeacher(database: DatabaseSync): Person | undefined {
  const row = database.prepare("SELECT id FROM members WHERE kind = 'person' AND role = 'teacher' ORDER BY id LIMIT 1").get() as Row | undefined
  const id = row && asString(row.id)
  if (!id) return undefined
  const member = getMember(database, id)
  return member?.kind === "person" ? member : undefined
}

/** Applies `ADA_AGENT_TOKEN` to the course's single agent when it's set and
    different, so rotating the deploy's variable and restarting really rotates
    the live token (the seed only runs on an empty volume). Returns whether it
    changed anything; a course with several agents is left alone. */
export function applyAgentTokenOverride(database: DatabaseSync, token: string | undefined): boolean {
  if (!token) return false
  const rows = database.prepare("SELECT id, token FROM members WHERE kind = 'agent'").all() as Row[]
  if (rows.length !== 1) return false
  const id = asString(rows[0].id)
  if (!id || asString(rows[0].token) === token) return false
  setMemberToken(database, id, token)
  return true
}

export interface Invite {
  token: string
  role: "student" | "teacher"
  createdBy: string
  createdAt: string
  usedBy?: string
  usedAt?: string
}

export function createInvite(database: DatabaseSync, createdBy: string): Invite {
  const invite: Invite = { token: generateToken(), role: "student", createdBy, createdAt: new Date().toISOString() }
  database.prepare("INSERT INTO invites (token, role, created_by, created_at) VALUES (?, ?, ?, ?)")
    .run(invite.token, invite.role, invite.createdBy, invite.createdAt)
  return invite
}

export function getInvite(database: DatabaseSync, token: string): Invite | undefined {
  const row = database.prepare("SELECT * FROM invites WHERE token = ?").get(token) as Row | undefined
  if (!row) return undefined
  return {
    token: asString(row.token) ?? token,
    role: (asString(row.role) as Invite["role"]) ?? "student",
    createdBy: asString(row.created_by) ?? "",
    createdAt: asString(row.created_at) ?? "",
    usedBy: asString(row.used_by),
    usedAt: asString(row.used_at),
  }
}

/** Consumes an invite: creates the person, joins them to the open channels
    (the ones every existing person is already in — private channels list
    their members explicitly), and returns the person plus their new token. */
export function joinWithInvite(database: DatabaseSync, inviteToken: string, name: string): { person: Person; personToken: string } {
  const trimmed = name.trim().replace(/\s+/g, " ")
  if (!trimmed) throw new Error("A name is required")
  database.exec("BEGIN IMMEDIATE")
  try {
    // Re-read while holding the write lock: two concurrent joins cannot both
    // consume the same single-use invite.
    const invite = getInvite(database, inviteToken)
    if (!invite) throw new Error("Invite does not exist")
    if (invite.usedAt) throw new Error("Invite already used")
    const baseId = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "member"
    let id = baseId
    for (let n = 2; getMember(database, id); n++) id = `${baseId}-${n}`
    const parts = trimmed.split(" ")
    const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? "")).toUpperCase()
    const tones: Person["tone"][] = ["card", "cardstock", "seal-soft", "red-soft"]
    const personCount = Number((database.prepare("SELECT COUNT(*) AS n FROM members WHERE kind = 'person'").get() as Row).n ?? 0)
    const tone = tones[personCount % tones.length]

    upsertPerson(database, { id, name: trimmed, initials, tone, role: invite.role })
    const personToken = generateToken()
    setMemberToken(database, id, personToken)

    /* New students join only course channels that already have a student. */
    const courseChannels = database.prepare("SELECT id FROM channels WHERE group_name = 'course'").all() as Row[]
    for (const channel of courseChannels) {
      const channelId = asString(channel.id)
      if (!channelId) continue
      const peopleIn = database.prepare(`
        SELECT members.role AS role FROM channel_members
        JOIN members ON members.id = channel_members.member_id
        WHERE channel_members.channel_id = ? AND members.kind = 'person' AND members.id != ?
      `).all(channelId, id) as Row[]
      const teachersOnly = peopleIn.length === 0 || peopleIn.every((row) => asString(row.role) === "teacher")
      if (!teachersOnly) addChannelMember(database, channelId, id)
    }

    const usedAt = new Date().toISOString()
    const result = database.prepare("UPDATE invites SET used_by = ?, used_at = ? WHERE token = ? AND used_at IS NULL")
      .run(id, usedAt, inviteToken) as { changes?: number }
    if (result.changes !== 1) throw new Error("Invite already used")
    const person = getMember(database, id)
    if (person?.kind !== "person") throw new Error("Could not create the person")
    database.exec("COMMIT")
    return { person, personToken }
  } catch (error) {
    database.exec("ROLLBACK")
    throw error
  }
}

export function listAgentIdsForChannel(database: DatabaseSync, channelId: string): string[] {
  return (database.prepare(`
    SELECT m.id FROM members m JOIN channel_members cm ON cm.member_id = m.id
    WHERE cm.channel_id = ? AND m.kind = 'agent' ORDER BY m.id
  `).all(channelId) as Row[]).map((row) => asString(row.id) ?? "")
}

export function listChannels(database: DatabaseSync): Channel[] {
  const rows = database.prepare("SELECT * FROM channels ORDER BY rowid").all() as Row[]
  return rows.map((row) => {
    const id = asString(row.id) ?? ""
    const memberIds = (database.prepare("SELECT member_id FROM channel_members WHERE channel_id = ? ORDER BY rowid")
      .all(id) as Row[]).map((item) => asString(item.member_id) ?? "")
    const workStatus = asString(row.work_status)
    return {
      id,
      name: asString(row.name) ?? id,
      group: (asString(row.group_name) ?? "course") as Channel["group"],
      description: asString(row.description),
      memberIds,
      memberCount: asNumber(row.member_count) ?? undefined,
      work: workStatus ? { status: workStatus as NonNullable<Channel["work"]>["status"], due: asString(row.work_due) } : undefined,
      unread: asBoolean(row.unread),
    }
  })
}

/** Small aliases so the WS hub can inject this storage without knowing SQL. */
export function members(database: DatabaseSync, presence: PresenceMap = new Map()): Member[] {
  return listMembers(database, presence)
}

export function channels(database: DatabaseSync): Channel[] {
  return listChannels(database)
}

export function channel(database: DatabaseSync, channelId: string): Channel | undefined {
  return listChannels(database).find((item) => item.id === channelId)
}

export function member(database: DatabaseSync, memberId: string, presence: PresenceMap = new Map()): Member | undefined {
  return getMember(database, memberId, presence)
}

export function listMessages(database: DatabaseSync): Message[] {
  return (database.prepare("SELECT * FROM messages ORDER BY at").all() as Row[]).map(messageFromRow)
}

export function messages(database: DatabaseSync): Message[] {
  return listMessages(database)
}

export function getMessage(database: DatabaseSync, messageId: string): Message | undefined {
  const row = database.prepare("SELECT * FROM messages WHERE id = ?").get(messageId) as Row | undefined
  return row ? messageFromRow(row) : undefined
}

export function getMessages(database: DatabaseSync, options: { channelId?: string; threadId?: string; before?: string; limit?: number } = {}): Message[] {
  const clauses: string[] = []
  const params: (string | number)[] = []
  if (options.channelId) { clauses.push("channel_id = ?"); params.push(options.channelId) }
  if (options.threadId) { clauses.push("thread_id = ?"); params.push(options.threadId) }
  if (options.before) { clauses.push("at <= ?"); params.push(options.before) }
  const limit = options.limit ?? 20
  const sql = `SELECT * FROM messages ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY at DESC LIMIT ?`
  params.push(limit)
  return (database.prepare(sql).all(...params) as Row[]).map(messageFromRow).reverse()
}

export function getContextMessages(database: DatabaseSync, channelId: string, threadId?: string, now = new Date().toISOString()): Message[] {
  return getMessages(database, { channelId: threadId ? undefined : channelId, threadId, before: now, limit: 20 })
}

export function createMessage(database: DatabaseSync, input: MessageInput): Message {
  assertChannelMember(database, input.channelId, input.authorId)
  if (input.threadId) {
    const thread = getThread(database, input.threadId)
    if (!thread) throw new Error("Thread does not exist")
    const root = getMessage(database, thread.rootMessageId)
    if (!root || root.channelId !== input.channelId) throw new Error("Thread does not belong to the channel")
  }
  const message: Message = {
    id: randomUUID(),
    channelId: input.channelId,
    authorId: input.authorId,
    at: new Date().toISOString(),
    paragraphs: input.paragraphs,
    threadId: input.threadId,
    fromCard: input.fromCard,
    publishes: input.publishes,
  }
  database.prepare(`
    INSERT INTO messages (id, channel_id, author_id, at, paragraphs, thread_id, from_card, publishes, reactions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(message.id, message.channelId, message.authorId, message.at, JSON.stringify(message.paragraphs),
    message.threadId ?? null, message.fromCard ? JSON.stringify(message.fromCard) : null,
    message.publishes ?? null, null)
  return message
}

export interface SeedMessageInput extends MessageInput {
  id: string
  at: string
}

/** Upsert-by-id message writer for the seed: unlike `createMessage`, it accepts a caller id and an explicit `at` so history can be backdated, and re-seeding never duplicates. */
export function upsertSeedMessage(database: DatabaseSync, input: SeedMessageInput): Message {
  assertChannelMember(database, input.channelId, input.authorId)
  if (input.threadId && !getThread(database, input.threadId)) {
    throw new Error(`Thread does not exist: ${input.threadId}`)
  }
  const message: Message = {
    id: input.id,
    channelId: input.channelId,
    authorId: input.authorId,
    at: input.at,
    paragraphs: input.paragraphs,
    threadId: input.threadId,
    fromCard: input.fromCard,
    publishes: input.publishes,
  }
  database.prepare(`
    INSERT INTO messages (id, channel_id, author_id, at, paragraphs, thread_id, from_card, publishes, reactions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET channel_id = excluded.channel_id, author_id = excluded.author_id,
      at = excluded.at, paragraphs = excluded.paragraphs, thread_id = excluded.thread_id,
      from_card = excluded.from_card, publishes = excluded.publishes
  `).run(message.id, message.channelId, message.authorId, message.at, JSON.stringify(message.paragraphs),
    message.threadId ?? null, message.fromCard ? JSON.stringify(message.fromCard) : null,
    message.publishes ?? null, null)
  return message
}

export function createThread(database: DatabaseSync, rootMessageId: string): Thread {
  const message = getMessage(database, rootMessageId)
  if (!message) throw new Error("Root message does not exist")
  const existing = database.prepare("SELECT id FROM threads WHERE root_message_id = ?").get(rootMessageId) as Row | undefined
  if (existing) return getThread(database, asString(existing.id) ?? "") as Thread
  const thread: Thread = { id: randomUUID(), rootMessageId, replyIds: [] }
  database.prepare("INSERT INTO threads (id, root_message_id) VALUES (?, ?)").run(thread.id, rootMessageId)
  return thread
}

export function getThread(database: DatabaseSync, threadId: string): Thread | undefined {
  const row = database.prepare("SELECT * FROM threads WHERE id = ?").get(threadId) as Row | undefined
  if (!row) return undefined
  const id = asString(row.id) ?? threadId
  const replies = (database.prepare("SELECT id FROM messages WHERE thread_id = ? ORDER BY at").all(id) as Row[])
    .map((reply) => asString(reply.id) ?? "")
  return {
    id,
    rootMessageId: asString(row.root_message_id) ?? "",
    replyIds: replies,
    publishedCardId: asString(row.published_card_id),
  }
}

export function listThreads(database: DatabaseSync): Thread[] {
  return (database.prepare("SELECT id FROM threads ORDER BY rowid").all() as Row[])
    .map((row) => getThread(database, asString(row.id) ?? ""))
    .filter((thread): thread is Thread => Boolean(thread))
}

export function listCards(database: DatabaseSync): Card[] {
  return (database.prepare("SELECT * FROM cards ORDER BY published_at").all() as Row[]).map(cardFromRow)
}

export function getCardByPath(database: DatabaseSync, authorId: string, path: string): Card | undefined {
  const row = database.prepare("SELECT * FROM cards WHERE author_id = ? AND path = ?").get(authorId, path) as Row | undefined
  return row ? cardFromRow(row) : undefined
}

export function getCardById(database: DatabaseSync, cardId: string): Card | undefined {
  const row = database.prepare("SELECT * FROM cards WHERE id = ?").get(cardId) as Row | undefined
  return row ? cardFromRow(row) : undefined
}

export function getCommunitySnapshot(database: DatabaseSync, presence: PresenceMap = new Map()): CommunitySnapshot {
  const communityRow = database.prepare("SELECT * FROM community LIMIT 1").get() as Row | undefined
  if (!communityRow) throw new Error("Community is not initialized; run the seed")
  return {
    id: asString(communityRow.id) ?? "",
    name: asString(communityRow.name) ?? "",
    subtitle: asString(communityRow.subtitle) ?? "",
    initial: asString(communityRow.initial) ?? "",
    members: listMembers(database, presence),
    channels: listChannels(database),
    cards: listCards(database),
    messages: listMessages(database),
    threads: listThreads(database),
    modules: listModules(database),
    assignments: listAssignments(database),
    feedback: listFeedback(database),
    reports: listReports(database),
  }
}

/* ---- Modules, materials, assignments, feedback and reports ---------------- */

export interface SeedMaterial {
  id: string
  name: string
  kind: Material["kind"]
  size?: number
  path: string
  uploadedAt: string
}

export interface SeedModule {
  id: string
  index: number
  slug: string
  title: string
  summary: string
  channelId: string
  objectives: string[]
  difficulty: Difficulty
  status: ModuleStatus
  materials?: SeedMaterial[]
  revision?: string
}

export function upsertModule(database: DatabaseSync, module: SeedModule): void {
  if (!database.prepare("SELECT 1 FROM channels WHERE id = ?").get(module.channelId)) {
    throw new Error(`Module "${module.id}" points at an unknown channel: ${module.channelId}`)
  }
  database.prepare(`
    INSERT INTO modules (id, idx, slug, title, summary, channel_id, objectives, difficulty, status, revision)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET idx = excluded.idx, slug = excluded.slug, title = excluded.title,
      summary = excluded.summary, channel_id = excluded.channel_id, objectives = excluded.objectives,
      difficulty = excluded.difficulty, status = excluded.status, revision = excluded.revision
  `).run(module.id, module.index, module.slug, module.title, module.summary, module.channelId,
    JSON.stringify(module.objectives), JSON.stringify(module.difficulty), module.status, module.revision ?? null)
  for (const material of module.materials ?? []) addMaterial(database, module.id, material)
}

export function addMaterial(database: DatabaseSync, moduleId: string, material: SeedMaterial): void {
  if (!database.prepare("SELECT 1 FROM modules WHERE id = ?").get(moduleId)) {
    throw new Error(`Material "${material.name}" points at an unknown module: ${moduleId}`)
  }
  database.prepare(`
    INSERT INTO materials (id, module_id, name, kind, size, path, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET module_id = excluded.module_id, name = excluded.name, kind = excluded.kind,
      size = excluded.size, path = excluded.path, uploaded_at = excluded.uploaded_at
  `).run(material.id, moduleId, material.name, material.kind, material.size ?? null, material.path, material.uploadedAt)
}

function listMaterials(database: DatabaseSync, moduleId: string): Material[] {
  return (database.prepare("SELECT * FROM materials WHERE module_id = ? ORDER BY uploaded_at").all(moduleId) as Row[])
    .map((row) => ({
      id: asString(row.id) ?? "",
      name: asString(row.name) ?? "",
      kind: (asString(row.kind) ?? "markdown") as Material["kind"],
      size: asNumber(row.size),
      path: asString(row.path) ?? "",
      uploadedAt: asString(row.uploaded_at) ?? "",
    }))
}

/** Cards published in the module's channel, base documents excluded, oldest first. */
function moduleCardIds(database: DatabaseSync, channelId: string): string[] {
  return (database.prepare(`
    SELECT id FROM cards WHERE channel_id = ? AND (base IS NULL OR base = 0) ORDER BY published_at ASC
  `).all(channelId) as Row[]).map((row) => asString(row.id) ?? "")
}

/** Everything a module row holds by itself (materials and cardIds join in). */
function moduleShell(row: Row): Omit<Module, "materials" | "cardIds"> {
  return {
    id: asString(row.id) ?? "",
    index: asNumber(row.idx) ?? 0,
    slug: asString(row.slug) ?? "",
    title: asString(row.title) ?? "",
    summary: asString(row.summary) ?? "",
    channelId: asString(row.channel_id) ?? "",
    objectives: parseJson<string[]>(row.objectives, []),
    difficulty: parseJson<Difficulty>(row.difficulty, { level: "intro" }),
    status: (asString(row.status) ?? "empty") as ModuleStatus,
    revision: asString(row.revision),
  }
}

function moduleFromRow(database: DatabaseSync, row: Row): Module {
  const shell = moduleShell(row)
  return {
    ...shell,
    materials: listMaterials(database, shell.id),
    cardIds: moduleCardIds(database, shell.channelId),
  }
}

export function listModules(database: DatabaseSync): Module[] {
  // The snapshot path: batch materials and card ids in one query each instead
  // of two queries per module (the row count grows with the course).
  const rows = database.prepare("SELECT * FROM modules ORDER BY idx").all() as Row[]
  if (rows.length === 0) return []
  const materialsByModule = new Map<string, Material[]>()
  for (const m of database.prepare("SELECT * FROM materials ORDER BY uploaded_at").all() as Row[]) {
    const moduleId = asString(m.module_id) ?? ""
    const list = materialsByModule.get(moduleId) ?? []
    list.push({
      id: asString(m.id) ?? "",
      name: asString(m.name) ?? "",
      kind: (asString(m.kind) ?? "markdown") as Material["kind"],
      size: asNumber(m.size),
      path: asString(m.path) ?? "",
      uploadedAt: asString(m.uploaded_at) ?? "",
    })
    materialsByModule.set(moduleId, list)
  }
  const cardsByChannel = new Map<string, string[]>()
  for (const c of database.prepare("SELECT id, channel_id FROM cards WHERE base IS NULL OR base = 0 ORDER BY published_at ASC").all() as Row[]) {
    const channelId = asString(c.channel_id) ?? ""
    const list = cardsByChannel.get(channelId) ?? []
    list.push(asString(c.id) ?? "")
    cardsByChannel.set(channelId, list)
  }
  return rows.map((row) => ({
    ...moduleShell(row),
    materials: materialsByModule.get(asString(row.id) ?? "") ?? [],
    cardIds: cardsByChannel.get(asString(row.channel_id) ?? "") ?? [],
  }))
}

export function getModule(database: DatabaseSync, moduleId: string): Module | undefined {
  const row = database.prepare("SELECT * FROM modules WHERE id = ?").get(moduleId) as Row | undefined
  return row ? moduleFromRow(database, row) : undefined
}

export interface ModulePatch {
  objectives?: string[]
  difficulty?: { level: DifficultyLevel; rationale?: string; setBy: string }
  status?: ModuleStatus
  revision?: string
}

export function updateModule(database: DatabaseSync, moduleId: string, patch: ModulePatch): Module {
  const module = getModule(database, moduleId)
  if (!module) throw new Error(`Module does not exist: ${moduleId}`)
  const nextDifficulty: Difficulty = patch.difficulty
    ? {
      ...module.difficulty,
      level: patch.difficulty.level,
      rationale: patch.difficulty.rationale ?? module.difficulty.rationale,
      setBy: patch.difficulty.setBy,
    }
    : module.difficulty
  database.prepare(`
    UPDATE modules SET objectives = ?, difficulty = ?, status = ?, revision = ? WHERE id = ?
  `).run(
    JSON.stringify(patch.objectives ?? module.objectives),
    JSON.stringify(nextDifficulty),
    patch.status ?? module.status,
    patch.revision ?? module.revision ?? null,
    moduleId,
  )
  return getModule(database, moduleId) as Module
}

export function setModuleStatus(database: DatabaseSync, moduleId: string, status: ModuleStatus): Module {
  return updateModule(database, moduleId, { status })
}

/** Applies a runner's `module.suggest`: the level only moves if no teacher has set it by hand; rationale/evidence/suggestedBy are always recorded. */
export function applyModuleSuggestion(database: DatabaseSync, agentId: string, input: ModuleSuggestInput): Module {
  const module = getModule(database, input.moduleId)
  if (!module) throw new Error(`Module does not exist: ${input.moduleId}`)
  const nextDifficulty: Difficulty = {
    ...module.difficulty,
    level: module.difficulty.setBy ? module.difficulty.level : input.difficulty.level,
    rationale: input.difficulty.rationale,
    evidence: input.difficulty.evidence,
    suggestedBy: agentId,
  }
  database.prepare(`
    UPDATE modules SET difficulty = ?, status = ? WHERE id = ?
  `).run(JSON.stringify(nextDifficulty), input.status ?? module.status, input.moduleId)
  return getModule(database, input.moduleId) as Module
}

export interface SeedAssignment {
  id: string
  moduleId: string
  channelId: string
  title: string
  due: string
  status: WorkStatus
}

export function upsertAssignment(database: DatabaseSync, assignment: SeedAssignment): void {
  if (!database.prepare("SELECT 1 FROM modules WHERE id = ?").get(assignment.moduleId)) {
    throw new Error(`Assignment "${assignment.id}" points at an unknown module: ${assignment.moduleId}`)
  }
  if (!database.prepare("SELECT 1 FROM channels WHERE id = ?").get(assignment.channelId)) {
    throw new Error(`Assignment "${assignment.id}" points at an unknown channel: ${assignment.channelId}`)
  }
  database.prepare(`
    INSERT INTO assignments (id, module_id, channel_id, title, due, status)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET module_id = excluded.module_id, channel_id = excluded.channel_id,
      title = excluded.title, due = excluded.due, status = excluded.status
  `).run(assignment.id, assignment.moduleId, assignment.channelId, assignment.title, assignment.due, assignment.status)
}

function assignmentFromRow(row: Row): Assignment {
  return {
    id: asString(row.id) ?? "",
    moduleId: asString(row.module_id) ?? "",
    channelId: asString(row.channel_id) ?? "",
    title: asString(row.title) ?? "",
    due: asString(row.due) ?? "",
    status: (asString(row.status) ?? "active") as WorkStatus,
  }
}

export function listAssignments(database: DatabaseSync): Assignment[] {
  return (database.prepare("SELECT * FROM assignments ORDER BY due").all() as Row[]).map(assignmentFromRow)
}

export function getAssignment(database: DatabaseSync, assignmentId: string): Assignment | undefined {
  const row = database.prepare("SELECT * FROM assignments WHERE id = ?").get(assignmentId) as Row | undefined
  return row ? assignmentFromRow(row) : undefined
}

export type SeedFeedback = Omit<Feedback, "id"> & { id: string }

export function upsertFeedback(database: DatabaseSync, feedback: SeedFeedback): void {
  if (!database.prepare("SELECT 1 FROM assignments WHERE id = ?").get(feedback.assignmentId)) {
    throw new Error(`Feedback "${feedback.id}" points at an unknown assignment: ${feedback.assignmentId}`)
  }
  if (!database.prepare("SELECT 1 FROM members WHERE id = ?").get(feedback.studentId)) {
    throw new Error(`Feedback "${feedback.id}" points at an unknown student: ${feedback.studentId}`)
  }
  if (!database.prepare("SELECT 1 FROM members WHERE id = ?").get(feedback.agentId)) {
    throw new Error(`Feedback "${feedback.id}" points at an unknown agent: ${feedback.agentId}`)
  }
  const body = {
    score: feedback.score,
    summary: feedback.summary,
    strengths: feedback.strengths,
    gaps: feedback.gaps,
    nextSteps: feedback.nextSteps,
  }
  database.prepare(`
    INSERT INTO feedback (id, assignment_id, student_id, agent_id, at, body)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET assignment_id = excluded.assignment_id, student_id = excluded.student_id,
      agent_id = excluded.agent_id, at = excluded.at, body = excluded.body
  `).run(feedback.id, feedback.assignmentId, feedback.studentId, feedback.agentId, feedback.at, JSON.stringify(body))
}

interface FeedbackBody {
  score: Feedback["score"]
  summary: string
  strengths: string[]
  gaps: Feedback["gaps"]
  nextSteps: Feedback["nextSteps"]
}

function feedbackFromRow(row: Row): Feedback {
  const body = parseJson<FeedbackBody>(row.body, { score: { got: 0, of: 0 }, summary: "", strengths: [], gaps: [], nextSteps: [] })
  return {
    id: asString(row.id) ?? "",
    assignmentId: asString(row.assignment_id) ?? "",
    studentId: asString(row.student_id) ?? "",
    agentId: asString(row.agent_id) ?? "",
    at: asString(row.at) ?? "",
    ...body,
  }
}

export function listFeedback(database: DatabaseSync): Feedback[] {
  return (database.prepare("SELECT * FROM feedback ORDER BY at").all() as Row[]).map(feedbackFromRow)
}

export function getFeedback(database: DatabaseSync, feedbackId: string): Feedback | undefined {
  const row = database.prepare("SELECT * FROM feedback WHERE id = ?").get(feedbackId) as Row | undefined
  return row ? feedbackFromRow(row) : undefined
}

export type SeedReport = Omit<Report, "id"> & { id: string }

export function upsertReport(database: DatabaseSync, report: SeedReport): void {
  if (!database.prepare("SELECT 1 FROM members WHERE id = ?").get(report.studentId)) {
    throw new Error(`Report "${report.id}" points at an unknown student: ${report.studentId}`)
  }
  if (!database.prepare("SELECT 1 FROM members WHERE id = ?").get(report.agentId)) {
    throw new Error(`Report "${report.id}" points at an unknown agent: ${report.agentId}`)
  }
  if (!database.prepare("SELECT 1 FROM modules WHERE id = ?").get(report.moduleId)) {
    throw new Error(`Report "${report.id}" points at an unknown module: ${report.moduleId}`)
  }
  if (report.assignmentId && !database.prepare("SELECT 1 FROM assignments WHERE id = ?").get(report.assignmentId)) {
    throw new Error(`Report "${report.id}" points at an unknown assignment: ${report.assignmentId}`)
  }
  const body = { told: report.told, recommendations: report.recommendations, cardIds: report.cardIds }
  database.prepare(`
    INSERT INTO reports (id, agent_id, student_id, module_id, assignment_id, at, body, status, reconciled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET agent_id = excluded.agent_id, student_id = excluded.student_id,
      module_id = excluded.module_id, assignment_id = excluded.assignment_id, at = excluded.at,
      body = excluded.body, status = excluded.status, reconciled = excluded.reconciled
  `).run(report.id, report.agentId, report.studentId, report.moduleId, report.assignmentId ?? null, report.at,
    JSON.stringify(body), report.status, report.reconciled ? JSON.stringify(report.reconciled) : null)
}

/** What a runner files after advising a student (`report.create`). */
export function createReport(database: DatabaseSync, agentId: string, input: ReportCreateInput): Report {
  if (!database.prepare("SELECT 1 FROM members WHERE id = ?").get(input.studentId)) {
    throw new Error(`Report points at an unknown student: ${input.studentId}`)
  }
  if (!database.prepare("SELECT 1 FROM modules WHERE id = ?").get(input.moduleId)) {
    throw new Error(`Report points at an unknown module: ${input.moduleId}`)
  }
  const report: Report = {
    id: randomUUID(),
    agentId,
    studentId: input.studentId,
    moduleId: input.moduleId,
    assignmentId: input.assignmentId,
    at: new Date().toISOString(),
    told: input.told,
    recommendations: input.recommendations,
    cardIds: input.cardIds,
    status: "new",
  }
  upsertReport(database, report)
  return report
}

interface ReportBody {
  told: string
  recommendations: Report["recommendations"]
  cardIds: string[]
}

function reportFromRow(row: Row): Report {
  const body = parseJson<ReportBody>(row.body, { told: "", recommendations: [], cardIds: [] })
  return {
    id: asString(row.id) ?? "",
    agentId: asString(row.agent_id) ?? "",
    studentId: asString(row.student_id) ?? "",
    moduleId: asString(row.module_id) ?? "",
    assignmentId: asString(row.assignment_id),
    at: asString(row.at) ?? "",
    ...body,
    status: (asString(row.status) ?? "new") as Report["status"],
    reconciled: parseJson<Report["reconciled"]>(row.reconciled, undefined),
  }
}

export function listReports(database: DatabaseSync): Report[] {
  return (database.prepare("SELECT * FROM reports ORDER BY at").all() as Row[]).map(reportFromRow)
}

export function getReport(database: DatabaseSync, reportId: string): Report | undefined {
  const row = database.prepare("SELECT * FROM reports WHERE id = ?").get(reportId) as Row | undefined
  return row ? reportFromRow(row) : undefined
}

export interface ReconcileInput {
  accepted: string[]
  note: string
  by: string
  cardId: string
}

export function reconcileReport(database: DatabaseSync, reportId: string, input: ReconcileInput): Report {
  const report = getReport(database, reportId)
  if (!report) throw new Error(`Report does not exist: ${reportId}`)
  const reconciled: NonNullable<Report["reconciled"]> = {
    at: new Date().toISOString(),
    by: input.by,
    accepted: input.accepted,
    note: input.note,
    cardId: input.cardId,
  }
  database.prepare("UPDATE reports SET status = 'reconciled', reconciled = ? WHERE id = ?")
    .run(JSON.stringify(reconciled), reportId)
  return { ...report, status: "reconciled", reconciled }
}

/** Reconciles a report and its decision card as one commit. Hooks are emitted
    by the API only after this function returns, so clients never observe the
    card/module/report halfway through the operation. */
export function reconcileReportWithCard(
  database: DatabaseSync,
  reportId: string,
  moduleId: string,
  cardInput: AuthoredCardPublishInput,
  revision: string,
  input: Omit<ReconcileInput, "cardId">,
): { published: PublishedCard; module: Module; report: Report } {
  database.exec("BEGIN IMMEDIATE")
  try {
    const card = upsertCard(database, cardInput)
    const message = createMessage(database, {
      channelId: cardInput.channelId,
      authorId: cardInput.authorId,
      paragraphs: [[{ kind: "text", text: `Published "${cardInput.title}".` }]],
      publishes: card.id,
    })
    const module = updateModule(database, moduleId, { revision })
    const report = reconcileReport(database, reportId, { ...input, cardId: card.id })
    database.exec("COMMIT")
    return { published: { card, message }, module, report }
  } catch (error) {
    database.exec("ROLLBACK")
    throw error
  }
}

export interface UpsertCardOptions {
  /** deterministic id (e.g. `card:<authorId>:<path>`) used only when no row exists yet for (authorId, path) */
  id?: string
  /** explicit publish date (seed cards keep a fixed date instead of "now") */
  publishedAt?: string
  /** whether re-upserting the same path bumps `version` (true for a genuine publish event; false for seed/base upserts) */
  bumpVersion?: boolean
}

/** Shared core for publishCard/upsertBaseCard/seed card upserts: computes version, supersede and state, writes the row. */
export function upsertCard(database: DatabaseSync, input: AuthoredCardPublishInput, options: UpsertCardOptions = {}): Card {
  const bumpVersion = options.bumpVersion ?? true
  assertChannelMember(database, input.channelId, input.authorId)
  const existingRow = database.prepare("SELECT * FROM cards WHERE author_id = ? AND path = ?")
    .get(input.authorId, input.path) as Row | undefined
  const previous = existingRow ? cardFromRow(existingRow) : undefined
  const version = previous ? (bumpVersion ? previous.version + 1 : previous.version) : 1
  const cardId = previous?.id ?? options.id ?? randomUUID()
  const replacedCard = input.replaces
    ? database.prepare("SELECT * FROM cards WHERE author_id = ? AND path = ?")
      .get(input.authorId, input.replaces) as Row | undefined
    : undefined
  if (input.replaces && !replacedCard) throw new Error(`Card to replace does not exist: ${input.replaces}`)
  const replacedId = replacedCard ? asString(replacedCard.id) : undefined
  if (replacedId) database.prepare("UPDATE cards SET state = 'superseded' WHERE id = ?").run(replacedId)
  const card: Card = {
    id: cardId,
    channelId: input.channelId,
    title: input.title,
    type: input.type,
    authorId: input.authorId,
    version,
    visibility: input.visibility,
    sources: input.sources,
    replaces: replacedId,
    base: input.base,
    // A seed re-run (no version bump) is not an update: the card keeps the state it had.
    state: input.base ? undefined : !bumpVersion ? (previous?.state ?? "new") : (previous ? "updated" : "new"),
    publishedAt: options.publishedAt ?? previous?.publishedAt ?? new Date().toISOString(),
    body: input.body,
    path: input.path,
  }
  database.prepare(`
    INSERT INTO cards (id, channel_id, title, type, author_id, path, version, visibility, sources, replaces,
      base, state, published_at, body)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(author_id, path) DO UPDATE SET channel_id = excluded.channel_id, title = excluded.title,
      type = excluded.type, version = excluded.version, visibility = excluded.visibility, sources = excluded.sources,
      replaces = excluded.replaces, base = excluded.base, state = excluded.state, published_at = excluded.published_at,
      body = excluded.body
  `).run(card.id, card.channelId, card.title, card.type, card.authorId, input.path, card.version,
    card.visibility, JSON.stringify(card.sources), card.replaces ?? null, card.base ? 1 : null,
    card.state ?? null, card.publishedAt, card.body)
  return card
}

export function publishCard(database: DatabaseSync, input: AuthoredCardPublishInput): PublishedCard {
  database.exec("BEGIN IMMEDIATE")
  try {
    const card = upsertCard(database, input)
    const message = createMessage(database, {
      channelId: input.channelId,
      authorId: input.authorId,
      paragraphs: [[{ kind: "text", text: `Published "${input.title}".` }]],
      publishes: card.id,
    })
    database.exec("COMMIT")
    return { card, message }
  } catch (error) {
    database.exec("ROLLBACK")
    throw error
  }
}

/** Inserts or updates a base card of the course. Base cards are not conversation messages. */
export function upsertBaseCard(database: DatabaseSync, input: AuthoredCardPublishInput, options: UpsertCardOptions = {}): Card {
  return upsertCard(database, { ...input, base: true }, { ...options, bumpVersion: false })
}

export function assertChannelMember(database: DatabaseSync, channelId: string, memberId: string): void {
  const channel = database.prepare("SELECT status FROM channels WHERE id = ?").get(channelId) as Row | undefined
  if (!channel) throw new WorkspaceError("not_found", "Channel does not exist")
  if (asString(channel.status) === "archived") throw new WorkspaceError("channel_archived", "Channel is archived")
  const member = database.prepare("SELECT status FROM members WHERE id = ?").get(memberId) as Row | undefined
  if (!member) throw new WorkspaceError("not_found", "Member does not exist")
  if (asString(member.status) === "inactive") throw new WorkspaceError("forbidden", "Member is inactive")
  if (!database.prepare("SELECT 1 FROM channel_members WHERE channel_id = ? AND member_id = ?").get(channelId, memberId)) {
    throw new WorkspaceError("not_channel_member", "Member does not belong to the channel")
  }
}

function messageFromRow(row: Row): Message {
  return {
    id: asString(row.id) ?? "",
    channelId: asString(row.channel_id) ?? "",
    authorId: asString(row.author_id) ?? "",
    at: asString(row.at) ?? "",
    paragraphs: parseJson<MessageBlock[][]>(row.paragraphs, []),
    threadId: asString(row.thread_id),
    fromCard: parseJson<Message["fromCard"]>(row.from_card, undefined),
    publishes: asString(row.publishes),
    reactions: parseJson<Message["reactions"]>(row.reactions, undefined),
  }
}

function cardFromRow(row: Row): Card {
  return {
    id: asString(row.id) ?? "",
    channelId: asString(row.channel_id) ?? "",
    title: asString(row.title) ?? "",
    type: (asString(row.type) ?? "note") as CardType,
    authorId: asString(row.author_id) ?? "",
    version: asNumber(row.version) ?? 1,
    visibility: (asString(row.visibility) ?? "channel") as Visibility,
    sources: parseJson<Card["sources"]>(row.sources, []),
    replaces: asString(row.replaces),
    base: row.base === 1 ? true : undefined,
    state: asString(row.state) as Card["state"],
    publishedAt: asString(row.published_at) ?? "",
    body: asString(row.body) ?? "",
    path: asString(row.path),
  }
}
