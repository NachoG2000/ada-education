import { z } from "zod"

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/)
const timestamp = z.string().datetime({ offset: true })
export const memoryScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("course") }).strict(),
  z.object({ kind: z.literal("channel"), channelId: id }).strict(),
  z.object({ kind: z.literal("learner"), learnerId: id }).strict(),
])
export const memoryKindSchema = z.enum(["concept", "example", "decision", "event", "commitment", "question", "observation", "inference"])
export const memoryEvidenceSchema = z.object({ sourceId: id, version: z.number().int().positive(), quote: z.string().trim().min(1).max(8000) }).strict()
export const memoryRelationSchema = z.object({ kind: z.enum(["supports", "refines", "resolves", "corrects", "supersedes"]), recordId: id }).strict()

/** Models supply proposals only. Authorship, authority and review are server-owned. */
export const memoryProposalSchema = z.object({
  title: z.string().trim().min(1).max(180),
  kind: memoryKindSchema,
  body: z.string().trim().min(1).max(24000),
  scope: memoryScopeSchema,
  concept: z.string().trim().min(1).max(120).optional(),
  module: z.string().trim().min(1).max(120).optional(),
  occurredAt: timestamp.optional(),
  staleAfter: timestamp.optional(),
  effectiveAt: timestamp.optional(),
  evidence: z.array(memoryEvidenceSchema).min(1).max(20),
  relations: z.array(memoryRelationSchema).max(20).default([]),
  uncertainty: z.string().trim().max(2000).optional(),
}).strict()

export const memorySourceSchema = z.object({
  id, communityId: id, version: z.number().int().positive(),
  title: z.string(), filename: z.string(), mediaType: z.string(),
  digest: z.string(), bytes: z.number().int().nonnegative(),
  scope: memoryScopeSchema,
  origin: z.enum(["material", "message", "legacy"]),
  authorId: id, authorRole: z.enum(["teacher", "student"]),
  authority: z.enum(["course_material", "teacher_statement", "self_report", "unreviewed"]),
  createdAt: timestamp, revoked: z.boolean(),
  messageId: id.optional(), channelId: id.optional(),
  processedAt: timestamp.optional(), processingError: z.string().optional(),
}).strict()
export const memoryRecordSchema = memoryProposalSchema.extend({
  id, communityId: id, revision: z.number().int().positive(), path: z.string(),
  createdAt: timestamp, updatedAt: timestamp,
  generatedBy: z.string(),
  admission: z.enum(["accepted", "review", "rejected"]),
  admissionReason: z.string(),
  verified: z.array(z.object({ by: z.string(), at: timestamp }).strict()),
  reviewNote: z.string().optional(),
}).strict()
export const memoryRecordViewSchema = memoryRecordSchema.extend({
  state: z.enum(["current", "scheduled", "expired", "resolved", "superseded", "corrected", "needs_review", "rejected"]),
  evidenceValid: z.boolean(),
}).strict()
export const memorySnapshotSchema = z.object({
  version: z.number().int().nonnegative(),
  sources: z.array(memorySourceSchema),
  records: z.array(memoryRecordViewSchema),
}).strict()
export const memorySourceInputSchema = z.object({
  title: z.string().trim().min(1).max(180),
  scope: memoryScopeSchema,
  origin: z.enum(["material", "legacy"]).optional(),
  sourceId: id.optional(),
  expectedVersion: z.number().int().positive().optional(),
}).strict()
export const memoryReviewSchema = z.object({
  expectedRevision: z.number().int().positive(),
  decision: z.enum(["accept", "reject"]),
  note: z.string().trim().min(1).max(4000),
  body: z.string().trim().min(1).max(24000).optional(),
}).strict()

export const memoryRunViewSchema = z.object({
  runId: id,
  purpose: z.enum(["respond", "consolidate"]),
  scope: memoryScopeSchema,
  records: z.array(memoryRecordViewSchema),
  learners: z.array(z.object({ id, name: z.string() }).strict()).optional(),
  sources: z.array(memorySourceSchema.extend({ text: z.string().max(120000) })),
}).strict()
export const runnerMemoryResultSchema = z.object({
  type: z.literal("memory.result"), ref: id,
  payload: z.object({
    runId: id,
    proposals: z.array(memoryProposalSchema).max(30),
    answer: z.string().max(60000).optional(),
    error: z.string().max(1200).optional(),
  }).strict(),
}).strict()
export const runnerMemoryWorkSchema = z.object({
  type: z.literal("memory.work"),
  payload: z.object({
    communityId: id, agentId: id, instructions: z.string().max(20000),
    requester: z.object({ id, name: z.string(), role: z.enum(["teacher", "student"]) }).strict(),
    request: z.string().max(60000),
    view: memoryRunViewSchema,
  }).strict(),
}).strict()
export type MemoryScope = z.infer<typeof memoryScopeSchema>
export type MemoryProposal = z.infer<typeof memoryProposalSchema>
export type MemorySource = z.infer<typeof memorySourceSchema>
export type MemoryRecord = z.infer<typeof memoryRecordSchema>
export type MemoryRecordView = z.infer<typeof memoryRecordViewSchema>
export type MemorySnapshot = z.infer<typeof memorySnapshotSchema>
export type MemoryRunView = z.infer<typeof memoryRunViewSchema>
export type MemoryWork = z.infer<typeof runnerMemoryWorkSchema>
export const memoryJobSchema = z.object({
  id, sourceId: id, purpose: z.enum(["respond", "consolidate"]),
  sourceVersion: z.number().int().positive(), channelId: id.nullable(), threadId: id.nullable(), canRetry: z.boolean(),
  status: z.enum(["pending", "running", "done", "failed"]),
  error: z.string().nullable(), createdAt: timestamp,
}).strict()
export type MemoryJob = z.infer<typeof memoryJobSchema>
