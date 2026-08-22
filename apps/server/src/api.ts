import { Hono } from "hono"
import type { Context } from "hono"
import type { DatabaseSync } from "node:sqlite"
import { messageBlockSchema, pagePublishInputSchema } from "@ada/protocol"
import type { Message, Thread } from "@ada/protocol"
import {
  createMessage,
  createThread,
  getCommunitySnapshot,
  publishPage,
  type MessageInput,
  type AuthoredPagePublishInput,
  type PublishedPage,
} from "./db.js"

export interface ApiHooks {
  onMessageCreated?: (message: Message) => void
  onThreadCreated?: (thread: Thread) => void
  onPagePublished?: (published: PublishedPage) => void
}

export interface ApiOptions extends ApiHooks {
  presence?: ReadonlyMap<string, "en-linea" | "ausente" | "pensando" | "publicando">
}

export function createApi(database: DatabaseSync, options: ApiOptions = {}): Hono {
  const app = new Hono()

  app.get("/api/community", (context) => context.json(getCommunitySnapshot(database, options.presence)))

  app.post("/api/channels/:channelId/messages", async (context) => {
    try {
      const body = await context.req.json<unknown>()
      if (!isRecord(body) || typeof body.authorId !== "string" || !isParagraphs(body.paragraphs)) {
        return context.json({ error: "authorId y paragraphs son obligatorios" }, 400)
      }
      const input: MessageInput = {
        channelId: context.req.param("channelId"),
        authorId: body.authorId,
        paragraphs: body.paragraphs,
        threadId: optionalString(body.threadId),
        fromPage: isRecord(body.fromPage) && typeof body.fromPage.pageId === "string" && typeof body.fromPage.ago === "string"
          ? { pageId: body.fromPage.pageId, ago: body.fromPage.ago }
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
        return context.json({ error: "rootMessageId es obligatorio" }, 400)
      }
      const thread = createThread(database, body.rootMessageId)
      options.onThreadCreated?.(thread)
      return context.json(thread, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  app.post("/api/pages", async (context) => {
    try {
      const body = await context.req.json<unknown>()
      const input = pageInput(body)
      if (!input) return context.json({ error: "faltan campos obligatorios de la ficha" }, 400)
      const published = publishPage(database, input)
      options.onPagePublished?.(published)
      return context.json(published, 200)
    } catch (error) {
      return errorResponse(context, error)
    }
  })

  return app
}

export const createApiApp = createApi

function pageInput(value: unknown): AuthoredPagePublishInput | undefined {
  if (!isRecord(value) || typeof value.authorId !== "string") return undefined
  const parsed = pagePublishInputSchema.safeParse(value)
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
  const message = error instanceof Error ? error.message : "Error interno"
  const status = message.includes("no existe") || message.includes("no pertenece") ? 404 : 400
  return context.json({ error: message }, status)
}
