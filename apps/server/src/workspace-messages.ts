import { randomUUID } from "node:crypto"
import type { DatabaseSync } from "node:sqlite"
import type {
  ApiErrorCode,
  Attachment,
  EditMessageInput,
  Message,
  MessageBlock,
  MessageCreateRequest,
  MessageReaction,
  ReadMarkerInput,
  Thread,
} from "@ada/protocol"
import { WorkspaceError } from "./workspace-errors.js"

type Row = Record<string, unknown>

const asString = (value: unknown): string | undefined => typeof value === "string" ? value : undefined
const asNumber = (value: unknown): number | undefined => typeof value === "number" ? value : undefined
const now = (): string => new Date().toISOString()

function fail(code: ApiErrorCode, message: string, field?: string): never {
  throw new WorkspaceError(code, message, field)
}

function transaction<T>(database: DatabaseSync, fn: () => T): T {
  database.exec("BEGIN IMMEDIATE")
  try {
    const value = fn()
    database.exec("COMMIT")
    return value
  } catch (error) {
    database.exec("ROLLBACK")
    throw error
  }
}

function activeChannelMember(database: DatabaseSync, channelId: string, memberId: string): Row {
  const row = database.prepare(`
    SELECT c.id AS channel_id, c.status AS channel_status, m.id AS member_id,
           m.kind, m.role, m.status AS member_status
    FROM channels c
    JOIN channel_members cm ON cm.channel_id = c.id
    JOIN members m ON m.id = cm.member_id
    WHERE c.id = ? AND m.id = ?
  `).get(channelId, memberId) as Row | undefined
  if (!row) fail("not_channel_member", "You are not a member of this channel.")
  if (asString(row.member_status) === "inactive") fail("forbidden", "Inactive members cannot use this channel.")
  return row
}

function teacher(row: Row): boolean {
  return asString(row.kind) === "person" && asString(row.role) === "teacher"
}

function ensureMessage(database: DatabaseSync, messageId: string): Row {
  const message = database.prepare("SELECT * FROM messages WHERE id = ?").get(messageId) as Row | undefined
  if (!message) fail("not_found", "Message does not exist.")
  return message
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function attachmentsFor(database: DatabaseSync, messageId: string): Attachment[] {
  return (database.prepare(`
    SELECT id, channel_id, uploader_id, message_id, name, mime, size, created_at
    FROM attachments WHERE message_id = ? ORDER BY created_at, id
  `).all(messageId) as Row[]).map((row) => ({
    id: asString(row.id) ?? "",
    channelId: asString(row.channel_id) ?? "",
    uploaderId: asString(row.uploader_id) ?? "",
    name: asString(row.name) ?? "",
    mime: asString(row.mime) ?? "application/octet-stream",
    size: asNumber(row.size) ?? 0,
    createdAt: asString(row.created_at) ?? "",
    messageId: asString(row.message_id),
  }))
}

function reactionsFor(database: DatabaseSync, messageId: string): MessageReaction[] {
  const rows = database.prepare(`
    SELECT emoji, member_id FROM message_reactions
    WHERE message_id = ? ORDER BY emoji, member_id
  `).all(messageId) as Row[]
  const grouped = new Map<string, string[]>()
  for (const row of rows) {
    const emoji = asString(row.emoji) ?? ""
    const memberId = asString(row.member_id) ?? ""
    const ids = grouped.get(emoji) ?? []
    ids.push(memberId)
    grouped.set(emoji, ids)
  }
  return [...grouped.entries()].map(([emoji, memberIds]) => ({ emoji, count: memberIds.length, memberIds }))
}

function messageFromRow(database: DatabaseSync, row: Row): Message {
  const id = asString(row.id) ?? ""
  const reactions = reactionsFor(database, id)
  const oldReactions = parseJson<Array<{ emoji: string; count: number }>>(row.reactions, [])
  return {
    id,
    channelId: asString(row.channel_id) ?? "",
    authorId: asString(row.author_id) ?? "",
    at: asString(row.at) ?? "",
    paragraphs: parseJson<MessageBlock[][]>(row.deleted_at ? "[]" : row.paragraphs, []),
    threadId: asString(row.thread_id),
    fromCard: parseJson<Message["fromCard"]>(row.from_card, undefined),
    publishes: asString(row.publishes),
    clientId: asString(row.client_id),
    editedAt: asString(row.edited_at),
    deletedAt: asString(row.deleted_at),
    attachments: attachmentsFor(database, id),
    reactions: reactions.length > 0 ? reactions : oldReactions.map((reaction) => ({ ...reaction, memberIds: [] })),
  }
}

function ensureAttachmentReferences(database: DatabaseSync, channelId: string, actor: Row, attachmentIds: string[]): void {
  for (const attachmentId of [...new Set(attachmentIds)]) {
    const attachment = database.prepare(`
      SELECT id, channel_id, uploader_id, message_id
      FROM attachments WHERE id = ?
    `).get(attachmentId) as Row | undefined
    if (!attachment) fail("not_found", `Attachment does not exist: ${attachmentId}`, "attachmentIds")
    if (asString(attachment.channel_id) !== channelId) fail("forbidden", "An attachment belongs to another channel.", "attachmentIds")
    if (attachment.message_id !== null && attachment.message_id !== undefined) {
      fail("conflict", "An attachment can only be attached to one message.", "attachmentIds")
    }
    const uploaderId = asString(attachment.uploader_id) ?? ""
    if (uploaderId !== asString(actor.member_id) && !teacher(actor)) {
      fail("forbidden", "Only the uploader or a teacher can attach this file.", "attachmentIds")
    }
  }
}

function ensureThreadChannel(database: DatabaseSync, channelId: string, threadId: string | undefined): void {
  if (!threadId) return
  const row = database.prepare(`
    SELECT root.channel_id
    FROM threads t JOIN messages root ON root.id = t.root_message_id
    WHERE t.id = ?
  `).get(threadId) as Row | undefined
  if (!row) fail("not_found", "Thread does not exist.", "threadId")
  if (asString(row.channel_id) !== channelId) fail("forbidden", "Thread does not belong to this channel.", "threadId")
}

export interface ReadMarkerResult {
  channelId: string
  memberId: string
  lastReadAt: string
  unread: boolean
}

export function createWorkspaceMessage(
  database: DatabaseSync,
  actorId: string,
  channelId: string,
  input: MessageCreateRequest,
): Message {
  const actor = activeChannelMember(database, channelId, actorId)
  if (asString(actor.channel_status) === "archived") fail("channel_archived", "Archived channels reject new messages.")
  ensureThreadChannel(database, channelId, input.threadId)
  return transaction(database, () => {
    if (input.clientId) {
      const existing = database.prepare("SELECT * FROM messages WHERE author_id = ? AND client_id = ?")
        .get(actorId, input.clientId) as Row | undefined
      if (existing) {
        if (asString(existing.channel_id) !== channelId) fail("conflict", "This client ID was already used in another channel.", "clientId")
        return messageFromRow(database, existing)
      }
    }
    const attachmentIds = input.attachmentIds ?? []
    ensureAttachmentReferences(database, channelId, actor, attachmentIds)
    const id = randomUUID()
    const at = now()
    database.prepare(`
      INSERT INTO messages (id, channel_id, author_id, at, paragraphs, thread_id, client_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, channelId, actorId, at, JSON.stringify(input.paragraphs), input.threadId ?? null, input.clientId ?? null)
    for (const attachmentId of [...new Set(attachmentIds)]) {
      database.prepare("UPDATE attachments SET message_id = ? WHERE id = ? AND message_id IS NULL")
        .run(id, attachmentId)
    }
    return messageFromRow(database, database.prepare("SELECT * FROM messages WHERE id = ?").get(id) as Row)
  })
}

/** Hydrates the v2 message shape used by reconnect snapshots. Keep this
    adapter beside the transactional writer so normalized reactions,
    attachments, and tombstone metadata cannot silently disappear on reload. */
export function listWorkspaceMessages(database: DatabaseSync): Message[] {
  return (database.prepare("SELECT * FROM messages ORDER BY at").all() as Row[]).map((row) => messageFromRow(database, row))
}

export function createWorkspaceThread(database: DatabaseSync, actorId: string, rootMessageId: string): Thread {
  const root = ensureMessage(database, rootMessageId)
  const channelId = asString(root.channel_id) ?? ""
  const actor = activeChannelMember(database, channelId, actorId)
  if (asString(actor.channel_status) === "archived") fail("channel_archived", "Archived channels are read-only.")
  return transaction(database, () => {
    const existing = database.prepare("SELECT id FROM threads WHERE root_message_id = ?").get(rootMessageId) as Row | undefined
    if (existing) {
      const threadId = asString(existing.id) ?? ""
      const replies = (database.prepare("SELECT id FROM messages WHERE thread_id = ? ORDER BY at").all(threadId) as Row[])
        .map((row) => asString(row.id) ?? "")
      const publishedCardId = asString((database.prepare("SELECT published_card_id FROM threads WHERE id = ?").get(threadId) as Row | undefined)?.published_card_id)
      return { id: threadId, rootMessageId, replyIds: replies, ...(publishedCardId ? { publishedCardId } : {}) }
    }
    const thread = { id: randomUUID(), rootMessageId, replyIds: [] as string[] }
    database.prepare("INSERT INTO threads (id, root_message_id) VALUES (?, ?)").run(thread.id, rootMessageId)
    return thread
  })
}

export function editWorkspaceMessage(database: DatabaseSync, actorId: string, messageId: string, input: EditMessageInput): Message {
  const existing = ensureMessage(database, messageId)
  const actor = activeChannelMember(database, asString(existing.channel_id) ?? "", actorId)
  if (asString(actor.channel_status) === "archived") fail("channel_archived", "Archived channels are read-only.")
  if (asString(existing.deleted_at)) fail("conflict", "Deleted messages cannot be edited.")
  if (asString(existing.author_id) !== actorId && !teacher(actor)) fail("forbidden", "Only the author or a teacher can edit this message.")
  return transaction(database, () => {
    const editedAt = now()
    database.prepare("UPDATE messages SET paragraphs = ?, edited_at = ? WHERE id = ?")
      .run(JSON.stringify(input.paragraphs), editedAt, messageId)
    return messageFromRow(database, database.prepare("SELECT * FROM messages WHERE id = ?").get(messageId) as Row)
  })
}

export function tombstoneWorkspaceMessage(database: DatabaseSync, actorId: string, messageId: string): Message {
  const existing = ensureMessage(database, messageId)
  const actor = activeChannelMember(database, asString(existing.channel_id) ?? "", actorId)
  if (asString(actor.channel_status) === "archived") fail("channel_archived", "Archived channels are read-only.")
  if (asString(existing.author_id) !== actorId && !teacher(actor)) fail("forbidden", "Only the author or a teacher can delete this message.")
  return transaction(database, () => {
    const deletedAt = now()
    database.prepare("UPDATE messages SET paragraphs = '[]', deleted_at = ?, deleted_by = ? WHERE id = ?")
      .run(deletedAt, actorId, messageId)
    database.prepare("UPDATE attachments SET message_id = NULL WHERE message_id = ?").run(messageId)
    return messageFromRow(database, database.prepare("SELECT * FROM messages WHERE id = ?").get(messageId) as Row)
  })
}

function messageForReaction(database: DatabaseSync, actorId: string, messageId: string): { message: Row; actor: Row } {
  const message = ensureMessage(database, messageId)
  const actor = activeChannelMember(database, asString(message.channel_id) ?? "", actorId)
  if (asString(actor.channel_status) === "archived") fail("channel_archived", "Archived channels are read-only.")
  if (asString(message.deleted_at)) fail("conflict", "Deleted messages cannot receive reactions.")
  return { message, actor }
}

export function addMessageReaction(database: DatabaseSync, actorId: string, messageId: string, emoji: string): MessageReaction[] {
  messageForReaction(database, actorId, messageId)
  return transaction(database, () => {
    database.prepare(`INSERT OR IGNORE INTO message_reactions (message_id, member_id, emoji, created_at) VALUES (?, ?, ?, ?)`)
      .run(messageId, actorId, emoji, now())
    return reactionsFor(database, messageId)
  })
}

export function removeMessageReaction(database: DatabaseSync, actorId: string, messageId: string, emoji: string): MessageReaction[] {
  messageForReaction(database, actorId, messageId)
  return transaction(database, () => {
    database.prepare("DELETE FROM message_reactions WHERE message_id = ? AND member_id = ? AND emoji = ?")
      .run(messageId, actorId, emoji)
    return reactionsFor(database, messageId)
  })
}

export function markChannelRead(database: DatabaseSync, actorId: string, channelId: string, input: ReadMarkerInput): ReadMarkerResult {
  activeChannelMember(database, channelId, actorId)
  if (Number.isNaN(Date.parse(input.lastReadAt))) fail("invalid_input", "lastReadAt must be an ISO timestamp.", "lastReadAt")
  return transaction(database, () => {
    database.prepare(`
      INSERT INTO channel_reads (channel_id, member_id, last_read_at) VALUES (?, ?, ?)
      ON CONFLICT(channel_id, member_id) DO UPDATE SET last_read_at = excluded.last_read_at
    `).run(channelId, actorId, input.lastReadAt)
    const unread = Boolean(database.prepare(`
      SELECT 1 FROM messages
      WHERE channel_id = ? AND at > ? AND author_id <> ? AND deleted_at IS NULL
      LIMIT 1
    `).get(channelId, input.lastReadAt, actorId))
    return { channelId, memberId: actorId, lastReadAt: input.lastReadAt, unread }
  })
}
