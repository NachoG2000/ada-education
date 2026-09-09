import { createHash, randomUUID } from "node:crypto"
import type { DatabaseSync } from "node:sqlite"
import { runnerMemoryResultSchema, type MemoryRecordView, type MemorySource, type MemoryWork } from "@ada/protocol"
import { CourseMemory } from "./memory.js"
import { assertMemoryAudience, memoryChannel, memoryRole, type MemoryAudience } from "./memory-policy.js"
import { createTenantAgentMessage, getTenantAgentById, tenantWorkAgentsForMessage, type TenantMessage } from "./tenant.js"
import { WorkspaceError } from "./workspace-errors.js"

export const MEMORY_JOBS_SQL = `
CREATE TABLE IF NOT EXISTS memory_jobs (
  id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES tenant_communities(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL, user_id TEXT NOT NULL, channel_id TEXT, thread_id TEXT,
  source_id TEXT NOT NULL, source_version INTEGER NOT NULL, purpose TEXT NOT NULL CHECK(purpose IN ('respond', 'consolidate')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'done', 'failed')),
  run_id TEXT UNIQUE, lease_until TEXT, attempts INTEGER NOT NULL DEFAULT 0,
  supplied TEXT, fingerprint TEXT, error TEXT, answer_message_id TEXT,
  created_at TEXT NOT NULL, completed_at TEXT,
  UNIQUE(agent_id, source_id, source_version, purpose)
);
CREATE INDEX IF NOT EXISTS memory_jobs_pending ON memory_jobs(agent_id, status, created_at);
`
type Job = {
  id: string; community_id: string; agent_id: string; user_id: string; channel_id: string | null; thread_id: string | null;
  source_id: string; source_version: number; purpose: "respond" | "consolidate"; status: string; run_id: string | null;
  attempts: number; supplied: string | null; fingerprint: string | null; answer_message_id: string | null;
}
type Supplied = { sources: Array<{ id: string; version: number }>; records: Array<{ id: string; revision: number; state: string }> }
const timestamp = () => new Date().toISOString()
const audienceFor = (job: Job, memory: CourseMemory): MemoryAudience => ({ communityId: job.community_id, userId: job.user_id, agentId: job.agent_id, ...(job.channel_id ? { channelId: job.channel_id } : { outputScope: memory.files.source(job.source_id, job.source_version)?.scope ?? { kind: "course" } }) })

function enqueue(db: DatabaseSync, source: MemorySource, agentId: string, purpose: Job["purpose"], channelId?: string, threadId?: string): void {
  db.prepare(`INSERT OR IGNORE INTO memory_jobs(id, community_id, agent_id, user_id, channel_id, thread_id, source_id, source_version, purpose, created_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(`job-${randomUUID()}`, source.communityId, agentId, source.authorId, channelId ?? null, threadId ?? null, source.id, source.version, purpose, timestamp())
}

export function queueMemorySource(db: DatabaseSync, source: MemorySource): void {
  const ada = db.prepare("SELECT id FROM tenant_agents WHERE community_id = ? AND system_role = 'ada' AND status = 'active'").get(source.communityId) as { id: string } | undefined
  if (ada) enqueue(db, source, ada.id, "consolidate")
}

export function queueMemoryMessage(db: DatabaseSync, message: TenantMessage, respond = true): void {
  const memory = new CourseMemory(db, message.communityId)
  const source = memory.captureMessage(message.id)
  if (!source) return
  const responders = respond ? tenantWorkAgentsForMessage(db, message) : []
  for (const agent of responders) enqueue(db, source, agent.id, "respond", message.channelId, message.threadId)
  // Consolidation is silent. Only an assigned Ada can read this channel.
  const ada = db.prepare(`SELECT a.id FROM tenant_agents a JOIN tenant_channel_members cm ON cm.member_id = a.id AND cm.member_kind = 'agent'
    WHERE a.community_id = ? AND a.system_role = 'ada' AND a.status = 'active' AND cm.channel_id = ?`).get(message.communityId, message.channelId) as { id: string } | undefined
  if (ada && !responders.some((agent) => agent.id === ada.id)) enqueue(db, source, ada.id, "consolidate", message.channelId, message.threadId)
}

function fingerprint(memory: CourseMemory, audience: MemoryAudience, supplied: Supplied): string {
  const snapshot = memory.snapshot(audience)
  const sources = supplied.sources.map((ref) => {
    const source = memory.sourceFor(audience, ref.id, ref.version)
    if (!memory.sourceValid(source)) throw new WorkspaceError("conflict", "A source changed while Ada was working")
    return [source.id, source.version, source.digest, source.scope]
  })
  const records = supplied.records.map((ref) => {
    const record = snapshot.records.find((item) => item.id === ref.id)
    if (!record || record.revision !== ref.revision || record.state !== ref.state) throw new WorkspaceError("conflict", "Memory changed while Ada was working")
    return [record.id, record.revision, record.state]
  })
  return createHash("sha256").update(JSON.stringify({ role: memoryRole(memory.db, audience), sources, records })).digest("hex")
}

/** Claim one job. Serialized polling and per-agent leases prevent duplicate invocations. */
export function claimMemoryWork(db: DatabaseSync, communityId: string, agentId: string): MemoryWork | undefined {
  const agent = getTenantAgentById(db, communityId, agentId)
  if (!agent || agent.status !== "active") return undefined
  db.prepare("UPDATE memory_jobs SET status = 'pending', run_id = NULL WHERE agent_id = ? AND status = 'running' AND lease_until < ?").run(agentId, timestamp())
  if (db.prepare("SELECT 1 FROM memory_jobs WHERE agent_id = ? AND status = 'running'").get(agentId)) return undefined
  const job = db.prepare("SELECT * FROM memory_jobs WHERE community_id = ? AND agent_id = ? AND status = 'pending' ORDER BY CASE purpose WHEN 'respond' THEN 0 ELSE 1 END, created_at, id LIMIT 1").get(communityId, agentId) as Job | undefined
  if (!job) return undefined
  try {
    const memory = new CourseMemory(db, communityId)
    const audience = audienceFor(job, memory)
    assertMemoryAudience(db, audience)
    const source = memory.sourceFor(audience, job.source_id, job.source_version)
    if (!memory.sourceValid(source)) throw new WorkspaceError("conflict", "The source has changed; this job is obsolete")
    const snapshot = memory.snapshot(audience)
    // Both current help and historical questions use dated records. Rejected or
    // invalidated content is never active model context, even if a teacher can review it.
    const eligible = snapshot.records.filter((record) => record.admission === "accepted" && record.evidenceValid)
    const request = memory.files.text(source)
    const terms = new Set(request.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])
    const score = (record: MemoryRecordView) => [...terms].reduce((n, term) => n + (`${record.title} ${record.concept ?? ""} ${record.module ?? ""} ${record.body}`.toLowerCase().includes(term) ? 1 : 0), 0)
    const selected = eligible.sort((a, b) => score(b) - score(a) || b.createdAt.localeCompare(a.createdAt)).slice(0, 35)
    // Include linked units for composition after authorization, within a bounded context.
    for (const record of [...selected]) for (const edge of record.relations) {
      const related = eligible.find((item) => item.id === edge.recordId)
      if (related && !selected.some((item) => item.id === related.id) && selected.length < 50) selected.push(related)
    }
    let characters = 0
    const records = selected.filter((record) => { characters += record.body.length; return characters <= 90000 })
    const sources = [source]
    if (job.channel_id) {
      // Capture a short authorized conversational context as attributed evidence;
      // agent replies never become independent evidence of student understanding.
      const recent = db.prepare(`SELECT id FROM tenant_messages WHERE community_id = ? AND channel_id = ? AND author_kind = 'user' AND deleted_at IS NULL
        AND (thread_id IS ? OR id = (SELECT root_message_id FROM tenant_threads WHERE id = ?)) ORDER BY created_at DESC LIMIT 8`).all(communityId, job.channel_id, job.thread_id, job.thread_id) as Array<{ id: string }>
      for (const item of recent.reverse()) {
        const contextSource = memory.captureMessage(item.id)
        if (contextSource && memory.canReadSource(audience, contextSource) && contextSource.id !== source.id) sources.push(contextSource)
      }
    }
    const user = db.prepare("SELECT display_name FROM tenant_users WHERE id = ?").get(job.user_id) as { display_name: string }
    const runId = `run-${randomUUID()}`
    const supplied: Supplied = { sources: sources.map((item) => ({ id: item.id, version: item.version })), records: records.map((item) => ({ id: item.id, revision: item.revision, state: item.state })) }
    const signature = fingerprint(memory, audience, supplied)
    db.prepare("UPDATE memory_jobs SET status = 'running', run_id = ?, attempts = attempts + 1, lease_until = ?, supplied = ?, fingerprint = ?, error = NULL WHERE id = ? AND status = 'pending'")
      .run(runId, new Date(Date.now() + 30 * 60 * 1000).toISOString(), JSON.stringify(supplied), signature, job.id)
    const scope = job.channel_id ? (() => { const channel = memoryChannel(db, communityId, job.channel_id!); return channel.kind === "dm" ? { kind: "learner" as const, learnerId: job.user_id } : { kind: "channel" as const, channelId: job.channel_id! } })() : source.scope
    return { type: "memory.work", payload: { communityId, agentId, instructions: agent.instructions, requester: { id: job.user_id, name: user.display_name, role: memoryRole(db, audience) }, request,
      view: { runId, purpose: job.purpose, scope, records, learners: [...new Set(records.flatMap((record) => record.scope.kind === "learner" ? [record.scope.learnerId] : []))].map((id) => ({ id, name: (db.prepare("SELECT display_name FROM tenant_users WHERE id = ?").get(id) as { display_name: string }).display_name })), sources: sources.map((item) => ({ ...item, text: memory.files.text(item) })) } } }
  } catch (error) {
    db.prepare("UPDATE memory_jobs SET status = 'failed', error = ? WHERE id = ?").run(error instanceof Error ? error.message.slice(0, 1200) : "Memory preparation failed", job.id)
    return undefined
  }
}

export function releaseMemoryWork(db: DatabaseSync, agentId: string): void {
  db.prepare("UPDATE memory_jobs SET status = 'pending', run_id = NULL, supplied = NULL WHERE agent_id = ? AND status = 'running'").run(agentId)
}

export function completeMemoryWork(db: DatabaseSync, communityId: string, agentId: string, raw: unknown): { message?: TenantMessage; messageId?: string } {
  const frame = runnerMemoryResultSchema.parse(raw)
  const result = frame.payload
  const job = db.prepare("SELECT * FROM memory_jobs WHERE community_id = ? AND agent_id = ? AND run_id = ?").get(communityId, agentId, result.runId) as Job | undefined
  if (!job) throw new WorkspaceError("forbidden", "This execution does not belong to the authenticated agent")
  if (job.status === "done") return { messageId: job.answer_message_id ?? undefined }
  if (job.status !== "running") throw new WorkspaceError("conflict", "This execution is no longer active")
  const memory = new CourseMemory(db, communityId)
  const audience = audienceFor(job, memory)
  const supplied = JSON.parse(job.supplied!) as Supplied
  try {
    if (result.error) throw new WorkspaceError("conflict", result.error)
    if (fingerprint(memory, audience, supplied) !== job.fingerprint) throw new WorkspaceError("conflict", "Execution permissions changed")
    if (job.purpose === "respond" && !result.answer?.trim()) throw new WorkspaceError("invalid_input", "Ada returned no answer")
    const allowed = new Set(supplied.sources.map((item) => `${item.id}:${item.version}`))
    for (const proposal of result.proposals) memory.propose(audience, proposal, allowed)
    db.exec("BEGIN IMMEDIATE")
    try {
      const message = job.purpose === "respond" && job.channel_id ? createTenantAgentMessage(db, communityId, agentId, job.channel_id, { threadId: job.thread_id ?? undefined, paragraphs: [[{ kind: "text", text: result.answer!.trim() }]] }) : undefined
      db.prepare("UPDATE memory_jobs SET status = 'done', completed_at = ?, answer_message_id = ? WHERE id = ?").run(timestamp(), message?.id ?? null, job.id)
      db.exec("COMMIT")
      return { message, messageId: message?.id }
    } catch (error) { if (db.isTransaction) db.exec("ROLLBACK"); throw error }
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 1200) : "Memory processing failed"
    db.prepare("UPDATE memory_jobs SET status = 'failed', error = ? WHERE id = ?").run(detail, job.id)
    throw error
  }
}
