import type { DatabaseSync } from "node:sqlite"
import type {
  Agent,
  Attachment,
  Channel,
  CommunitySnapshot,
  Member,
  Person,
  Presence,
} from "@ada/protocol"
import {
  listAssignments,
  listCards,
  listModules,
  listThreads,
  listFeedback,
  listReports,
  type PresenceMap,
} from "./db.js"
import { listWorkspaceMessages } from "./workspace-messages.js"
import { WorkspaceError } from "./workspace-errors.js"

type Row = Record<string, unknown>

const asString = (value: unknown): string | undefined => typeof value === "string" ? value : undefined
const asNumber = (value: unknown): number | undefined => typeof value === "number" ? value : undefined
const asBoolean = (value: unknown): boolean => value === 1 || value === true

function channelMemberIds(database: DatabaseSync, channelId: string): string[] {
  return (database.prepare(`
    SELECT member_id FROM channel_members WHERE channel_id = ? ORDER BY rowid
  `).all(channelId) as Row[]).map((row) => asString(row.member_id) ?? "")
}

function channelFromRow(database: DatabaseSync, row: Row): Channel {
  const id = asString(row.id) ?? ""
  const group = (asString(row.group_name) ?? "course") as Channel["group"]
  const workStatus = asString(row.work_status)
  const memberIds = channelMemberIds(database, id)
  const computedCount = Number((database.prepare(
    "SELECT COUNT(*) AS count FROM channel_members WHERE channel_id = ?",
  ).get(id) as Row).count ?? 0)
  return {
    id,
    name: asString(row.name) ?? id,
    group,
    // Legacy seed upserts predate the v2 visibility column, whose schema
    // default is open. Private group semantics remain private until an
    // explicit migration/API write changes the row.
    visibility: (group === "private" ? "private" : (asString(row.visibility) ?? "open")) as Channel["visibility"],
    status: (asString(row.status) ?? "active") as Channel["status"],
    createdBy: asString(row.created_by),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    archivedAt: asString(row.archived_at),
    description: asString(row.description),
    memberIds,
    memberCount: asNumber(row.member_count) ?? computedCount,
    work: workStatus
      ? { status: workStatus as NonNullable<Channel["work"]>["status"], due: asString(row.work_due) }
      : undefined,
    unread: asBoolean(row.unread),
  }
}

/** Reads a channel with the v2 fields even while the old db.ts adapters remain
    compatible with the original snapshot shape. */
export function getWorkspaceChannel(database: DatabaseSync, channelId: string): Channel | undefined {
  const row = database.prepare("SELECT * FROM channels WHERE id = ?").get(channelId) as Row | undefined
  return row ? channelFromRow(database, row) : undefined
}

export function listWorkspaceChannels(database: DatabaseSync): Channel[] {
  return (database.prepare("SELECT * FROM channels ORDER BY rowid").all() as Row[]).map((row) => channelFromRow(database, row))
}

function memberIsActive(database: DatabaseSync, memberId: string): boolean {
  const row = database.prepare("SELECT status FROM members WHERE id = ?").get(memberId) as Row | undefined
  return Boolean(row && (asString(row.status) ?? "active") === "active")
}

function channelHasMember(database: DatabaseSync, channelId: string, memberId: string): boolean {
  return Boolean(database.prepare(`
    SELECT 1 FROM channel_members cm
    JOIN members m ON m.id = cm.member_id
    WHERE cm.channel_id = ? AND cm.member_id = ? AND COALESCE(m.status, 'active') = 'active'
  `).get(channelId, memberId))
}

function channelIsOpen(channel: Channel): boolean {
  return (channel.visibility ?? (channel.group === "private" ? "private" : "open")) === "open"
}

function channelIsReadable(database: DatabaseSync, channel: Channel, viewer: Member): boolean {
  if (channel.status !== "active" && channel.status !== "archived") return false
  if (!memberIsActive(database, viewer.id)) return false
  if (viewer.kind === "agent") return channelHasMember(database, channel.id, viewer.id)
  return channelIsOpen(channel) || channelHasMember(database, channel.id, viewer.id)
}

function viewerVisibleChannels(database: DatabaseSync, viewer?: Member): Channel[] {
  const channels = listWorkspaceChannels(database).filter((channel) => channel.status === "active" || channel.status === "archived")
  if (!viewer) return channels
  return channels.filter((channel) => channelIsReadable(database, channel, viewer))
}

function memberFromRow(database: DatabaseSync, row: Row, presence: PresenceMap, visibleChannelIds: Set<string>): Member {
  const id = asString(row.id) ?? ""
  const currentPresence = presence.get(id) ?? (row.kind === "agent" ? "away" : "online")
  if (row.kind === "agent") {
    const assigned = channelMemberIdsForMember(database, id).filter((channelId) => visibleChannelIds.has(channelId))
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
      channelIds: assigned,
      presence: currentPresence as Presence,
      description: asString(row.description),
      runtime: asString(row.runtime),
      model: asString(row.model) ?? asString(row.provider_model),
      status: (asString(row.status) ?? "active") as Agent["status"],
      createdAt: asString(row.created_at),
      updatedAt: asString(row.updated_at),
      inactiveAt: asString(row.inactive_at),
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
}

function channelMemberIdsForMember(database: DatabaseSync, memberId: string): string[] {
  return (database.prepare(`
    SELECT channel_id FROM channel_members WHERE member_id = ? ORDER BY channel_id
  `).all(memberId) as Row[]).map((row) => asString(row.channel_id) ?? "")
}

function visibleMembers(database: DatabaseSync, presence: PresenceMap, visibleChannelIds: Set<string>, viewer?: Member): Member[] {
  const rows = database.prepare("SELECT * FROM members ORDER BY rowid").all() as Row[]
  return rows.flatMap((row) => {
    if (row.kind === "agent") {
      const assigned = channelMemberIdsForMember(database, asString(row.id) ?? "")
      /* A private-only agent must not reveal its existence to an unrelated
         viewer. The viewer's own agent identity is retained for runner reads. */
      const isViewer = viewer?.kind === "agent" && viewer.id === asString(row.id)
      if (!isViewer && !assigned.some((channelId) => visibleChannelIds.has(channelId))) return []
    }
    return [memberFromRow(database, row, presence, visibleChannelIds)]
  })
}

function visibleAttachments(database: DatabaseSync, messageIds: Set<string>, visibleChannelIds: Set<string>): Map<string, Attachment[]> {
  const byMessage = new Map<string, Attachment[]>()
  if (messageIds.size === 0 || visibleChannelIds.size === 0) return byMessage
  const rows = database.prepare("SELECT * FROM attachments ORDER BY created_at").all() as Row[]
  for (const row of rows) {
    const channelId = asString(row.channel_id) ?? ""
    const messageId = asString(row.message_id)
    if (!messageId || !messageIds.has(messageId) || !visibleChannelIds.has(channelId)) continue
    const list = byMessage.get(messageId) ?? []
    list.push({
      id: asString(row.id) ?? "",
      channelId,
      uploaderId: asString(row.uploader_id) ?? "",
      name: asString(row.name) ?? "",
      mime: asString(row.mime) ?? "application/octet-stream",
      size: Number(row.size ?? 0),
      createdAt: asString(row.created_at) ?? "",
      messageId,
    })
    byMessage.set(messageId, list)
  }
  return byMessage
}

/** Builds the reconnect snapshot from one viewer predicate. Undefined keeps
    the legacy ungated full local snapshot; authenticated viewers get only
    readable channels and their channel-scoped children. */
export function getViewerCommunitySnapshot(
  database: DatabaseSync,
  presence: PresenceMap = new Map(),
  viewer?: Member,
): CommunitySnapshot {
  const communityRow = database.prepare("SELECT * FROM community LIMIT 1").get() as Row | undefined
  if (!communityRow) throw new WorkspaceError("not_found", "Community is not initialized; run the seed")

  const channels = viewerVisibleChannels(database, viewer)
  const visibleChannelIds = new Set(channels.map((channel) => channel.id))
  const members = visibleMembers(database, presence, visibleChannelIds, viewer)
  const allMessages = listWorkspaceMessages(database)
  const keptMessages = allMessages.filter((message) => visibleChannelIds.has(message.channelId))
  const attachments = visibleAttachments(database, new Set(keptMessages.map((message) => message.id)), visibleChannelIds)
  const messages = keptMessages.map((message) => {
    const messageAttachments = attachments.get(message.id)
    return messageAttachments?.length ? { ...message, attachments: messageAttachments } : message
  })
  const messageIds = new Set(messages.map((message) => message.id))
  const threads = listThreads(database)
    .filter((thread) => messageIds.has(thread.rootMessageId))
    .map((thread) => ({ ...thread, replyIds: thread.replyIds.filter((id) => messageIds.has(id)) }))
  const cards = listCards(database).filter((card) => visibleChannelIds.has(card.channelId))
  const modules = listModules(database).filter((module) => visibleChannelIds.has(module.channelId))
  const moduleIds = new Set(modules.map((module) => module.id))
  const assignments = listAssignments(database).filter((assignment) => visibleChannelIds.has(assignment.channelId) && moduleIds.has(assignment.moduleId))
  const assignmentIds = new Set(assignments.map((assignment) => assignment.id))
  const feedback = listFeedback(database).filter((item) => assignmentIds.has(item.assignmentId))
  const reports = listReports(database).filter((report) => moduleIds.has(report.moduleId) && (!report.assignmentId || assignmentIds.has(report.assignmentId)))

  return {
    id: asString(communityRow.id) ?? "",
    name: asString(communityRow.name) ?? "",
    subtitle: asString(communityRow.subtitle) ?? "",
    initial: asString(communityRow.initial) ?? "",
    members,
    channels,
    cards,
    messages,
    threads,
    modules,
    assignments,
    feedback,
    reports,
    updatedAt: asString(communityRow.updated_at),
  }
}

export function canReadChannel(database: DatabaseSync, channelId: string, viewer: Member): boolean {
  const channel = getWorkspaceChannel(database, channelId)
  return Boolean(channel && channelIsReadable(database, channel, viewer))
}

export function canManageChannel(database: DatabaseSync, channelId: string, viewer: Member): boolean {
  if (viewer.kind !== "person" || !memberIsActive(database, viewer.id)) return false
  const channel = getWorkspaceChannel(database, channelId)
  if (!channel) return false
  const row = database.prepare("SELECT role FROM members WHERE id = ?").get(viewer.id) as Row | undefined
  const teacher = asString(row?.role) === "teacher"
  return channel.group === "course" || channel.group === "work"
    ? teacher
    : teacher || channel.createdBy === viewer.id
}

export function canPostChannel(database: DatabaseSync, channelId: string, viewer: Member): boolean {
  const channel = getWorkspaceChannel(database, channelId)
  return Boolean(channel && channel.status === "active" && channelIsReadable(database, channel, viewer)
    && channelHasMember(database, channel.id, viewer.id))
}

/** Compatibility name for callers that make the viewer scope explicit. */
export const canReadWorkspaceChannel = canReadChannel
