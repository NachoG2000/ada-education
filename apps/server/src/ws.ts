import type { IncomingMessage, Server as HttpServer } from "node:http"
import type { Socket } from "node:net"
import type {
  Agent,
  Channel,
  Member,
  Message,
  Page,
  Presence,
  Thread,
} from "@ada/protocol"
import {
  runnerClientMessageSchema,
  type Ack,
  type PagePublishInput,
  type RunnerClientMessage,
  type RunnerServerMessage,
  type ServerEvent,
} from "@ada/protocol"
import { WebSocket, WebSocketServer } from "ws"
import { mentionContext, mentionedAgentIds } from "./mentions.js"

export type AgentRecord = Agent & { token: string; runtime?: string; model?: string }

/** Funciones que el hub necesita del archivo SQLite; no contiene storage. */
export type WsStore = {
  findAgentByToken(token: string): AgentRecord | undefined
  members(): Member[]
  channel(id: string): Channel | undefined
  member(id: string): Member | undefined
  messages(): Message[]
  threadRootMessageId(threadId: string): string | undefined
  createMessage(input: {
    authorId: string
    channelId: string
    threadId?: string
    paragraphs: Message["paragraphs"]
    fromPage?: { pageId: string; ago: string }
    publishes?: string
  }): Message
  publishPage(input: PagePublishInput & { authorId: string }): { page: Page; message: Message }
}

export type PresenceChange = (agentId: string, presence: Presence, runtime?: string, model?: string) => void

export type WebSocketHub = {
  web: Set<WebSocket>
  runners: Map<string, WebSocket>
  presence: Map<string, { presence: Presence; runtime?: string; model?: string }>
  broadcast(event: ServerEvent): void
  onMessageCreated(message: Message): void
  onPagePublished(page: Page, message: Message): void
  onThreadCreated(thread: Thread): void
  handleUpgrade(request: IncomingMessage, socket: Socket, head: Buffer): void
  close(): Promise<void>
}

function send(socket: WebSocket, value: unknown): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value))
}

export function createWebSocketHub(server: HttpServer, store: WsStore, onPresence?: PresenceChange): WebSocketHub {
  const web = new Set<WebSocket>()
  const runners = new Map<string, WebSocket>()
  const presence = new Map<string, { presence: Presence; runtime?: string; model?: string }>()
  const wss = new WebSocketServer({ noServer: true })

  const broadcast = (event: ServerEvent): void => {
    for (const client of web) send(client, event)
  }

  const setPresence = (agent: AgentRecord, value: { presence: Presence; runtime?: string; model?: string }): void => {
    const next = { ...presence.get(agent.id), ...value }
    presence.set(agent.id, next)
    onPresence?.(agent.id, next.presence, next.runtime, next.model)
    const event: ServerEvent = { type: "member.presence", payload: { memberId: agent.id, ...next } }
    broadcast(event)
  }

  const mention = (message: Message): void => {
    const channel = store.channel(message.channelId)
    if (!channel) return
    const members = store.members()
    const agents = mentionedAgentIds(message, channel, members)
    if (agents.length === 0) return
    const context = mentionContext(
      store.messages(),
      message.channelId,
      message.threadId,
      new Date(),
      message.threadId ? store.threadRootMessageId(message.threadId) : undefined,
    )
    for (const agentId of agents) {
      const runner = runners.get(agentId)
      const from = store.member(message.authorId)
      if (!runner || !from) continue
      const event: RunnerServerMessage = {
        type: "agent.mention",
        payload: { channelId: message.channelId, ...(message.threadId ? { threadId: message.threadId } : {}), message, from, context },
      }
      send(runner, event)
    }
  }

  const handleRunnerMessage = (socket: WebSocket, agent: AgentRecord, raw: string): void => {
    let parsed: RunnerClientMessage
    try {
      parsed = runnerClientMessageSchema.parse(JSON.parse(raw))
    } catch {
      // Si alcanzamos a leer una ref, devolvemos el ack de error del contrato.
      // Sin ref no hay respuesta protocolar posible y se ignora el frame.
      try {
        const candidate: unknown = JSON.parse(raw)
        if (isRecord(candidate) && typeof candidate.ref === "string") {
          send(socket, { type: "ack", ref: candidate.ref, ok: false, error: "mensaje de runner inválido" } satisfies Ack)
        }
      } catch {
        // JSON inválido: se descarta sin inventar un tipo de evento.
      }
      return
    }
    try {
      if (parsed.type === "presence") {
        setPresence(agent, parsed.payload)
        return
      }
      if (parsed.type === "message.create") {
        const message = store.createMessage({ authorId: agent.id, ...parsed.payload })
        send(socket, { type: "ack", ref: parsed.ref, ok: true, message } satisfies Ack)
        broadcast({ type: "message.created", payload: { message } })
        mention(message)
        return
      }
      const result = store.publishPage({ authorId: agent.id, ...parsed.payload })
      send(socket, { type: "ack", ref: parsed.ref, ok: true, page: result.page, message: result.message } satisfies Ack)
      broadcast({ type: "page.published", payload: result })
      mention(result.message)
    } catch (error) {
      const detail = error instanceof Error ? error.message : "operación rechazada"
      if ("ref" in parsed) send(socket, { type: "ack", ref: parsed.ref, ok: false, error: detail } satisfies Ack)
      else console.error(`No se pudo actualizar la presencia del runner: ${detail}`)
    }
  }

  const handleConnection = (socket: WebSocket, request: IncomingMessage): void => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname
    if (pathname === "/ws") {
      web.add(socket)
      socket.once("close", () => web.delete(socket))
      return
    }
    const token = new URL(request.url ?? "/", "http://localhost").searchParams.get("token")
    const agent = token ? store.findAgentByToken(token) : undefined
    if (!agent) {
      socket.close(4401, "token inválido")
      return
    }
    const old = runners.get(agent.id)
    old?.close(1000, "runner reemplazado")
    runners.set(agent.id, socket)
    setPresence(agent, {
      presence: "en-linea",
      ...(agent.runtime ? { runtime: agent.runtime } : {}),
      ...(agent.model ? { model: agent.model } : {}),
    })
    socket.on("message", (raw) => handleRunnerMessage(socket, agent, raw.toString()))
    socket.once("close", () => {
      if (runners.get(agent.id) !== socket) return
      runners.delete(agent.id)
      setPresence(agent, {
        presence: "ausente",
        ...(agent.runtime ? { runtime: agent.runtime } : {}),
        ...(agent.model ? { model: agent.model } : {}),
      })
    })
  }

  wss.on("connection", handleConnection)
  const handleUpgrade = (request: IncomingMessage, socket: Socket, head: Buffer): void => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname
    if (pathname !== "/ws" && pathname !== "/ws/runner") {
      // Un upgrade ajeno al server no se puede manejar acá.
      socket.destroy()
      return
    }
    wss.handleUpgrade(request, socket, head, (client) => wss.emit("connection", client, request))
  }
  server.on("upgrade", handleUpgrade)

  const hub: WebSocketHub = {
    web,
    runners,
    presence,
    broadcast,
    onMessageCreated(message) {
      broadcast({ type: "message.created", payload: { message } })
      mention(message)
    },
    onPagePublished(page, message) {
      broadcast({ type: "page.published", payload: { page, message } })
      mention(message)
    },
    onThreadCreated(thread) {
      broadcast({ type: "thread.created", payload: { thread } })
    },
    handleUpgrade,
    close() {
      server.off("upgrade", handleUpgrade)
      const sockets = [...web, ...runners.values()]
      for (const socket of sockets) socket.close(1000, "servidor apagándose")
      web.clear()
      runners.clear()
      return new Promise<void>((resolve) => {
        let settled = false
        const finish = (): void => {
          if (settled) return
          settled = true
          clearTimeout(forceClose)
          resolve()
        }
        const forceClose = setTimeout(() => {
          for (const socket of sockets) socket.terminate()
          finish()
        }, 1_000)
        try {
          wss.close(() => finish())
        } catch {
          finish()
        }
      })
    },
  }
  return hub
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
