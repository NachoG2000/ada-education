import { mkdirSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { randomUUID } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import type {
  Agent,
  Card,
  CardType,
  Channel,
  CommunitySnapshot,
  Member,
  Message,
  MessageBlock,
  Person,
  Presence,
  Thread,
  Visibility,
} from "@ada/protocol"
import type { CardPublishInput as ProtocolCardPublishInput } from "@ada/protocol"

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
  database.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"))
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
      token = excluded.token
  `).run(agent.id, agent.name, agent.scope, agent.createdBy, agent.figureSeed ?? null,
    agent.figureColor ?? null, agent.instructions, provider.mode, provider.model,
    agent.runtime ?? null, agent.model ?? provider.model, agent.token)
  for (const channelId of agent.channelIds) addChannelMember(database, channelId, agent.id)
}

export interface SeedChannel {
  id: string
  name: string
  group: Channel["group"]
  description?: string
  memberIds?: string[]
  memberCount?: number
  work?: Channel["work"]
}

export function upsertChannel(database: DatabaseSync, channel: SeedChannel): void {
  database.prepare(`
    INSERT INTO channels (id, name, group_name, description, member_count, work_status, work_due)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, group_name = excluded.group_name,
      description = excluded.description, member_count = excluded.member_count,
      work_status = excluded.work_status, work_due = excluded.work_due
  `).run(channel.id, channel.name, channel.group, channel.description ?? null,
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
  }
}

export function publishCard(database: DatabaseSync, input: AuthoredCardPublishInput): PublishedCard {
  database.exec("BEGIN IMMEDIATE")
  try {
    assertChannelMember(database, input.channelId, input.authorId)
    const existingRow = database.prepare("SELECT * FROM cards WHERE author_id = ? AND path = ?")
      .get(input.authorId, input.path) as Row | undefined
    const previous = existingRow ? cardFromRow(existingRow) : undefined
    const version = previous ? previous.version + 1 : 1
    const cardId = previous?.id ?? randomUUID()
    const replacedCard = input.replaces
      ? database.prepare("SELECT * FROM cards WHERE author_id = ? AND path = ?")
        .get(input.authorId, input.replaces) as Row | undefined
      : undefined
    if (input.replaces && !replacedCard) throw new Error("Card to replace does not exist")
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
      state: input.base ? undefined : (previous ? "updated" : "new"),
      publishedAt: new Date().toISOString(),
      body: input.body,
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
export function upsertBaseCard(database: DatabaseSync, input: AuthoredCardPublishInput): Card {
  assertChannelMember(database, input.channelId, input.authorId)
  const existing = database.prepare("SELECT * FROM cards WHERE author_id = ? AND path = ?")
    .get(input.authorId, input.path) as Row | undefined
  const previous = existing ? cardFromRow(existing) : undefined
  const card: Card = {
    id: previous?.id ?? randomUUID(),
    channelId: input.channelId,
    title: input.title,
    type: input.type,
    authorId: input.authorId,
    version: previous?.version ?? 1,
    visibility: input.visibility,
    sources: input.sources,
    base: true,
    state: undefined,
    publishedAt: previous?.publishedAt ?? new Date().toISOString(),
    body: input.body,
  }
  database.prepare(`
    INSERT INTO cards (id, channel_id, title, type, author_id, path, version, visibility, sources,
      base, published_at, body)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(author_id, path) DO UPDATE SET channel_id = excluded.channel_id, title = excluded.title,
      type = excluded.type, version = excluded.version, visibility = excluded.visibility, sources = excluded.sources,
      base = 1, state = NULL, published_at = excluded.published_at, body = excluded.body
  `).run(card.id, card.channelId, card.title, card.type, card.authorId, input.path, card.version,
    card.visibility, JSON.stringify(card.sources), card.publishedAt, card.body)
  return card
}

export function assertChannelMember(database: DatabaseSync, channelId: string, memberId: string): void {
  if (!database.prepare("SELECT 1 FROM channels WHERE id = ?").get(channelId)) throw new Error("Channel does not exist")
  if (!database.prepare("SELECT 1 FROM members WHERE id = ?").get(memberId)) throw new Error("Member does not exist")
  if (!database.prepare("SELECT 1 FROM channel_members WHERE channel_id = ? AND member_id = ?").get(channelId, memberId)) {
    throw new Error("Member does not belong to the channel")
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
  }
}
