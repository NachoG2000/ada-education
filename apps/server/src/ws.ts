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
  typingInputSchema,
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
  /** Authenticated browser viewers are always persons; agents use the runner
      socket and never receive browser broadcasts. */
  viewerForToken?(token: string): Member | undefined
  /** membership gating (DECISIONS.md §20): when true, /ws needs a person token */
  requireMembership: boolean
  personTokenValid(token: string): boolean
  members(): Member[]
  channel(id: string): Channel | undefined
  member(id: string): Member | undefined
  memberKind?(id: string): Member["kind"] | undefined
  module?(id: string): Module | undefined
  message?(id: string): Message | undefined
  canReadChannel?(id: string, viewer: Member): boolean
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
  /** Sends a channel tombstone only to sockets that had access before a
      membership/visibility mutation. The payload contains no private data. */
  revokeChannelAccess(channelId: string, memberIds: string[], deletedBy: string): void
  revokeMemberAccess(memberId: string, viewerIds: string[]): void
  onMessageCreated(message: Message, hint?: MentionHint): void
  onCardPublished(card: Card, message: Message): void
  onThreadCreated(thread: Thread): void
  disconnectRunner(agentId: string, reason?: string): void
  handleUpgrade(request: IncomingMessage, socket: Socket, head: Buffer): void
  close(): Promise<void>
}

function send(socket: WebSocket, value: unknown): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value))
}

export function createWebSocketHub(server: HttpServer, store: WsStore, onPresence?: PresenceChange): WebSocketHub {
  const web = new Set<WebSocket>()
  const viewers = new Map<WebSocket, Member | undefined>()
  const typingBySocket = new Map<WebSocket, Set<string>>()
  const typingExpiry = new Map<string, ReturnType<typeof setTimeout>>()
  const typingLastBroadcast = new Map<string, number>()
  const runners = new Map<string, WebSocket>()
  const presence = new Map<string, { presence: Presence; runtime?: string; model?: string }>()
  const wss = new WebSocketServer({ noServer: true })

  const canRead = (channelId: string, viewer: Member): boolean => {
    if (store.canReadChannel) return store.canReadChannel(channelId, viewer)
    const channel = store.channel(channelId)
    if (!channel || (channel.status !== "active" && channel.status !== "archived")) return false
    if (channel.visibility === "private" || channel.group === "private") return channel.memberIds.includes(viewer.id)
    return viewer.kind === "person"
  }

  const memberVisible = (memberId: string, viewer: Member): boolean => {
    const member = store.member(memberId)
    if (!member || member.kind === "person") return Boolean(member)
    return member.channelIds.some((channelId) => canRead(channelId, viewer))
  }

  const eventChannelId = (event: ServerEvent): string | undefined => {
    switch (event.type) {
      case "channel.created":
      case "channel.updated":
        return event.payload.channel.id
      case "channel.deleted":
      case "channel.read":
      case "typing.updated":
        return event.payload.channelId
      case "message.created":
      case "message.updated":
      case "message.deleted":
        return event.payload.message.channelId
      case "card.published":
        return event.payload.message.channelId
      case "module.updated":
        return event.payload.module.channelId
      case "thread.created": {
        const rootId = store.threadRootMessageId(event.payload.thread.id)
        return rootId ? store.message?.(rootId)?.channelId : undefined
      }
      case "message.reactions.updated":
        return store.message?.(event.payload.messageId)?.channelId
      case "report.updated": {
        const module = store.module?.(event.payload.report.moduleId)
        return module?.channelId
      }
      default:
        return undefined
    }
  }

  const eventVisible = (event: ServerEvent, viewer: Member | undefined): boolean => {
    // Ungated local development deliberately retains the legacy full event
    // stream. Gated browser sockets always carry a person viewer.
    if (!viewer) return true
    if (event.type === "channel.read" && event.payload.memberId !== viewer.id) return false
    const channelId = eventChannelId(event)
    if (channelId) return canRead(channelId, viewer)
    switch (event.type) {
      case "member.presence":
        return memberVisible(event.payload.memberId, viewer)
      case "member.joined":
      case "member.updated":
        return memberVisible(event.payload.member.id, viewer)
      case "member.deleted":
        // Person removal is course-global. Agent removal fails closed because
        // its old private assignments are no longer queryable after delete.
        return store.memberKind?.(event.payload.memberId) === "person"
      case "community.updated":
        return true
      default:
        // A child event without a resolvable channel must not become a side
        // channel for private data.
        return false
    }
  }

  const eventForViewer = (event: ServerEvent, viewer: Member | undefined): ServerEvent => {
    if (!viewer || (event.type !== "member.joined" && event.type !== "member.updated") || event.payload.member.kind !== "agent") {
      return event
    }
    const member = event.payload.member
    return {
      ...event,
      payload: {
        member: {
          ...member,
          channelIds: member.channelIds.filter((channelId) => canRead(channelId, viewer)),
        },
      },
    }
  }

  const broadcast = (event: ServerEvent): void => {
    for (const client of web) {
      const viewer = viewers.get(client)
      if (eventVisible(event, viewer)) send(client, eventForViewer(event, viewer))
    }
  }

  const revokeChannelAccess = (channelId: string, memberIds: string[], deletedBy: string): void => {
    if (memberIds.length === 0) return
    const recipients = new Set(memberIds)
    const event: ServerEvent = {
      type: "channel.deleted",
      payload: { channelId, deletedAt: new Date().toISOString(), deletedBy },
    }
    for (const client of web) {
      const viewer = viewers.get(client)
      if (viewer?.kind === "person" && recipients.has(viewer.id)) send(client, event)
    }
  }

  const revokeMemberAccess = (memberId: string, viewerIds: string[]): void => {
    const recipients = new Set(viewerIds)
    const event: ServerEvent = { type: "member.deleted", payload: { memberId } }
    for (const client of web) {
      const viewer = viewers.get(client)
      if (viewer?.kind === "person" && recipients.has(viewer.id)) send(client, event)
    }
  }

  const typingKey = (memberId: string, channelId: string): string => `${memberId}\u0000${channelId}`

  const publishTyping = (viewer: Member, channelId: string, typing: boolean): void => {
    const key = typingKey(viewer.id, channelId)
    const existing = typingExpiry.get(key)
    if (existing) clearTimeout(existing)
    typingExpiry.delete(key)
    if (typing) {
      const elapsed = Date.now() - (typingLastBroadcast.get(key) ?? 0)
      if (elapsed >= 250) {
        typingLastBroadcast.set(key, Date.now())
        broadcast({ type: "typing.updated", payload: { channelId, memberId: viewer.id, typing: true } })
      }
      typingExpiry.set(key, setTimeout(() => {
        typingExpiry.delete(key)
        typingLastBroadcast.delete(key)
        broadcast({ type: "typing.updated", payload: { channelId, memberId: viewer.id, typing: false } })
      }, 4_000))
      return
    }
    typingLastBroadcast.delete(key)
    broadcast({ type: "typing.updated", payload: { channelId, memberId: viewer.id, typing: false } })
  }

  const stopSocketTyping = (socket: WebSocket, viewer: Member | undefined): void => {
    if (!viewer) return
    for (const channelId of typingBySocket.get(socket) ?? []) publishTyping(viewer, channelId, false)
    typingBySocket.delete(socket)
  }

  const handleBrowserMessage = (socket: WebSocket, viewer: Member, raw: string): void => {
    let candidate: unknown
    try {
      candidate = JSON.parse(raw)
    } catch {
      return
    }
    if (!isRecord(candidate) || candidate.type !== "typing.set") return
    const parsed = typingInputSchema.safeParse(candidate.payload)
    if (!parsed.success) return
    const { channelId, typing } = parsed.data
    const channel = store.channel(channelId)
    if (!channel || channel.status === "archived" || !canRead(channelId, viewer) || !channel.memberIds.includes(viewer.id)) return
    const activeChannels = typingBySocket.get(socket) ?? new Set<string>()
    if (typing) activeChannels.add(channelId)
    else activeChannels.delete(channelId)
    typingBySocket.set(socket, activeChannels)
    publishTyping(viewer, channelId, typing)
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
      const viewer = store.requireMembership
        ? store.viewerForToken?.(url.searchParams.get("token") ?? "")
        : (url.searchParams.get("memberId") ? store.member(url.searchParams.get("memberId") ?? "") : undefined)
      if (store.requireMembership && (!viewer || viewer.kind !== "person")) {
        web.delete(socket)
        socket.close(4401, "invalid token")
        return
      }
      viewers.set(socket, viewer)
      if (viewer?.kind === "person") socket.on("message", (raw) => handleBrowserMessage(socket, viewer, raw.toString()))
      socket.once("close", () => {
        stopSocketTyping(socket, viewer)
        web.delete(socket)
        viewers.delete(socket)
      })
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
    revokeChannelAccess,
    revokeMemberAccess,
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
    disconnectRunner(agentId, reason = "runner access revoked") {
      runners.get(agentId)?.close(4403, reason)
    },
    handleUpgrade,
    close() {
      server.off("upgrade", handleUpgrade)
      const sockets = [...web, ...runners.values()]
      for (const socket of sockets) socket.close(1000, "server shutting down")
      web.clear()
      viewers.clear()
      runners.clear()
      for (const timer of typingExpiry.values()) clearTimeout(timer)
      typingExpiry.clear()
      typingLastBroadcast.clear()
      typingBySocket.clear()
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
