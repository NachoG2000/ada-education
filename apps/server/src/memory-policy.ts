import type { DatabaseSync } from "node:sqlite"
import type { MemoryRecord, MemoryScope, MemorySource } from "@ada/protocol"
import { canReadTenantChannel } from "./tenant.js"
import { WorkspaceError } from "./workspace-errors.js"

export type MemoryActor = { communityId: string; userId: string }
export type MemoryAudience = MemoryActor & { agentId?: string; channelId?: string; outputScope?: MemoryScope }

export function memoryRole(db: DatabaseSync, actor: MemoryActor): "teacher" | "student" {
  const row = db.prepare(`SELECT m.role FROM tenant_memberships m JOIN tenant_users u ON u.id = m.user_id
    WHERE m.community_id = ? AND m.user_id = ? AND m.status = 'active' AND u.status = 'active'`).get(actor.communityId, actor.userId) as { role: "teacher" | "student" } | undefined
  if (!row) throw new WorkspaceError("forbidden", "An active course membership is required")
  return row.role
}

export function memoryChannel(db: DatabaseSync, communityId: string, channelId: string): { id: string; kind: string; created_by: string; dm_agent_id: string | null; status: string } {
  const row = db.prepare("SELECT id, kind, created_by, dm_agent_id, status FROM tenant_channels WHERE community_id = ? AND id = ?").get(communityId, channelId)
  if (!row) throw new WorkspaceError("not_found", "Channel not found")
  return row as ReturnType<typeof memoryChannel>
}

export function assertMemoryAudience(db: DatabaseSync, audience: MemoryAudience): void {
  memoryRole(db, audience)
  if (audience.agentId && !db.prepare("SELECT 1 FROM tenant_agents WHERE community_id = ? AND id = ? AND status = 'active'").get(audience.communityId, audience.agentId)) throw new WorkspaceError("forbidden", "Agent is unavailable")
  if (!audience.channelId) return
  const channel = memoryChannel(db, audience.communityId, audience.channelId)
  if (!canReadTenantChannel(db, audience.communityId, channel.id, audience.userId)) throw new WorkspaceError("not_found", "Channel not found")
  if (audience.agentId && !db.prepare("SELECT 1 FROM tenant_channel_members WHERE community_id = ? AND channel_id = ? AND member_id = ? AND member_kind = 'agent'").get(audience.communityId, channel.id, audience.agentId)) throw new WorkspaceError("forbidden", "Agent is not assigned to this conversation")
  if (audience.agentId && channel.status !== "active") throw new WorkspaceError("conflict", "Channel is archived")
  if (channel.kind === "dm" && audience.agentId && (channel.created_by !== audience.userId || channel.dm_agent_id !== audience.agentId)) throw new WorkspaceError("forbidden", "Private work must belong to the requester and agent")
}

export function canReadMemoryScope(db: DatabaseSync, audience: MemoryAudience, scope: MemoryScope): boolean {
  try {
    assertMemoryAudience(db, audience)
    const role = memoryRole(db, audience)
    const destination = audience.channelId ? memoryChannel(db, audience.communityId, audience.channelId) : undefined
    if (audience.outputScope && !scopeContains(scope, audience.outputScope)) return false
    if (scope.kind === "learner") {
      memoryRole(db, { ...audience, userId: scope.learnerId })
      // Shared channels never receive personal trajectories, including teacher requests.
      return (!destination || destination.kind === "dm") && (role === "teacher" || scope.learnerId === audience.userId)
    }
    if (scope.kind === "course") return true
    if (!canReadTenantChannel(db, audience.communityId, scope.channelId, audience.userId)) return false
    if (audience.agentId && !db.prepare("SELECT 1 FROM tenant_channel_members WHERE community_id = ? AND channel_id = ? AND member_id = ? AND member_kind = 'agent'").get(audience.communityId, scope.channelId, audience.agentId)) return false
    if (!destination) return true
    if (destination.kind === "dm") return true
    // An open channel is still a membership boundary; do not assume same audience.
    return destination.id === scope.channelId
  } catch { return false }
}

export function scopeContains(outer: MemoryScope, inner: MemoryScope): boolean {
  return outer.kind === "course" || (outer.kind === "channel" && inner.kind === "channel" && outer.channelId === inner.channelId) || (outer.kind === "learner" && inner.kind === "learner" && outer.learnerId === inner.learnerId)
}

export function canDeriveScope(db: DatabaseSync, communityId: string, source: MemorySource, target: MemoryScope): boolean {
  if (scopeContains(source.scope, target)) return true
  // Learner records from shared participation narrow access to self plus teachers.
  // Their source permissions continue to apply to every subsequent retrieval.
  return source.scope.kind === "channel" && target.kind === "learner" &&
    canReadTenantChannel(db, communityId, source.scope.channelId, target.learnerId)
}

export function assertProposalScope(db: DatabaseSync, audience: MemoryAudience, scope: MemoryScope): void {
  // A channel compiler can produce a PRIVATE trajectory for the sender, but it
  // cannot read trajectories to answer that channel. These are separate operations.
  if (scope.kind === "learner" && scope.learnerId === audience.userId) {
    if (memoryRole(db, audience) !== "student") throw new WorkspaceError("invalid_input", "Learner records require a student")
    return
  }
  if (!canReadMemoryScope(db, audience, scope)) throw new WorkspaceError("forbidden", "The proposal exceeds this execution's audience")
  if (scope.kind === "learner") {
    const memberRole = memoryRole(db, { communityId: audience.communityId, userId: scope.learnerId })
    if (memberRole !== "student") throw new WorkspaceError("invalid_input", "Learner records require a student")
  }
}

export function isPersonalRecord(record: Pick<MemoryRecord, "kind">): boolean {
  return ["question", "observation", "inference"].includes(record.kind)
}
