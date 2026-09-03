import { randomUUID } from "node:crypto"
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
import {
  browserAuthFrameSchema,
  runnerAuthFrameSchema,
  runnerCardPublishSchema,
  runnerMessageCreateSchema,
  runnerPresenceSchema,
  runnerWorkSchema,
  scopedServerEventSchema,
  type CommunityAgent,
  type CommunityMember,
} from "@ada/protocol"
import { WebSocket, WebSocketServer } from "ws"
import { mentionContext, mentionedAgentIds } from "./mentions.js"
import type { TenantAgent, TenantMessage } from "./tenant.js"

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
  /** Hosted issue #1 boundary. Legacy methods above stay for card-flow
      compatibility; these methods are all explicitly community-scoped. */
  hosted?: {
    userByToken(token: string): { id: string; displayName: string; createdAt: string; updatedAt: string } | undefined
    userInCommunity(userId: string, communityId: string): boolean
    canReadChannel(userId: string, communityId: string, channelId: string): boolean
    communityUser(userId: string, communityId: string): CommunityMember | undefined
    agentByToken(token: string): TenantAgent | undefined
    agent(agentId: string, communityId: string): TenantAgent | undefined
    agentMessage(input: { communityId: string; agentId: string; channelId: string; threadId?: string; paragraphs: Message["paragraphs"] }): TenantMessage
    setPresence?(agentId: string, presence: "online" | "offline" | "thinking" | "publishing"): void
    contextForMessage?(message: TenantMessage, agentId: string): TenantMessage[]
    publishCard(input: { communityId: string; agentId: string; channelId: string; path: string; title: string; type: string; body: string; sourceMessageIds: string[]; replacesCardId?: string }): { cardId: string; channelId: string; messageId?: string }
    messageCreated?(message: TenantMessage): void
    workAgentsForMessage?(message: TenantMessage): TenantAgent[]
  }
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
  broadcastHosted(event: unknown): void
  dispatchHostedWork(message: TenantMessage): void
  revokeHostedUser(userId: string, communityId: string): void
  disconnectHostedRunner(agentId: string, reason?: string): void
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
  const hostedViewers = new Map<WebSocket, { userId: string; communityId: string }>()
  const hostedRunners = new Map<string, WebSocket>()
  const hostedRunnerCounts = new Map<string, number>()
  const hostedPresence = new Map<string, { presence: "online" | "offline" | "thinking" | "publishing"; runtime: "claude" | "codex"; model?: string; communityId: string }>()
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

  const hostedEvent = (communityId: string, type: string, payload: unknown): Record<string, unknown> => ({
    communityId,
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    type,
    payload,
  })

  const broadcastHosted = (event: unknown): void => {
    if (!isRecord(event) || typeof event.communityId !== "string") return
    const envelope = typeof event.eventId === "string" && typeof event.occurredAt === "string"
      ? event
      : hostedEvent(event.communityId, typeof event.type === "string" ? event.type : "", event.payload)
    const validated = scopedServerEventSchema.safeParse(envelope)
    if (!validated.success) {
      console.error("Refusing invalid hosted event", validated.error.flatten())
      return
    }
    const validatedEvent = validated.data
    const communityId = validatedEvent.communityId
    const payload: Record<string, unknown> | undefined = isRecord(validatedEvent.payload)
      ? validatedEvent.payload as Record<string, unknown>
      : undefined
    const scopedChannel = payload && isRecord(payload.channel) && typeof payload.channel.id === "string"
      ? payload.channel.id
      : payload && isRecord(payload.message) && typeof payload.message.channelId === "string"
        ? payload.message.channelId
        : payload && isRecord(payload.thread) && typeof payload.thread.channelId === "string"
          ? payload.thread.channelId
        : payload && typeof payload.channelId === "string" ? payload.channelId : undefined
    for (const [socket, viewer] of hostedViewers) {
      if (viewer.communityId !== communityId) continue
      if (scopedChannel && store.hosted && !store.hosted.canReadChannel(viewer.userId, communityId, scopedChannel)) continue
      const agent: Record<string, unknown> | undefined = payload && isRecord(payload.agent)
        ? payload.agent as Record<string, unknown>
        : undefined
      const viewerEvent = agent && Array.isArray(agent.channelIds) && store.hosted
        ? {
            ...validatedEvent,
            payload: {
              ...payload,
              agent: {
                ...agent,
                channelIds: agent.channelIds.filter((channelId: unknown): channelId is string =>
                  typeof channelId === "string" && store.hosted!.canReadChannel(viewer.userId, communityId, channelId)),
              },
            },
          }
        : validatedEvent
      send(socket, { type: "event", payload: { event: viewerEvent } })
    }
  }

  const setHostedPresence = (agent: TenantAgent, state: { presence: "online" | "offline" | "thinking" | "publishing"; runtime?: "claude" | "codex"; model?: string }): void => {
    const runtime = state.runtime ?? agent.runtime
    const next = { communityId: agent.communityId, presence: state.presence, runtime, ...(state.model ?? agent.model ? { model: state.model ?? agent.model } : {}) }
    hostedPresence.set(agent.id, next)
    store.hosted?.setPresence?.(agent.id, next.presence)
    broadcastHosted(hostedEvent(agent.communityId, "runner.presence", { agentId: agent.id, presence: next.presence, runtime: next.runtime, ...(next.model ? { model: next.model } : {}) }))
  }

  const hostedRunnerWork = (message: TenantMessage): void => {
    const agents = store.hosted?.workAgentsForMessage?.(message) ?? []
    for (const agent of agents) {
      const socket = hostedRunners.get(agent.id)
      if (!socket) continue
      const from = store.hosted?.communityUser?.(message.authorId, message.communityId)
      if (!from) continue
      const work = {
        type: "work",
        payload: {
          workId: `work-${message.id}`,
          communityId: message.communityId,
          agentId: agent.id,
          channelId: message.channelId,
          ...(message.threadId ? { threadId: message.threadId } : {}),
          message: messageToHosted(message),
          from,
          context: (store.hosted?.contextForMessage?.(message, agent.id) ?? []).map(messageToHosted),
        },
      }
      const validWork = runnerWorkSchema.safeParse(work)
      if (!validWork.success) {
        console.error("Refusing invalid hosted runner work", validWork.error.flatten())
        continue
      }
      send(socket, work)
      setHostedPresence(agent, { presence: "thinking" })
    }
  }

  const handleHostedRunnerMessage = (socket: WebSocket, agent: TenantAgent, raw: string): void => {
    let candidate: unknown
    try { candidate = JSON.parse(raw) } catch { return }
    if (!isRecord(candidate) || candidate.type === "auth") return
    const reject = (error: string): void => {
      if (typeof candidate.ref === "string") send(socket, { type: "ack", ref: candidate.ref, ok: false, error })
    }
    if (candidate.type === "presence") {
      const parsed = runnerPresenceSchema.safeParse(candidate)
      if (!parsed.success) return
      const payload = parsed.data.payload
      if (payload.runtime !== agent.runtime || (payload.model && payload.model !== agent.model)) return
      setHostedPresence(agent, payload)
      return
    }
    if (candidate.type === "message.create") {
      const parsed = runnerMessageCreateSchema.safeParse(candidate)
      if (!parsed.success) { reject("invalid message.create frame"); return }
      const payload = parsed.data.payload
      if (payload.communityId !== agent.communityId || payload.agentId !== agent.id) { reject("runner identity does not match message scope"); return }
      try {
        const message = store.hosted?.agentMessage({ communityId: agent.communityId, agentId: agent.id, channelId: payload.channelId, threadId: payload.threadId, paragraphs: payload.paragraphs as Message["paragraphs"] })
        if (!message) { reject("hosted message store is unavailable"); return }
        send(socket, { type: "ack", ref: parsed.data.ref, ok: true, messageId: message.id })
        broadcastHosted(hostedEvent(agent.communityId, "message.created", { message: messageToHosted(message) }))
        store.hosted?.messageCreated?.(message)
        setHostedPresence(agent, { presence: "publishing" })
      } catch (error) {
        send(socket, { type: "ack", ref: parsed.data.ref, ok: false, error: error instanceof Error ? error.message : "message rejected" })
      }
      return
    }
    if (candidate.type === "card.publish") {
      const parsed = runnerCardPublishSchema.safeParse(candidate)
      if (!parsed.success) { reject("invalid card.publish frame"); return }
      const payload = parsed.data.payload
      if (payload.communityId !== agent.communityId || payload.agentId !== agent.id) { reject("runner identity does not match card scope"); return }
      try {
        const published = store.hosted?.publishCard({ ...payload })
        if (!published) { reject("hosted card store is unavailable"); return }
        send(socket, { type: "ack", ref: parsed.data.ref, ok: true, cardId: published.cardId })
        broadcastHosted(hostedEvent(agent.communityId, "card.published", published))
        setHostedPresence(agent, { presence: "publishing" })
      } catch (error) {
        send(socket, { type: "ack", ref: parsed.data.ref, ok: false, error: error instanceof Error ? error.message : "card rejected" })
      }
    }
  }

  const handleHostedBrowserConnection = (socket: WebSocket): void => {
    let authenticated = false
    const timer = setTimeout(() => { if (!authenticated) socket.close(4401, "authentication required") }, 5_000)
    const first = (raw: Buffer): void => {
      if (authenticated) return
      let candidate: unknown
      try { candidate = JSON.parse(raw.toString()) } catch { socket.close(4401, "invalid auth frame"); return }
      const parsed = browserAuthFrameSchema.safeParse(candidate)
      if (!parsed.success || !store.hosted) { socket.close(4401, "invalid auth frame"); return }
      const user = store.hosted.userByToken(parsed.data.token)
      if (!user || !store.hosted.userInCommunity(user.id, parsed.data.communityId)) { socket.close(4403, "community access denied"); return }
      authenticated = true
      clearTimeout(timer)
      hostedViewers.set(socket, { userId: user.id, communityId: parsed.data.communityId })
      socket.off("message", first)
      send(socket, { type: "ready", payload: { user, communityId: parsed.data.communityId } })
      socket.on("message", () => undefined)
    }
    socket.on("message", first)
    socket.once("close", () => {
      clearTimeout(timer)
      hostedViewers.delete(socket)
    })
  }

  const handleHostedRunnerConnection = (socket: WebSocket): void => {
    let agent: TenantAgent | undefined
    let authenticated = false
    const timer = setTimeout(() => { if (!authenticated) socket.close(4401, "authentication required") }, 5_000)
    const first = (raw: Buffer): void => {
      if (authenticated) return
      let candidate: unknown
      try { candidate = JSON.parse(raw.toString()) } catch { socket.close(4401, "invalid auth frame"); return }
      const parsed = runnerAuthFrameSchema.safeParse(candidate)
      if (!parsed.success || !store.hosted) { socket.close(4401, "invalid auth frame"); return }
      agent = store.hosted.agentByToken(parsed.data.token)
      if (!agent || agent.status === "deleted") { socket.close(4403, "agent access denied"); return }
      authenticated = true
      clearTimeout(timer)
      const old = hostedRunners.get(agent.id)
      old?.close(1000, "runner replaced")
      hostedRunners.set(agent.id, socket)
      // There is one authoritative runner socket per agent. Replacing it must
      // not leave a phantom reference that keeps presence online forever.
      hostedRunnerCounts.set(agent.id, 1)
      socket.off("message", first)
      const readyAgent: Omit<CommunityAgent, "presence"> = {
        id: agent.id,
        communityId: agent.communityId,
        name: agent.name,
        ...(agent.avatarUrl ? { avatarUrl: agent.avatarUrl } : {}),
        instructions: agent.instructions,
        runtime: agent.runtime,
        model: agent.model || "default",
        channelIds: agent.channelIds,
        createdBy: agent.createdBy,
        createdAt: agent.createdAt,
        ...(agent.updatedAt ? { updatedAt: agent.updatedAt } : {}),
        status: "active",
      }
      send(socket, { type: "ready", payload: { agent: readyAgent } })
      setHostedPresence(agent, { presence: "online" })
      socket.on("message", (frame) => handleHostedRunnerMessage(socket, agent as TenantAgent, frame.toString()))
    }
    socket.on("message", first)
    socket.once("close", () => {
      clearTimeout(timer)
      if (!agent || hostedRunners.get(agent.id) !== socket) return
      hostedRunners.delete(agent.id)
      const count = Math.max(0, (hostedRunnerCounts.get(agent.id) ?? 1) - 1)
      if (count === 0) {
        hostedRunnerCounts.delete(agent.id)
        setHostedPresence(agent, { presence: "offline" })
      } else hostedRunnerCounts.set(agent.id, count)
    })
  }

  const handleConnection = (socket: WebSocket, request: IncomingMessage): void => {
    const url = new URL(request.url ?? "/", "http://localhost")
    const pathname = url.pathname
    const queryToken = url.searchParams.get("token")
    const legacyIdentity = queryToken && (store.viewerForToken?.(queryToken) || store.findAgentByToken(queryToken))
    if (store.hosted && queryToken && !legacyIdentity && (store.hosted.userByToken(queryToken) || store.hosted.agentByToken(queryToken))) {
      // Hosted credentials are accepted only in the first JSON auth frame;
      // accepting them in a URL would leak bearer material to access logs.
      socket.close(4401, "hosted credentials require first-frame authentication")
      return
    }
    if (pathname === "/ws") {
      if (!url.searchParams.has("token") && store.hosted) {
        handleHostedBrowserConnection(socket)
        return
      }
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
    if (pathname === "/ws/runner" && !url.searchParams.has("token") && store.hosted) {
      handleHostedRunnerConnection(socket)
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
    broadcastHosted,
    dispatchHostedWork: hostedRunnerWork,
    revokeHostedUser(userId, communityId) {
      for (const [socket, viewer] of hostedViewers) {
        if (viewer.userId === userId && viewer.communityId === communityId) socket.close(4403, "community membership ended")
      }
    },
    disconnectHostedRunner(agentId, reason = "runner access revoked") {
      hostedRunners.get(agentId)?.close(4403, reason)
    },
    disconnectRunner(agentId, reason = "runner access revoked") {
      runners.get(agentId)?.close(4403, reason)
    },
    handleUpgrade,
    close() {
      server.off("upgrade", handleUpgrade)
      const sockets = [...web, ...runners.values(), ...hostedViewers.keys(), ...hostedRunners.values()]
      for (const socket of sockets) socket.close(1000, "server shutting down")
      web.clear()
      viewers.clear()
      for (const socket of hostedViewers.keys()) socket.close(1000, "server shutting down")
      for (const socket of hostedRunners.values()) socket.close(1000, "server shutting down")
      hostedViewers.clear()
      hostedRunners.clear()
      hostedRunnerCounts.clear()
      hostedPresence.clear()
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

function messageToHosted(message: TenantMessage): Record<string, unknown> {
  return {
    id: message.id,
    communityId: message.communityId,
    channelId: message.channelId,
    authorId: message.authorId,
    at: message.at,
    paragraphs: message.paragraphs,
    ...(message.threadId ? { threadId: message.threadId } : {}),
    ...(message.clientId ? { clientId: message.clientId } : {}),
    ...(message.editedAt ? { editedAt: message.editedAt } : {}),
    ...(message.deletedAt ? { deletedAt: message.deletedAt, ...(message.deletedBy ? { deletedBy: message.deletedBy } : {}) } : {}),
  }
}
