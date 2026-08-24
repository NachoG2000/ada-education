import type { IncomingMessage, Server as HttpServer } from "node:http"
import type { Socket } from "node:net"
import type {
  Agent,
  Card,
  Channel,
  Member,
  MentionIntent,
  Message,
  Module,
  ModuleSuggestInput,
  Presence,
  Report,
  ReportCreateInput,
  Thread,
} from "@ada/protocol"
import {
  runnerClientMessageSchema,
  type Ack,
  type CardPublishInput,
  type RunnerClientMessage,
  type RunnerServerMessage,
  type ServerEvent,
} from "@ada/protocol"
import { WebSocket, WebSocketServer } from "ws"
import { mentionContext, mentionedAgentIds } from "./mentions.js"

export type AgentRecord = Agent & { token: string; runtime?: string; model?: string }

export type MentionHint = { intent: MentionIntent; moduleId: string }

/** Functions the hub needs from the SQLite file; it holds no storage of its own. */
export type WsStore = {
  findAgentByToken(token: string): AgentRecord | undefined
  /** membership gating (DECISIONS.md §20): when true, /ws needs a person token */
  requireMembership: boolean
  personTokenValid(token: string): boolean
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
    fromCard?: { cardId: string; ago: string }
    publishes?: string
  }): Message
  publishCard(input: CardPublishInput & { authorId: string }): { card: Card; message: Message }
  applyModuleSuggestion(agentId: string, input: ModuleSuggestInput): Module
  createReport(agentId: string, input: ReportCreateInput): Report
}

export type PresenceChange = (agentId: string, presence: Presence, runtime?: string, model?: string) => void

export type WebSocketHub = {
  web: Set<WebSocket>
  runners: Map<string, WebSocket>
  presence: Map<string, { presence: Presence; runtime?: string; model?: string }>
  broadcast(event: ServerEvent): void
  onMessageCreated(message: Message, hint?: MentionHint): void
  onCardPublished(card: Card, message: Message): void
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

  const mention = (message: Message, hint?: MentionHint): void => {
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
        payload: {
          channelId: message.channelId,
          ...(message.threadId ? { threadId: message.threadId } : {}),
          message,
          from,
          context,
          ...(hint ? { intent: hint.intent, moduleId: hint.moduleId } : {}),
        },
      }
      send(runner, event)
    }
  }

  const handleRunnerMessage = (socket: WebSocket, agent: AgentRecord, raw: string): void => {
    let parsed: RunnerClientMessage
    try {
      parsed = runnerClientMessageSchema.parse(JSON.parse(raw))
    } catch {
      // If we managed to read a ref, we return the contract's error ack.
      // Without a ref there is no possible protocol response, so the frame is ignored.
      try {
        const candidate: unknown = JSON.parse(raw)
        if (isRecord(candidate) && typeof candidate.ref === "string") {
          send(socket, { type: "ack", ref: candidate.ref, ok: false, error: "invalid runner message" } satisfies Ack)
        }
      } catch {
        // Invalid JSON: discarded without inventing an event type.
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
      if (parsed.type === "module.suggest") {
        const module = store.applyModuleSuggestion(agent.id, parsed.payload)
        send(socket, { type: "ack", ref: parsed.ref, ok: true, module } satisfies Ack)
        broadcast({ type: "module.updated", payload: { module } })
        return
      }
      if (parsed.type === "report.create") {
        const report = store.createReport(agent.id, parsed.payload)
        send(socket, { type: "ack", ref: parsed.ref, ok: true, report } satisfies Ack)
        broadcast({ type: "report.updated", payload: { report } })
        return
      }
      const result = store.publishCard({ authorId: agent.id, ...parsed.payload })
      send(socket, { type: "ack", ref: parsed.ref, ok: true, card: result.card, message: result.message } satisfies Ack)
      broadcast({ type: "card.published", payload: result })
      mention(result.message)
    } catch (error) {
      const detail = error instanceof Error ? error.message : "operation rejected"
      if ("ref" in parsed) send(socket, { type: "ack", ref: parsed.ref, ok: false, error: detail } satisfies Ack)
      else console.error(`Could not update runner presence: ${detail}`)
    }
  }

  const handleConnection = (socket: WebSocket, request: IncomingMessage): void => {
    const url = new URL(request.url ?? "/", "http://localhost")
    const pathname = url.pathname
    if (pathname === "/ws") {
      if (store.requireMembership) {
        const personToken = url.searchParams.get("token")
        if (!personToken || !store.personTokenValid(personToken)) {
          socket.close(4401, "invalid token")
          return
        }
      }
      web.add(socket)
      socket.once("close", () => web.delete(socket))
      return
    }
    const token = url.searchParams.get("token")
    const agent = token ? store.findAgentByToken(token) : undefined
    if (!agent) {
      socket.close(4401, "invalid token")
      return
    }
    const old = runners.get(agent.id)
    old?.close(1000, "runner replaced")
    runners.set(agent.id, socket)
    setPresence(agent, {
      presence: "online",
      ...(agent.runtime ? { runtime: agent.runtime } : {}),
      ...(agent.model ? { model: agent.model } : {}),
    })
    socket.on("message", (raw) => handleRunnerMessage(socket, agent, raw.toString()))
    socket.once("close", () => {
      if (runners.get(agent.id) !== socket) return
      runners.delete(agent.id)
      setPresence(agent, {
        presence: "away",
        ...(agent.runtime ? { runtime: agent.runtime } : {}),
        ...(agent.model ? { model: agent.model } : {}),
      })
    })
  }

  wss.on("connection", handleConnection)
  const handleUpgrade = (request: IncomingMessage, socket: Socket, head: Buffer): void => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname
    if (pathname !== "/ws" && pathname !== "/ws/runner") {
      // An upgrade unrelated to this server can't be handled here.
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
    onMessageCreated(message, hint) {
      broadcast({ type: "message.created", payload: { message } })
      mention(message, hint)
    },
    onCardPublished(card, message) {
      broadcast({ type: "card.published", payload: { card, message } })
      mention(message)
    },
    onThreadCreated(thread) {
      broadcast({ type: "thread.created", payload: { thread } })
    },
    handleUpgrade,
    close() {
      server.off("upgrade", handleUpgrade)
      const sockets = [...web, ...runners.values()]
      for (const socket of sockets) socket.close(1000, "server shutting down")
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
