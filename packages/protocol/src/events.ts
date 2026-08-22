import { z } from "zod"
import type { Community } from "./types.js"

const pageTypeSchema = z.enum(["apunte", "consigna", "decision", "respuesta", "entrega"])
const visibilitySchema = z.enum(["canal", "solo-yo"])
const presenceSchema = z.enum(["en-linea", "ausente", "pensando", "publicando"])

export const citationSchema = z.object({
  pageId: z.string(),
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
  fromPage: z.object({ pageId: z.string(), ago: z.string() }).optional(),
  publishes: z.string().optional(),
  reactions: z.array(z.object({ emoji: z.string(), count: z.number() })).optional(),
})

export const threadSchema = z.object({
  id: z.string(),
  rootMessageId: z.string(),
  replyIds: z.array(z.string()),
  publishedPageId: z.string().optional(),
})

const personSchema = z.object({
  kind: z.literal("person"),
  id: z.string(),
  name: z.string(),
  initials: z.string(),
  tone: z.enum(["ficha", "cartulina", "sello-soft", "rojo-soft"]),
  role: z.enum(["profesor", "alumno"]).optional(),
  presence: presenceSchema,
})

const agentSchema = z.object({
  kind: z.literal("agent"),
  id: z.string(),
  name: z.string(),
  scope: z.enum(["comunidad", "personal"]),
  createdBy: z.string(),
  figureSeed: z.string().optional(),
  figureColor: z.enum(["coral", "verde", "amarillo", "azul", "lila", "rosa", "teal", "naranja", "rojo", "lima"]).optional(),
  instructions: z.string(),
  provider: z.object({ mode: z.enum(["suscripcion", "api-key"]), model: z.string() }),
  channelIds: z.array(z.string()),
  presence: presenceSchema,
})

export const memberSchema = z.discriminatedUnion("kind", [personSchema, agentSchema])

export const pageSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  title: z.string(),
  type: pageTypeSchema,
  authorId: z.string(),
  version: z.number(),
  visibility: visibilitySchema,
  sources: z.array(z.object({
    kind: z.enum(["mensaje", "archivo"]),
    ref: z.string(),
    label: z.string(),
  })),
  replaces: z.string().optional(),
  base: z.boolean().optional(),
  state: z.enum(["nueva", "actualizada", "reemplazada", "compilando"]).optional(),
  publishedAt: z.string(),
  body: z.string(),
})

export const channelSchema = z.object({
  id: z.string(),
  name: z.string(),
  group: z.enum(["curso", "trabajo", "privados"]),
  description: z.string().optional(),
  memberIds: z.array(z.string()),
  memberCount: z.number().optional(),
  work: z.object({
    status: z.enum(["activo", "entregado", "archivado"]),
    due: z.string().optional(),
  }).optional(),
  unread: z.boolean().optional(),
})

/** Snapshot que hidrata la web; `meId` lo decide cada cliente local. */
export const communitySnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  subtitle: z.string(),
  initial: z.string(),
  members: z.array(memberSchema),
  channels: z.array(channelSchema),
  pages: z.array(pageSchema),
  messages: z.array(messageSchema),
  threads: z.array(threadSchema),
})

export const pagePublishInputSchema = z.object({
  channelId: z.string(),
  path: z.string(),
  title: z.string(),
  type: pageTypeSchema,
  visibility: visibilitySchema,
  sources: pageSchema.shape.sources,
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
    type: z.literal("page.published"),
    payload: z.object({ page: pageSchema, message: messageSchema }),
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
      fromPage: z.object({ pageId: z.string(), ago: z.string() }).optional(),
      publishes: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("page.publish"),
    ref: z.string(),
    payload: pagePublishInputSchema,
  }),
])

const ackSuccessSchema = z.object({
  type: z.literal("ack"),
  ref: z.string(),
  ok: z.literal(true),
  message: messageSchema.optional(),
  page: pageSchema.optional(),
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
export type PagePublishInput = z.infer<typeof pagePublishInputSchema>
export type Ack = z.infer<typeof ackSchema>
