import { Hono } from "hono"
import type { Context } from "hono"
import type { DatabaseSync } from "node:sqlite"
import { messageBlockSchema, cardPublishInputSchema } from "@ada/protocol"
import type { Message, Thread } from "@ada/protocol"
import {
  createMessage,
  createThread,
  getCommunitySnapshot,
  publishCard,
  type MessageInput,
  type AuthoredCardPublishInput,
  type PublishedCard,
} from "./db.js"

export interface ApiHooks {
  onMessageCreated?: (message: Message) => void
  onThreadCreated?: (thread: Thread) => void
  onCardPublished?: (published: PublishedCard) => void
}

export interface ApiOptions extends ApiHooks {
  presence?: ReadonlyMap<string, "online" | "away" | "thinking" | "publishing">
}

export function createApi(database: DatabaseSync, options: ApiOptions = {}): Hono {
  const app = new Hono()

  app.get("/api/community", (context) => context.json(getCommunitySnapshot(database, options.presence)))

  app.post("/api/channels/:channelId/messages", async (context) => {
    try {
      const body = await context.req.json<unknown>()
      if (!isRecord(body) || typeof body.authorId !== "string" || !isParagraphs(body.paragraphs)) {
        return context.json({ error: "authorId and paragraphs are required" }, 400)
      }
      const input: MessageInput = {
        channelId: context.req.param("channelId"),
        authorId: body.authorId,
        paragraphs: body.paragraphs,
        threadId: optionalString(body.threadId),
        fromCard: isRecord(body.fromCard) && typeof body.fromCard.cardId === "string" && typeof body.fromCard.ago === "string"
          ? { cardId: body.fromCard.cardId, ago: body.fromCard.ago }
          : undefined,
      }
      const message = createMessage(database, input)
      options.onMessageCreated?.(message)
      return context.json(message, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post("/api/threads", async (context) => {
    try {
      const body = await context.req.json<unknown>()
      if (!isRecord(body) || typeof body.rootMessageId !== "string") {
        return context.json({ error: "rootMessageId is required" }, 400)
      }
      const thread = createThread(database, body.rootMessageId)
      options.onThreadCreated?.(thread)
      return context.json(thread, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post("/api/cards", async (context) => {
    try {
      const body = await context.req.json<unknown>()
      const input = cardInput(body)
      if (!input) return context.json({ error: "missing required card fields" }, 400)
      const published = publishCard(database, input)
      options.onCardPublished?.(published)
      return context.json(published, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  return app
}

export const createApiApp = createApi

function cardInput(value: unknown): AuthoredCardPublishInput | undefined {
  if (!isRecord(value) || typeof value.authorId !== "string") return undefined
  const parsed = cardPublishInputSchema.safeParse(value)
  if (!parsed.success) return undefined
  return {
    ...parsed.data,
    authorId: value.authorId,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isParagraphs(value: unknown): value is MessageInput["paragraphs"] {
  return Array.isArray(value) && value.every((paragraph) => Array.isArray(paragraph)
    && paragraph.every((block) => messageBlockSchema.safeParse(block).success))
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function errorResponse(context: Context, error: unknown): Response {
  const message = error instanceof Error ? error.message : "Internal error"
  const status = message.includes("does not exist") || message.includes("does not belong") ? 404 : 400
  return context.json({ error: message }, status)
}
