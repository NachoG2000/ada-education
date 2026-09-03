import { z } from "zod"
import type { Community } from "./types.js"

const cardTypeSchema = z.enum(["note", "assignment", "decision", "answer", "submission"])
const visibilitySchema = z.enum(["channel", "only-me"])
const presenceSchema = z.enum(["online", "away", "thinking", "publishing"])
export const channelVisibilitySchema = z.enum(["open", "private"])
export const channelStatusSchema = z.enum(["active", "archived"])
export const agentStatusSchema = z.enum(["active", "inactive"])
export const agentRuntimeSchema = z.enum(["scripted", "claude"])
export const apiErrorCodeSchema = z.enum([
  "invalid_input",
  "unauthorized",
  "forbidden",
  "not_found",
  "not_channel_member",
  "channel_archived",
  "conflict",
  "history_conflict",
])

export const apiErrorSchema = z.object({
  error: z.string(),
  code: apiErrorCodeSchema,
  field: z.string().optional(),
})

export const citationSchema = z.object({
  cardId: z.string(),
  section: z.string().optional(),
})

export const messageBlockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("cite"), text: z.string(), cite: citationSchema }),
  z.object({ kind: z.literal("code"), text: z.string() }),
])

export const attachmentSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  uploaderId: z.string(),
  name: z.string(),
  mime: z.string(),
  size: z.number(),
  createdAt: z.string(),
  messageId: z.string().optional(),
})

export const messageReactionSchema = z.object({
  emoji: z.string(),
  count: z.number(),
  memberIds: z.array(z.string()),
})

export const messageSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  authorId: z.string(),
  at: z.string(),
  paragraphs: z.array(z.array(messageBlockSchema)),
  threadId: z.string().optional(),
  fromCard: z.object({ cardId: z.string(), ago: z.string() }).optional(),
  publishes: z.string().optional(),
  clientId: z.string().optional(),
  editedAt: z.string().optional(),
  deletedAt: z.string().optional(),
  attachments: z.array(attachmentSchema).optional(),
  reactions: z.array(messageReactionSchema).optional(),
})

export const threadSchema = z.object({
  id: z.string(),
  rootMessageId: z.string(),
  replyIds: z.array(z.string()),
  publishedCardId: z.string().optional(),
})

const personSchema = z.object({
  kind: z.literal("person"),
  id: z.string(),
  name: z.string(),
  initials: z.string(),
  tone: z.enum(["card", "cardstock", "seal-soft", "red-soft"]),
  role: z.enum(["teacher", "student"]).optional(),
  presence: presenceSchema,
})

const agentSchema = z.object({
  kind: z.literal("agent"),
  id: z.string(),
  name: z.string(),
  scope: z.enum(["community", "personal"]),
  createdBy: z.string(),
  figureSeed: z.string().optional(),
  figureColor: z.enum(["coral", "green", "yellow", "blue", "lilac", "pink", "teal", "orange", "red", "lime"]).optional(),
  instructions: z.string(),
  provider: z.object({ mode: z.enum(["subscription", "api-key"]), model: z.string() }),
  channelIds: z.array(z.string()),
  presence: presenceSchema,
  description: z.string().optional(),
  /* Snapshot compatibility: older seeded agents used arbitrary runtime labels;
     create/update request schemas remain strict via agentRuntimeSchema. */
  runtime: z.string().optional(),
  model: z.string().optional(),
  status: agentStatusSchema.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  inactiveAt: z.string().optional(),
})

export const memberSchema = z.discriminatedUnion("kind", [personSchema, agentSchema])

export const cardSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  title: z.string(),
  type: cardTypeSchema,
  authorId: z.string(),
  version: z.number(),
  visibility: visibilitySchema,
  sources: z.array(z.object({
    kind: z.enum(["message", "file"]),
    ref: z.string(),
    label: z.string(),
  })),
  replaces: z.string().optional(),
  base: z.boolean().optional(),
  state: z.enum(["new", "updated", "superseded", "compiling"]).optional(),
  publishedAt: z.string(),
  body: z.string(),
  path: z.string().optional(),
})

export const channelSchema = z.object({
  id: z.string(),
  name: z.string(),
  group: z.enum(["course", "work", "private"]),
  visibility: channelVisibilitySchema.optional(),
  status: channelStatusSchema.optional(),
  createdBy: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  archivedAt: z.string().optional(),
  description: z.string().optional(),
  memberIds: z.array(z.string()),
  memberCount: z.number().optional(),
  work: z.object({
    status: z.enum(["active", "submitted", "archived"]),
    due: z.string().optional(),
  }).optional(),
  unread: z.boolean().optional(),
})

export const workChannelInputSchema = z.object({
  status: z.enum(["active", "submitted", "archived"]).optional(),
  due: z.string().optional(),
})

/** REST request schemas. Actor/creator IDs deliberately do not appear: the
    server derives identity from the bearer token (with legacy ungated mode
    handled by the server adapter). */
export const createChannelInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(1000).optional(),
  group: z.enum(["course", "work", "private"]),
  visibility: channelVisibilitySchema,
  memberIds: z.array(z.string()).max(100).optional(),
  agentIds: z.array(z.string()).max(100).optional(),
  work: workChannelInputSchema.optional(),
})

export const updateChannelInputSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(1000).nullable().optional(),
  group: z.enum(["course", "work", "private"]).optional(),
  visibility: channelVisibilitySchema.optional(),
  status: channelStatusSchema.optional(),
  work: workChannelInputSchema.nullable().optional(),
})

export const replaceChannelMembersInputSchema = z.object({
  memberIds: z.array(z.string()).max(100),
  agentIds: z.array(z.string()).max(100),
})

export const createAgentInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(2000).optional(),
  instructions: z.string().max(20_000),
  scope: z.enum(["community", "personal"]),
  runtime: agentRuntimeSchema,
  model: z.string().max(200).optional(),
  figureSeed: z.string().max(200).optional(),
  figureColor: z.enum(["coral", "green", "yellow", "blue", "lilac", "pink", "teal", "orange", "red", "lime"]).optional(),
  channelIds: z.array(z.string()).max(100),
})

export const updateAgentInputSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(2000).optional(),
  instructions: z.string().max(20_000).optional(),
  scope: z.enum(["community", "personal"]).optional(),
  runtime: agentRuntimeSchema.optional(),
  model: z.string().max(200).optional(),
  figureSeed: z.string().max(200).optional(),
  figureColor: z.enum(["coral", "green", "yellow", "blue", "lilac", "pink", "teal", "orange", "red", "lime"]).optional(),
  channelIds: z.array(z.string()).max(100).optional(),
  status: agentStatusSchema.optional(),
})

export const communityUpdateInputSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  subtitle: z.string().max(240).optional(),
})

export const profileUpdateInputSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  initials: z.string().trim().max(4).optional(),
  tone: z.enum(["card", "cardstock", "seal-soft", "red-soft"]).optional(),
})

export const messageCreateInputSchema = z.object({
  threadId: z.string().optional(),
  paragraphs: z.array(z.array(messageBlockSchema)),
  clientId: z.string().max(200).optional(),
  attachmentIds: z.array(z.string()).max(20).optional(),
})

export const editMessageInputSchema = z.object({
  paragraphs: z.array(z.array(messageBlockSchema)),
})

export const messageReactionInputSchema = z.object({
  emoji: z.string().trim().min(1).max(32),
})

export const attachmentReferenceInputSchema = z.object({
  attachmentIds: z.array(z.string()).max(20),
})

export const readMarkerInputSchema = z.object({
  lastReadAt: z.string(),
})

export const typingInputSchema = z.object({
  channelId: z.string(),
  typing: z.boolean(),
})

/* ---- Modules, assignments, feedback, reports (DECISIONS.md §18) ------------ */

export const difficultyLevelSchema = z.enum(["intro", "core", "advanced"])
export const moduleStatusSchema = z.enum(["empty", "compiling", "ready"])

export const materialSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["markdown", "pdf", "slides", "link"]),
  size: z.number().optional(),
  path: z.string(),
  uploadedAt: z.string(),
})

export const difficultySchema = z.object({
  level: difficultyLevelSchema,
  rationale: z.string().optional(),
  evidence: z.array(z.string()).optional(),
  suggestedBy: z.string().optional(),
  setBy: z.string().optional(),
})

export const moduleSchema = z.object({
  id: z.string(),
  index: z.number(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  channelId: z.string(),
  objectives: z.array(z.string()),
  difficulty: difficultySchema,
  status: moduleStatusSchema,
  materials: z.array(materialSchema),
  cardIds: z.array(z.string()),
  revision: z.string().optional(),
})

export const assignmentSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  channelId: z.string(),
  title: z.string(),
  due: z.string(),
  status: z.enum(["active", "submitted", "archived"]),
})

export const feedbackSchema = z.object({
  id: z.string(),
  assignmentId: z.string(),
  studentId: z.string(),
  agentId: z.string(),
  at: z.string(),
  score: z.object({ got: z.number(), of: z.number() }),
  summary: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(z.object({ moduleId: z.string(), note: z.string(), cardId: z.string().optional() })),
  nextSteps: z.array(z.object({ text: z.string(), cardId: z.string().optional() })),
})

export const reportSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  studentId: z.string(),
  moduleId: z.string(),
  assignmentId: z.string().optional(),
  at: z.string(),
  told: z.string(),
  recommendations: z.array(z.object({ id: z.string(), text: z.string() })),
  cardIds: z.array(z.string()),
  status: z.enum(["new", "reconciled"]),
  reconciled: z.object({
    at: z.string(),
    by: z.string(),
    accepted: z.array(z.string()),
    note: z.string(),
    cardId: z.string(),
  }).optional(),
})

/** What a runner sends after compiling a module: a suggested difficulty (the teacher's hand-set level wins). */
export const moduleSuggestInputSchema = z.object({
  moduleId: z.string(),
  status: moduleStatusSchema.optional(),
  difficulty: z.object({
    level: difficultyLevelSchema,
    rationale: z.string(),
    evidence: z.array(z.string()).default([]),
  }),
})

/** What a runner files to the teacher after advising a student. */
export const reportCreateInputSchema = z.object({
  studentId: z.string(),
  moduleId: z.string(),
  assignmentId: z.string().optional(),
  told: z.string(),
  recommendations: z.array(z.object({ id: z.string(), text: z.string() })),
  cardIds: z.array(z.string()).default([]),
})

/** Snapshot that hydrates the web client; each local client decides its own `meId`. */
export const communitySnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  subtitle: z.string(),
  initial: z.string(),
  members: z.array(memberSchema),
  channels: z.array(channelSchema),
  cards: z.array(cardSchema),
  messages: z.array(messageSchema),
  threads: z.array(threadSchema),
  modules: z.array(moduleSchema),
  assignments: z.array(assignmentSchema),
  feedback: z.array(feedbackSchema),
  reports: z.array(reportSchema),
  updatedAt: z.string().optional(),
})

export const communityInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  subtitle: z.string(),
  initial: z.string(),
  updatedAt: z.string().optional(),
})

export const cardPublishInputSchema = z.object({
  channelId: z.string(),
  path: z.string(),
  title: z.string(),
  type: cardTypeSchema,
  visibility: visibilitySchema,
  sources: cardSchema.shape.sources,
  replaces: z.string().optional(),
  body: z.string(),
  base: z.boolean().optional(),
})

export const serverEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message.created"),
    payload: z.object({ message: messageSchema }),
  }),
  z.object({
    type: z.literal("thread.created"),
    payload: z.object({ thread: threadSchema }),
  }),
  z.object({
    type: z.literal("card.published"),
    payload: z.object({ card: cardSchema, message: messageSchema }),
  }),
  z.object({
    type: z.literal("member.presence"),
    payload: z.object({
      memberId: z.string(),
      presence: presenceSchema,
      runtime: z.string().optional(),
      model: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("module.updated"),
    payload: z.object({ module: moduleSchema }),
  }),
  z.object({
    type: z.literal("feedback.created"),
    payload: z.object({ feedback: feedbackSchema }),
  }),
  z.object({
    type: z.literal("report.updated"),
    payload: z.object({ report: reportSchema }),
  }),
  z.object({
    type: z.literal("member.joined"),
    payload: z.object({ member: memberSchema }),
  }),
  z.object({
    type: z.literal("channel.created"),
    payload: z.object({ channel: channelSchema }),
  }),
  z.object({
    type: z.literal("channel.updated"),
    payload: z.object({ channel: channelSchema }),
  }),
  z.object({
    type: z.literal("channel.deleted"),
    payload: z.object({ channelId: z.string(), deletedAt: z.string(), deletedBy: z.string() }),
  }),
  z.object({
    type: z.literal("member.updated"),
    payload: z.object({ member: memberSchema }),
  }),
  z.object({
    type: z.literal("member.deleted"),
    payload: z.object({ memberId: z.string() }),
  }),
  z.object({
    type: z.literal("community.updated"),
    payload: z.object({ community: communityInfoSchema }),
  }),
  z.object({
    type: z.literal("message.updated"),
    payload: z.object({ message: messageSchema }),
  }),
  z.object({
    type: z.literal("message.deleted"),
    payload: z.object({ message: messageSchema }),
  }),
  z.object({
    type: z.literal("message.reactions.updated"),
    payload: z.object({ messageId: z.string(), reactions: z.array(messageReactionSchema) }),
  }),
  z.object({
    type: z.literal("channel.read"),
    payload: z.object({ channelId: z.string(), memberId: z.string(), lastReadAt: z.string() }),
  }),
  z.object({
    type: z.literal("typing.updated"),
    payload: z.object({ channelId: z.string(), memberId: z.string(), typing: z.boolean() }),
  }),
])

export const mentionIntentSchema = z.enum(["ingest", "plan", "question"])

export const runnerServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("agent.mention"),
    payload: z.object({
      channelId: z.string(),
      threadId: z.string().optional(),
      message: messageSchema,
      from: memberSchema,
      context: z.array(messageSchema),
      /** what the server already knows about the mention (an upload-triggered ingest names its module) */
      intent: mentionIntentSchema.optional(),
      moduleId: z.string().optional(),
    }),
  }),
])

export const runnerClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("presence"),
    payload: z.object({
      presence: presenceSchema,
      runtime: z.string().optional(),
      model: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("message.create"),
    ref: z.string(),
    payload: z.object({
      channelId: z.string(),
      threadId: z.string().optional(),
      paragraphs: z.array(z.array(messageBlockSchema)),
      fromCard: z.object({ cardId: z.string(), ago: z.string() }).optional(),
      publishes: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("card.publish"),
    ref: z.string(),
    payload: cardPublishInputSchema,
  }),
  z.object({
    type: z.literal("module.suggest"),
    ref: z.string(),
    payload: moduleSuggestInputSchema,
  }),
  z.object({
    type: z.literal("report.create"),
    ref: z.string(),
    payload: reportCreateInputSchema,
  }),
])

const ackSuccessSchema = z.object({
  type: z.literal("ack"),
  ref: z.string(),
  ok: z.literal(true),
  message: messageSchema.optional(),
  card: cardSchema.optional(),
  report: reportSchema.optional(),
  module: moduleSchema.optional(),
})

const ackErrorSchema = z.object({
  type: z.literal("ack"),
  ref: z.string(),
  ok: z.literal(false),
  error: z.string(),
  code: apiErrorCodeSchema.optional(),
})

export const ackSchema = z.discriminatedUnion("ok", [ackSuccessSchema, ackErrorSchema])

export type CommunitySnapshot = Omit<Community, "meId">
export type ServerEvent = z.infer<typeof serverEventSchema>
export type RunnerServerMessage = z.infer<typeof runnerServerMessageSchema>
export type RunnerClientMessage = z.infer<typeof runnerClientMessageSchema>
export type CardPublishInput = z.infer<typeof cardPublishInputSchema>
export type Ack = z.infer<typeof ackSchema>
export type ModuleSuggestInput = z.infer<typeof moduleSuggestInputSchema>
export type ReportCreateInput = z.infer<typeof reportCreateInputSchema>
export type MentionIntent = z.infer<typeof mentionIntentSchema>
export type ApiErrorPayload = z.infer<typeof apiErrorSchema>
export type CreateChannelRequest = z.infer<typeof createChannelInputSchema>
export type UpdateChannelRequest = z.infer<typeof updateChannelInputSchema>
export type ReplaceChannelMembersRequest = z.infer<typeof replaceChannelMembersInputSchema>
export type CreateAgentRequest = z.infer<typeof createAgentInputSchema>
export type UpdateAgentRequest = z.infer<typeof updateAgentInputSchema>
export type CommunityUpdateRequest = z.infer<typeof communityUpdateInputSchema>
export type ProfileUpdateRequest = z.infer<typeof profileUpdateInputSchema>
export type MessageCreateRequest = z.infer<typeof messageCreateInputSchema>
export type EditMessageRequest = z.infer<typeof editMessageInputSchema>
export type MessageReactionRequest = z.infer<typeof messageReactionInputSchema>
export type AttachmentReferenceRequest = z.infer<typeof attachmentReferenceInputSchema>
export type ReadMarkerRequest = z.infer<typeof readMarkerInputSchema>
export type TypingRequest = z.infer<typeof typingInputSchema>
