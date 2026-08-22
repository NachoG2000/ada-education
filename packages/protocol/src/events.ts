import { z } from "zod"
import type { Community } from "./types.js"

const cardTypeSchema = z.enum(["note", "assignment", "decision", "answer", "submission"])
const visibilitySchema = z.enum(["channel", "only-me"])
const presenceSchema = z.enum(["online", "away", "thinking", "publishing"])

export const citationSchema = z.object({
  cardId: z.string(),
  section: z.string().optional(),
})

export const messageBlockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("cite"), text: z.string(), cite: citationSchema }),
  z.object({ kind: z.literal("code"), text: z.string() }),
])

export const messageSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  authorId: z.string(),
  at: z.string(),
  paragraphs: z.array(z.array(messageBlockSchema)),
  threadId: z.string().optional(),
  fromCard: z.object({ cardId: z.string(), ago: z.string() }).optional(),
  publishes: z.string().optional(),
  reactions: z.array(z.object({ emoji: z.string(), count: z.number() })).optional(),
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
})

export const channelSchema = z.object({
  id: z.string(),
  name: z.string(),
  group: z.enum(["course", "work", "private"]),
  description: z.string().optional(),
  memberIds: z.array(z.string()),
  memberCount: z.number().optional(),
  work: z.object({
    status: z.enum(["active", "submitted", "archived"]),
    due: z.string().optional(),
  }).optional(),
  unread: z.boolean().optional(),
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
])

export const runnerServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("agent.mention"),
    payload: z.object({
      channelId: z.string(),
      threadId: z.string().optional(),
      message: messageSchema,
      from: memberSchema,
      context: z.array(messageSchema),
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
])

const ackSuccessSchema = z.object({
  type: z.literal("ack"),
  ref: z.string(),
  ok: z.literal(true),
  message: messageSchema.optional(),
  card: cardSchema.optional(),
})

const ackErrorSchema = z.object({
  type: z.literal("ack"),
  ref: z.string(),
  ok: z.literal(false),
  error: z.string(),
})

export const ackSchema = z.discriminatedUnion("ok", [ackSuccessSchema, ackErrorSchema])

export type CommunitySnapshot = Omit<Community, "meId">
export type ServerEvent = z.infer<typeof serverEventSchema>
export type RunnerServerMessage = z.infer<typeof runnerServerMessageSchema>
export type RunnerClientMessage = z.infer<typeof runnerClientMessageSchema>
export type CardPublishInput = z.infer<typeof cardPublishInputSchema>
export type Ack = z.infer<typeof ackSchema>
