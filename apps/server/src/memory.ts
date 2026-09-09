import { createHash, randomUUID } from "node:crypto"
import type { DatabaseSync } from "node:sqlite"
import { memoryProposalSchema, memoryReviewSchema, type MemoryProposal, type MemoryRecord, type MemoryRecordView, type MemoryScope, type MemorySnapshot, type MemorySource } from "@ada/protocol"
import { MemoryFiles } from "./memory-files.js"
import { assertMemoryAudience, assertProposalScope, canDeriveScope, canReadMemoryScope, isPersonalRecord, memoryChannel, memoryRole, scopeContains, type MemoryActor, type MemoryAudience } from "./memory-policy.js"
import { WorkspaceError } from "./workspace-errors.js"

const now = (): string => new Date().toISOString()
const hash = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex")
type MessageRow = { id: string; channel_id: string; author_id: string; author_kind: string; body: string; created_at: string; deleted_at: string | null }

export function messageMemoryText(body: string): string {
  const value = JSON.parse(body) as { text?: string; paragraphs?: Array<Array<{ text?: string }>> }
  return value.text ?? value.paragraphs?.map((paragraph) => paragraph.map((block) => block.text ?? "").join("")).join("\n\n") ?? ""
}

export class CourseMemory {
  readonly files: MemoryFiles
  readonly db: DatabaseSync
  readonly communityId: string
  constructor(db: DatabaseSync, communityId: string) { this.db = db; this.communityId = communityId; this.files = new MemoryFiles(db, communityId) }
  actor(userId: string): MemoryActor { return { communityId: this.communityId, userId } }
  initialize(): void { this.files.initialize() }

  ingest(userId: string, input: { title: string; filename: string; mediaType: string; scope: MemoryScope; raw: Uint8Array; text: string; sourceId?: string; expectedVersion?: number; origin?: "material" | "legacy" }): MemorySource {
    const actor = this.actor(userId)
    if (memoryRole(this.db, actor) !== "teacher") throw new WorkspaceError("forbidden", "Only course teachers can manage study sources")
    assertProposalScope(this.db, actor, input.scope)
    if (input.raw.byteLength > 10 * 1024 * 1024 || input.text.length > 120000 || !input.text.trim()) throw new WorkspaceError("invalid_input", "Use a source with readable text, up to 10 MB and 120,000 extracted characters")
    return this.files.commit((catalog) => {
      const previous = input.sourceId ? this.files.source(input.sourceId) : undefined
      if (input.sourceId && (!previous || previous.version !== input.expectedVersion)) throw new WorkspaceError("conflict", "The source changed; reload before uploading a revision")
      if (previous && JSON.stringify(previous.scope) !== JSON.stringify(input.scope)) throw new WorkspaceError("invalid_input", "A source revision must keep its audience; revoke it before creating a separately reviewed source")
      const source: MemorySource = {
        id: previous?.id ?? `source-${randomUUID()}`, communityId: this.communityId, version: (previous?.version ?? 0) + 1,
        title: input.title, filename: input.filename, mediaType: input.mediaType, digest: hash(input.raw), bytes: input.raw.byteLength,
        scope: input.scope, origin: input.origin ?? "material", authorId: userId, authorRole: "teacher",
        authority: input.origin === "legacy" ? "unreviewed" : "course_material", createdAt: now(), revoked: false,
      }
      this.files.writeSource(catalog, source, input.raw, input.text)
      return source
    })
  }

  captureMessage(messageId: string): MemorySource | undefined {
    const row = this.db.prepare("SELECT * FROM tenant_messages WHERE community_id = ? AND id = ?").get(this.communityId, messageId) as MessageRow | undefined
    if (!row || row.author_kind !== "user" || row.deleted_at) return undefined
    const actor = this.actor(row.author_id)
    const role = memoryRole(this.db, actor)
    const channel = memoryChannel(this.db, this.communityId, row.channel_id)
    const id = `source-${messageId}`
    const previous = this.files.source(id)
    if (previous?.digest === hash(row.body) && !previous.revoked) return previous
    return this.files.commit((catalog) => {
      const source: MemorySource = {
        id, communityId: this.communityId, version: (previous?.version ?? 0) + 1,
        title: `Message · ${row.created_at}`, filename: `${messageId}.json`, mediaType: "application/json",
        digest: hash(row.body), bytes: Buffer.byteLength(row.body), origin: "message", messageId, channelId: row.channel_id,
        scope: channel.kind === "dm" ? { kind: "learner", learnerId: channel.created_by } : { kind: "channel", channelId: row.channel_id },
        authorId: row.author_id, authorRole: role, authority: role === "teacher" ? "teacher_statement" : "self_report", createdAt: row.created_at, revoked: false,
      }
      this.files.writeSource(catalog, source, Buffer.from(row.body), messageMemoryText(row.body))
      return source
    })
  }

  sourceValid(source: MemorySource): boolean {
    const latest = this.files.source(source.id)
    if (!latest || latest.revoked || latest.version !== source.version) return false
    if (source.messageId) {
      const row = this.db.prepare("SELECT body, deleted_at FROM tenant_messages WHERE community_id = ? AND id = ?").get(this.communityId, source.messageId) as Pick<MessageRow, "body" | "deleted_at"> | undefined
      return Boolean(row && !row.deleted_at && hash(row.body) === source.digest)
    }
    return true
  }

  canReadSource(audience: MemoryAudience, source: MemorySource): boolean {
    const latest = this.files.source(source.id)
    if (!latest || latest.revoked || !canReadMemoryScope(this.db, audience, latest.scope) || !canReadMemoryScope(this.db, audience, source.scope)) return false
    if (source.messageId) {
      const row = this.db.prepare("SELECT deleted_at FROM tenant_messages WHERE community_id = ? AND id = ?").get(this.communityId, source.messageId) as { deleted_at: string | null } | undefined
      if (!row || row.deleted_at) return false
    }
    return true
  }

  sourceFor(audience: MemoryAudience, id: string, version?: number): MemorySource {
    if (audience.communityId !== this.communityId) throw new WorkspaceError("not_found", "Source not found")
    const source = this.files.source(id, version)
    if (!source || !this.canReadSource(audience, source)) throw new WorkspaceError("not_found", "Source not found")
    return source
  }

  canReadRecord(audience: MemoryAudience, record: MemoryRecord): boolean {
    if (!canReadMemoryScope(this.db, audience, record.scope)) return false
    return record.evidence.every((evidence) => {
      const source = this.files.source(evidence.sourceId, evidence.version)
      return Boolean(source && this.canReadSource(audience, source))
    })
  }

  evidenceValid(record: MemoryRecord): boolean {
    return record.evidence.every((evidence) => {
      const source = this.files.source(evidence.sourceId, evidence.version)
      return source && this.sourceValid(source) && this.files.text(source).includes(evidence.quote)
    })
  }

  snapshot(audience: MemoryAudience): MemorySnapshot {
    if (audience.communityId !== this.communityId) throw new WorkspaceError("not_found", "Memory not found")
    assertMemoryAudience(this.db, audience)
    const visible = this.files.records().filter((record) => this.canReadRecord(audience, record))
    const valid = new Map(visible.map((record) => [record.id, this.evidenceValid(record)]))
    const active = (record: MemoryRecord, visiting = new Set<string>()): boolean => {
      if (visiting.has(record.id) || record.admission !== "accepted" || !valid.get(record.id) || record.effectiveAt && Date.parse(record.effectiveAt) > Date.now()) return false
      const next = new Set(visiting).add(record.id)
      // A corrected inference must stop resolving an older question. Expired
      // events still establish historical supersession; expiry alone is not retraction.
      return !visible.some((other) => other.id !== record.id && other.relations.some((edge) => edge.recordId === record.id && ["corrects", "supersedes"].includes(edge.kind)) && active(other, next))
    }
    const records: MemoryRecordView[] = visible.map((record) => {
      let state: MemoryRecordView["state"] = record.admission === "rejected" ? "rejected" : record.admission === "review" || !valid.get(record.id) ? "needs_review" : "current"
      if (state === "current") {
        const replacements = visible.filter((other) => other.id !== record.id && active(other))
        const relation = replacements.flatMap((other) => other.relations).find((edge) => edge.recordId === record.id && ["corrects", "supersedes", "resolves"].includes(edge.kind))
        if (relation) state = relation.kind === "corrects" ? "corrected" : relation.kind === "resolves" ? "resolved" : "superseded"
        else if (record.staleAfter && Date.parse(record.staleAfter) <= Date.now()) state = "expired"
        else if (record.effectiveAt && Date.parse(record.effectiveAt) > Date.now()) state = "scheduled"
      }
      // No hidden relation IDs or link labels are synthesized by this projection.
      return { ...record, relations: record.relations.filter((edge) => visible.some((other) => other.id === edge.recordId)), state, evidenceValid: valid.get(record.id) ?? false }
    }).sort((a, b) => (a.occurredAt ?? a.createdAt).localeCompare(b.occurredAt ?? b.createdAt))
    return { version: this.files.catalog().version, sources: this.files.sources().filter((source) => this.canReadSource(audience, source)), records }
  }

  propose(audience: MemoryAudience, raw: unknown, allowedSources?: ReadonlySet<string>): MemoryRecord {
    if (audience.communityId !== this.communityId) throw new WorkspaceError("not_found", "Memory not found")
    assertMemoryAudience(this.db, audience)
    const input = memoryProposalSchema.parse(raw)
    assertProposalScope(this.db, audience, input.scope)
    if (isPersonalRecord(input) && input.scope.kind !== "learner") throw new WorkspaceError("invalid_input", "Questions, observations and inferences belong to a learner trajectory")
    const scopeActor = input.scope.kind === "learner" && input.scope.learnerId === audience.userId ? { ...audience, channelId: undefined } : audience
    const sources = input.evidence.map((evidence) => {
      if (allowedSources && !allowedSources.has(`${evidence.sourceId}:${evidence.version}`)) throw new WorkspaceError("forbidden", "Evidence was not supplied to this execution")
      const source = this.sourceFor(scopeActor, evidence.sourceId, evidence.version)
      if (!this.sourceValid(source)) throw new WorkspaceError("conflict", "Evidence changed; reprocess the current source")
      if (!this.files.text(source).includes(evidence.quote)) throw new WorkspaceError("invalid_input", "The evidence quote must occur in the source")
      if (!canDeriveScope(this.db, this.communityId, source, input.scope)) throw new WorkspaceError("forbidden", "Derived memory cannot widen its source audience")
      if (input.scope.kind === "learner" && source.authorRole === "student" && source.authorId !== input.scope.learnerId) throw new WorkspaceError("invalid_input", "A learner trajectory needs that learner's evidence or a teacher observation")
      return source
    })
    if (isPersonalRecord(input) && !sources.some((source) => source.origin === "message" && (source.authorRole === "teacher" || input.scope.kind === "learner" && source.authorId === input.scope.learnerId))) throw new WorkspaceError("invalid_input", "A learner interpretation requires participation evidence, not study material alone")
    return this.files.commit((catalog) => {
      for (const edge of input.relations) {
        const target = this.files.record(edge.recordId)
        if (!target || !this.canReadRecord(scopeActor, target)) throw new WorkspaceError("not_found", "Related record not found")
        if (!scopeContains(target.scope, input.scope)) throw new WorkspaceError("forbidden", "A relation cannot expose a more restricted record")
        if (["resolves", "corrects", "supersedes"].includes(edge.kind) && JSON.stringify(target.scope) !== JSON.stringify(input.scope)) throw new WorkspaceError("invalid_input", "A state transition must keep the original audience")
        if (input.occurredAt && target.occurredAt && input.occurredAt < target.occurredAt && edge.kind !== "corrects") throw new WorkspaceError("invalid_input", "Earlier evidence cannot resolve a later observation")
      }
      const duplicate = this.files.records().find((record) => record.kind === input.kind && record.body === input.body && JSON.stringify(record.scope) === JSON.stringify(input.scope) && JSON.stringify(record.evidence) === JSON.stringify(input.evidence))
      if (duplicate) return duplicate
      const policy = this.admission(input, sources)
      const createdAt = now()
      const id = `memory-${randomUUID()}`
      const record: MemoryRecord = {
        ...input, id, communityId: this.communityId, revision: 1,
        path: `history/${id}/1`, createdAt, updatedAt: createdAt,
        generatedBy: audience.agentId ? `${audience.agentId}/ada-memory-v1` : `human:${audience.userId}`,
        admission: policy.accept ? "accepted" : "review", admissionReason: policy.reason, verified: [],
      }
      this.files.writeRecord(catalog, record)
      return record
    })
  }

  private admission(input: MemoryProposal, sources: MemorySource[]): { accept: boolean; reason: string } {
    if (input.uncertainty) return { accept: false, reason: "Ada identified uncertainty; a teacher must review the interpretation." }
    const modifies = input.relations.some((edge) => ["corrects", "supersedes"].includes(edge.kind))
    if (modifies) return { accept: false, reason: "A correction or conflicting replacement needs teacher review." }
    if (input.kind === "inference") return { accept: true, reason: "Evidence-backed Ada inference; this is an interpretation, not verified understanding." }
    if (input.scope.kind === "learner" && ["question", "observation", "commitment"].includes(input.kind)) return { accept: true, reason: "Attributed learner or teacher evidence, retained as a dated observation." }
    const educational = ["concept", "example"].includes(input.kind)
    const authorized = sources.every((source) => source.authority === "course_material" || source.authority === "teacher_statement")
    if (!authorized) return { accept: false, reason: "This contribution needs confirmation from a course teacher." }
    // Multiple existing decisions for a concept are not silently last-write-wins.
    const conflicts = !educational && this.files.records().some((record) => record.admission === "accepted" && record.kind === input.kind && record.concept && record.concept === input.concept && JSON.stringify(record.scope) === JSON.stringify(input.scope))
    return conflicts ? { accept: false, reason: "An existing course decision may conflict; a teacher must reconcile both." } : { accept: true, reason: "Supported by course material or a direct authenticated teacher statement." }
  }

  review(userId: string, id: string, raw: unknown): MemoryRecord {
    const audience = this.actor(userId)
    if (memoryRole(this.db, audience) !== "teacher") throw new WorkspaceError("forbidden", "Only teachers can review shared memory")
    const input = memoryReviewSchema.parse(raw)
    return this.files.commit((catalog) => {
      const previous = this.files.record(id)
      if (!previous || !this.canReadRecord(audience, previous)) throw new WorkspaceError("not_found", "Memory not found")
      if (previous.revision !== input.expectedRevision) throw new WorkspaceError("conflict", "The record changed; reload before reviewing")
      if (input.decision === "accept" && !this.evidenceValid(previous)) throw new WorkspaceError("conflict", "Evidence changed; create a proposal from the current source before accepting")
      const updatedAt = now()
      const record: MemoryRecord = {
        ...previous, body: input.body ?? previous.body, revision: previous.revision + 1, path: `history/${id}/${previous.revision + 1}`, updatedAt,
        admission: input.decision === "accept" ? "accepted" : "rejected", admissionReason: `Teacher ${input.decision === "accept" ? "reviewed" : "rejected"} this interpretation.`,
        reviewNote: input.note, verified: input.decision === "accept" ? [...previous.verified, { by: `human:${userId}`, at: updatedAt }] : [],
      }
      this.files.writeRecord(catalog, record)
      return record
    })
  }

  revoke(userId: string, id: string, expectedVersion: number): MemorySource {
    const audience = this.actor(userId)
    if (memoryRole(this.db, audience) !== "teacher") throw new WorkspaceError("forbidden", "Only teachers can revoke a source")
    return this.files.commit((catalog) => {
      const previous = this.sourceFor(audience, id)
      if (previous.version !== expectedVersion) throw new WorkspaceError("conflict", "The source changed; reload before revoking")
      const source = { ...previous, version: previous.version + 1, revoked: true }
      this.files.writeSource(catalog, source, this.files.raw(previous), this.files.text(previous))
      return source
    })
  }
}
