import { randomUUID } from "node:crypto"
import type { DatabaseSync } from "node:sqlite"
import type {
  Channel,
  CreateChannelInput,
  Member,
  ReplaceChannelMembersInput,
  UpdateChannelInput,
} from "@ada/protocol"
import { getWorkspaceChannel } from "./workspace-access.js"
import { WorkspaceError } from "./workspace-errors.js"

type Row = Record<string, unknown>

const now = (): string => new Date().toISOString()
const stringValue = (value: unknown): string | undefined => typeof value === "string" ? value : undefined

function transaction<T>(database: DatabaseSync, action: () => T): T {
  database.exec("BEGIN IMMEDIATE")
  try {
    const result = action()
    database.exec("COMMIT")
    return result
  } catch (error) {
    database.exec("ROLLBACK")
    throw error
  }
}

function requireActor(database: DatabaseSync, actor: Member): Row {
  if (actor.kind !== "person") throw new WorkspaceError("forbidden", "Agents cannot manage channels")
  const row = database.prepare("SELECT * FROM members WHERE id = ?").get(actor.id) as Row | undefined
  if (!row) throw new WorkspaceError("unauthorized", "The acting member does not exist")
  if (stringValue(row.kind) !== "person") throw new WorkspaceError("forbidden", "Agents cannot manage channels")
  if ((stringValue(row.status) ?? "active") !== "active") throw new WorkspaceError("forbidden", "The acting member is inactive")
  return row
}

function isTeacher(actor: Row): boolean {
  return stringValue(actor.role) === "teacher"
}

function requireChannel(database: DatabaseSync, channelId: string): Channel {
  const channel = getWorkspaceChannel(database, channelId)
  if (!channel) throw new WorkspaceError("not_found", "Channel does not exist")
  return channel
}

function requireManager(database: DatabaseSync, channel: Channel, actor: Member): Row {
  const actorRow = requireActor(database, actor)
  const group = channel.group
  if (group === "course" || group === "work") {
    if (!isTeacher(actorRow)) throw new WorkspaceError("forbidden", "Only a teacher can manage this channel")
  } else if (!isTeacher(actorRow) && channel.createdBy !== actor.id) {
    throw new WorkspaceError("forbidden", "Only the channel creator or a teacher can manage this channel")
  }
  return actorRow
}

function normalizeName(name: string | undefined): string {
  const value = name?.trim().replace(/\s+/g, " ") ?? ""
  if (!value) throw new WorkspaceError("invalid_input", "Channel name is required", "name")
  if (value.length > 80) throw new WorkspaceError("invalid_input", "Channel name is too long", "name")
  return value
}

function assertUniqueActiveName(database: DatabaseSync, name: string, exceptId?: string): void {
  const row = database.prepare(`
    SELECT id FROM channels
    WHERE status = 'active' AND lower(name) = lower(?) AND (? IS NULL OR id <> ?)
    LIMIT 1
  `).get(name, exceptId ?? null, exceptId ?? null) as Row | undefined
  if (row) throw new WorkspaceError("conflict", "An active channel with this name already exists", "name")
}

function assertGroupVisibility(group: Channel["group"], visibility: Channel["visibility"]): void {
  if (group !== "course" && group !== "work" && group !== "private") {
    throw new WorkspaceError("invalid_input", "Invalid channel group", "group")
  }
  if (visibility !== "open" && visibility !== "private") {
    throw new WorkspaceError("invalid_input", "Invalid channel visibility", "visibility")
  }
  if (group === "private" && visibility !== "private") {
    throw new WorkspaceError("invalid_input", "Private channels must use private visibility", "visibility")
  }
}

function validateWork(group: Channel["group"], work: UpdateChannelInput["work"] | CreateChannelInput["work"]): void {
  if (!work) return
  if (group !== "work") throw new WorkspaceError("invalid_input", "Only Work channels can have work metadata", "work")
  if (work.status === undefined) return
  if (work.status === "active" || work.status === "submitted" || work.status === "archived") return
  throw new WorkspaceError("invalid_input", "Invalid work status", "work.status")
}

function validateMemberIds(database: DatabaseSync, memberIds: string[], agentIds: string[]): string[] {
  const all = [...memberIds, ...agentIds]
  if (new Set(all).size !== all.length) throw new WorkspaceError("conflict", "A channel member was listed more than once")
  for (const id of all) {
    const row = database.prepare("SELECT kind, status FROM members WHERE id = ?").get(id) as Row | undefined
    if (!row) throw new WorkspaceError("not_found", `Member does not exist: ${id}`)
    if ((stringValue(row.status) ?? "active") !== "active") throw new WorkspaceError("conflict", `Member is inactive: ${id}`)
    const expectedKind = memberIds.includes(id) ? "person" : "agent"
    if (stringValue(row.kind) !== expectedKind) {
      throw new WorkspaceError("invalid_input", `${id} is not a ${expectedKind}`, expectedKind === "person" ? "memberIds" : "agentIds")
    }
  }
  return all
}

function writeMemberships(database: DatabaseSync, channelId: string, memberIds: string[], agentIds: string[]): void {
  database.prepare("DELETE FROM channel_members WHERE channel_id = ?").run(channelId)
  const insert = database.prepare("INSERT INTO channel_members (channel_id, member_id) VALUES (?, ?)")
  for (const id of [...memberIds, ...agentIds]) insert.run(channelId, id)
  database.prepare("UPDATE channels SET member_count = (SELECT COUNT(*) FROM channel_members WHERE channel_id = ?) WHERE id = ?")
    .run(channelId, channelId)
}

function channelAfter(database: DatabaseSync, channelId: string): Channel {
  return requireChannel(database, channelId)
}

export function createChannel(database: DatabaseSync, input: CreateChannelInput, actor: Member): Channel {
  return transaction(database, () => {
    const actorRow = requireActor(database, actor)
    if (input.group !== "private" && !isTeacher(actorRow)) {
      throw new WorkspaceError("forbidden", "Only a teacher can create Course or Work channels")
    }
    const name = normalizeName(input.name)
    const visibility = input.visibility
    assertGroupVisibility(input.group, visibility)
    validateWork(input.group, input.work)
    assertUniqueActiveName(database, name)
    const memberIds = [...(input.memberIds ?? [])]
    const agentIds = [...(input.agentIds ?? [])]
    validateMemberIds(database, memberIds, agentIds)
    if (!memberIds.includes(actor.id)) memberIds.push(actor.id)
    const id = randomUUID()
    const timestamp = now()
    database.prepare(`
      INSERT INTO channels (
        id, name, group_name, description, member_count, work_status, work_due,
        visibility, status, created_by, created_at, updated_at, archived_at
      ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, 'active', ?, ?, ?, NULL)
    `).run(id, name, input.group, input.description?.trim() || null, input.work ? (input.work.status ?? "active") : null,
      input.work?.due ?? null, visibility, actor.id, timestamp, timestamp)
    writeMemberships(database, id, memberIds, agentIds)
    return channelAfter(database, id)
  })
}

export function updateChannel(database: DatabaseSync, channelId: string, input: UpdateChannelInput, actor: Member): Channel {
  return transaction(database, () => {
    const current = requireChannel(database, channelId)
    const actorRow = requireManager(database, current, actor)
    const group = input.group ?? current.group
    const visibility = input.visibility ?? current.visibility ?? (group === "private" ? "private" : "open")
    assertGroupVisibility(group, visibility)
    if (group !== "private" && !isTeacher(actorRow)) {
      throw new WorkspaceError("forbidden", "Only a teacher can manage Course or Work channels")
    }
    validateWork(group, input.work === undefined ? current.work : input.work)
    const name = input.name === undefined ? current.name : normalizeName(input.name)
    const status = input.status ?? current.status ?? "active"
    if (status !== "active" && status !== "archived") {
      throw new WorkspaceError("invalid_input", "Invalid channel status", "status")
    }
    if (status === "active") assertUniqueActiveName(database, name, channelId)
    const timestamp = now()
    const archivedAt = status === "archived" ? (current.archivedAt ?? timestamp) : null
    const work = input.work === undefined ? current.work : input.work
    const workStatus = work ? (work.status ?? current.work?.status ?? "active") : null
    database.prepare(`
      UPDATE channels SET name = ?, group_name = ?, description = ?, work_status = ?, work_due = ?,
        visibility = ?, status = ?, updated_at = ?, archived_at = ?
      WHERE id = ?
    `).run(name, group, input.description === undefined ? current.description ?? null : input.description?.trim() || null,
      workStatus, work?.due ?? null, visibility, status, timestamp, archivedAt, channelId)
    return channelAfter(database, channelId)
  })
}

export function archiveChannel(database: DatabaseSync, channelId: string, actor: Member): Channel {
  return updateChannel(database, channelId, { status: "archived" }, actor)
}

export function unarchiveChannel(database: DatabaseSync, channelId: string, actor: Member): Channel {
  return updateChannel(database, channelId, { status: "active" }, actor)
}

export function joinChannel(database: DatabaseSync, channelId: string, actor: Member): Channel {
  return transaction(database, () => {
    requireActor(database, actor)
    const channel = requireChannel(database, channelId)
    if (channel.status === "archived") throw new WorkspaceError("channel_archived", "Archived channels cannot accept members")
    if (!channelIsOpen(channel)) throw new WorkspaceError("not_channel_member", "Private channels require an invitation")
    database.prepare("INSERT OR IGNORE INTO channel_members (channel_id, member_id) VALUES (?, ?)").run(channelId, actor.id)
    database.prepare("UPDATE channels SET member_count = (SELECT COUNT(*) FROM channel_members WHERE channel_id = ?), updated_at = ? WHERE id = ?")
      .run(channelId, now(), channelId)
    return channelAfter(database, channelId)
  })
}

export function leaveChannel(database: DatabaseSync, channelId: string, actor: Member): Channel {
  return transaction(database, () => {
    requireActor(database, actor)
    const channel = requireChannel(database, channelId)
    if (channel.status === "archived") throw new WorkspaceError("channel_archived", "Archived channels cannot change membership")
    if (channel.createdBy === actor.id) throw new WorkspaceError("forbidden", "The channel creator cannot leave; transfer or delete it")
    const result = database.prepare("DELETE FROM channel_members WHERE channel_id = ? AND member_id = ?").run(channelId, actor.id)
    if (result.changes === 0) throw new WorkspaceError("not_channel_member", "You are not a member of this channel")
    database.prepare("UPDATE channels SET member_count = (SELECT COUNT(*) FROM channel_members WHERE channel_id = ?), updated_at = ? WHERE id = ?")
      .run(channelId, now(), channelId)
    return channelAfter(database, channelId)
  })
}

export function replaceChannelMembers(database: DatabaseSync, channelId: string, input: ReplaceChannelMembersInput, actor: Member): Channel {
  return transaction(database, () => {
    const channel = requireChannel(database, channelId)
    requireManager(database, channel, actor)
    if (channel.status === "archived") throw new WorkspaceError("channel_archived", "Archived channels cannot change membership")
    const memberIds = [...input.memberIds]
    const agentIds = [...input.agentIds]
    validateMemberIds(database, memberIds, agentIds)
    if (!memberIds.includes(actor.id) && channel.createdBy === actor.id) memberIds.push(actor.id)
    writeMemberships(database, channelId, memberIds, agentIds)
    database.prepare("UPDATE channels SET updated_at = ? WHERE id = ?").run(now(), channelId)
    return channelAfter(database, channelId)
  })
}

function referenceCount(database: DatabaseSync, channelId: string): number {
  const count = (sql: string): number => Number((database.prepare(sql).get(channelId) as Row).count ?? 0)
  return count("SELECT COUNT(*) AS count FROM messages WHERE channel_id = ?")
    + count("SELECT COUNT(*) AS count FROM threads t JOIN messages m ON m.id = t.root_message_id WHERE m.channel_id = ?")
    + count("SELECT COUNT(*) AS count FROM cards WHERE channel_id = ?")
    + count("SELECT COUNT(*) AS count FROM modules WHERE channel_id = ?")
    + count("SELECT COUNT(*) AS count FROM assignments WHERE channel_id = ?")
    + count("SELECT COUNT(*) AS count FROM attachments WHERE channel_id = ?")
}

export function deleteEmptyChannel(database: DatabaseSync, channelId: string, actor: Member): void {
  transaction(database, () => {
    const channel = requireChannel(database, channelId)
    requireManager(database, channel, actor)
    if (referenceCount(database, channelId) > 0) {
      throw new WorkspaceError("history_conflict", "Channel has history; archive it instead of deleting it")
    }
    database.prepare("DELETE FROM channels WHERE id = ?").run(channelId)
  })
}

function channelIsOpen(channel: Channel): boolean {
  return (channel.visibility ?? (channel.group === "private" ? "private" : "open")) === "open"
}

// Verbose aliases keep call sites self-documenting while preserving short names
// for route handlers and focused server checks.
export const createWorkspaceChannel = createChannel
export const updateWorkspaceChannel = updateChannel
export const archiveWorkspaceChannel = archiveChannel
export const unarchiveWorkspaceChannel = unarchiveChannel
export const joinWorkspaceChannel = joinChannel
export const leaveWorkspaceChannel = leaveChannel
export const replaceWorkspaceChannelMembers = replaceChannelMembers
export const deleteEmptyWorkspaceChannel = deleteEmptyChannel
