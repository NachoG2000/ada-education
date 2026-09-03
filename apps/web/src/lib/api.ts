/* Client for connected mode: REST + WS against apps/server.

   Rule for this file: nothing that comes in over the network is allowed to
   crash the screen. The provider's lookups throw on a dangling id, so every
   reference is checked HERE, before it touches the state — both in the
   snapshot that hydrates the app and in each event. What can be degraded is
   degraded (a message that points at a card we don't have loses its seal and
   keeps its text); only what can't be drawn at all is dropped. Always with a
   console.warn, because it means the server sent something inconsistent. */

import { serverEventSchema } from "@ada/protocol"
import type {
  Agent,
  AgentCreateResult,
  AgentTokenRotationResult,
  ApiErrorCode,
  Attachment,
  Channel,
  CommunityUpdateRequest,
  Community,
  CreateAgentRequest,
  CreateChannelRequest,
  DifficultyLevel,
  EditMessageRequest,
  Material,
  Member,
  Message,
  MessageBlock,
  MessageCreateRequest,
  MessageReaction,
  MessageReactionRequest,
  Module,
  ProfileUpdateRequest,
  ReadMarkerRequest,
  Report,
  ReplaceChannelMembersRequest,
  ServerEvent as ProtocolServerEvent,
  Thread,
  UpdateAgentRequest,
  UpdateChannelRequest,
  CommunitySnapshot as ProtocolCommunitySnapshot,
} from "@ada/protocol"
import { authHeaders, readStoredToken } from "./auth"

/* ---- Shared protocol types ----------------------------------------- */

/** The community as the server serves it: without `meId` (each client decides that). */
export type CommunitySnapshot = ProtocolCommunitySnapshot
export type CommunityInfoResponse = Pick<Community, "id" | "name" | "subtitle" | "initial" | "updatedAt">

/** Events server → web client over `/ws` (goal-2-api.md §1 "In scope"). */
export type ServerEvent = ProtocolServerEvent

/** What an agent's runner reports (arrives in `member.presence`). */
export interface RunnerInfo {
  runtime?: string
  model?: string
}

/** What the client sends when writing (the provider adds `authorId`). */
export interface MessageInput {
  channelId: string
  threadId?: string
  paragraphs: MessageBlock[][]
  clientId?: string
  attachmentIds?: string[]
}

/* ---- Configuration ------------------------------------------------------ */

/** Server URL if the app is running connected; `undefined` = demo mode.
    An absolute URL talks to the server directly (it needs CORS there); a
    relative path such as `/` resolves against this page's origin, so the Vite
    proxy in vite.config.ts forwards /api and /ws without any CORS. */
export function configuredServer(): string | undefined {
  const v: unknown = import.meta.env.VITE_ADA_SERVER
  if (typeof v !== "string" || v.trim() === "") return undefined
  const trimmed = v.trim().replace(/\/+$/, "")
  if (/^https?:\/\//.test(trimmed)) return trimmed
  return `${location.origin}${trimmed.startsWith("/") || trimmed === "" ? trimmed : `/${trimmed}`}`
}

/* ---- REST ---------------------------------------------------------------- */

const unreachable = (server: string) =>
  `Couldn't reach the server at ${server}. Is it running? Try \`npm run dev:server\`.`

/** 401 from a gated course: not an outage — the person has to join or claim. */
export class UnauthorizedError extends Error {}

/** A structured REST failure. The server's stable code is kept for callers
    that need to distinguish authorization, membership, archive and conflict
    failures without parsing human-facing text. */
export class ApiRequestError extends Error {
  readonly status: number
  readonly code?: ApiErrorCode
  readonly field?: string

  constructor(message: string, status: number, code?: ApiErrorCode, field?: string) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
    this.code = code
    this.field = field
  }
}

function jsonHeaders(): Record<string, string> {
  return { "content-type": "application/json", ...authHeaders() }
}

async function requestJson<T>(
  server: string,
  path: string,
  init: RequestInit,
  fallback: string,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${server}${path}`, init)
  } catch {
    throw new Error(unreachable(server))
  }
  if (!res.ok) await throwForStatus(res, fallback)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** GET /api/community → full snapshot to hydrate the provider. */
export async function fetchCommunity(server: string, viewerId?: string): Promise<CommunitySnapshot> {
  let res: Response
  try {
    // Short timeout: an error screen with retry beats an endless spinner.
    const query = viewerId ? `?${new URLSearchParams({ authorId: viewerId })}` : ""
    res = await fetch(`${server}/api/community${query}`, { signal: AbortSignal.timeout(8000), headers: authHeaders() })
  } catch {
    throw new Error(unreachable(server))
  }
  // Behind the Vite proxy a server that isn't running answers 502/503/504, not a network error.
  if (res.status >= 502 && res.status <= 504) throw new Error(unreachable(server))
  if (res.status === 401) throw new UnauthorizedError("This course requires membership.")
  if (!res.ok) throw new Error(`The server responded ${res.status} when asking for the community.`)
  const data = (await res.json()) as CommunitySnapshot
  if (!data || !Array.isArray(data.members) || !Array.isArray(data.channels) || !Array.isArray(data.messages) || !Array.isArray(data.cards) || !Array.isArray(data.threads)) {
    throw new Error("The server returned a community with a shape I don't recognize.")
  }
  return sanitizeSnapshot(data)
}

/** PATCH /api/community — updates the public community profile. */
export async function updateCommunity(server: string, input: CommunityUpdateRequest, actorId?: string): Promise<CommunityInfoResponse> {
  return requestJson<CommunityInfoResponse>(server, "/api/community", {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify({ ...input, ...(actorId ? { authorId: actorId } : {}) }),
  }, "The server rejected the community change.")
}

/** PATCH /api/members/:id — updates a person's profile. */
export async function updateProfile(server: string, memberId: string, input: ProfileUpdateRequest, actorId?: string): Promise<Member> {
  return requestJson<Member>(server, `/api/members/${encodeURIComponent(memberId)}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify({ ...input, ...(actorId ? { authorId: actorId } : {}) }),
  }, "The server rejected the profile change.")
}

/** Channel CRUD and membership methods from the Buzz-parity REST contract. */
export async function fetchChannels(server: string): Promise<Channel[]> {
  return requestJson<Channel[]>(server, "/api/channels", { headers: authHeaders() }, "The server rejected the channel list request.")
}

export async function fetchChannel(server: string, channelId: string): Promise<Channel> {
  return requestJson<Channel>(server, `/api/channels/${encodeURIComponent(channelId)}`, { headers: authHeaders() }, "The server rejected the channel request.")
}

export async function createChannel(server: string, input: CreateChannelRequest, actorId?: string): Promise<Channel> {
  return requestJson<Channel>(server, "/api/channels", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ ...input, ...(actorId ? { authorId: actorId } : {}) }),
  }, "The server rejected the channel creation.")
}

export async function updateChannel(server: string, channelId: string, input: UpdateChannelRequest, actorId?: string): Promise<Channel> {
  return requestJson<Channel>(server, `/api/channels/${encodeURIComponent(channelId)}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify({ ...input, ...(actorId ? { authorId: actorId } : {}) }),
  }, "The server rejected the channel change.")
}

export async function replaceChannelMembers(server: string, channelId: string, input: ReplaceChannelMembersRequest, actorId?: string): Promise<Channel> {
  return requestJson<Channel>(server, `/api/channels/${encodeURIComponent(channelId)}/members`, {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify({ ...input, ...(actorId ? { authorId: actorId } : {}) }),
  }, "The server rejected the channel membership change.")
}

export async function joinChannel(server: string, channelId: string, actorId?: string): Promise<Channel> {
  return requestJson<Channel>(server, `/api/channels/${encodeURIComponent(channelId)}/join`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(actorId ? { authorId: actorId } : {}),
  }, "The server rejected joining the channel.")
}

export async function leaveChannel(server: string, channelId: string, actorId?: string): Promise<Channel> {
  return requestJson<Channel>(server, `/api/channels/${encodeURIComponent(channelId)}/leave`, {
    method: "DELETE",
    headers: jsonHeaders(),
    body: JSON.stringify(actorId ? { authorId: actorId } : {}),
  }, "The server rejected leaving the channel.")
}

export async function deleteChannel(server: string, channelId: string, actorId?: string): Promise<void> {
  await requestJson<unknown>(server, `/api/channels/${encodeURIComponent(channelId)}`, {
    method: "DELETE",
    headers: jsonHeaders(),
    body: JSON.stringify(actorId ? { authorId: actorId } : {}),
  }, "The server rejected deleting the channel.")
}

/** Agent CRUD and one-time credential rotation. The enrollment token is only
    returned by the create/rotate response and is never part of Agent. */
export async function fetchAgents(server: string): Promise<Agent[]> {
  return requestJson<Agent[]>(server, "/api/agents", { headers: authHeaders() }, "The server rejected the agent list request.")
}

export async function fetchAgent(server: string, agentId: string): Promise<Agent> {
  return requestJson<Agent>(server, `/api/agents/${encodeURIComponent(agentId)}`, { headers: authHeaders() }, "The server rejected the agent request.")
}

export async function createAgent(server: string, input: CreateAgentRequest, actorId?: string): Promise<AgentCreateResult> {
  return requestJson<AgentCreateResult>(server, "/api/agents", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ ...input, ...(actorId ? { authorId: actorId } : {}) }),
  }, "The server rejected the agent creation.")
}

export async function updateAgent(server: string, agentId: string, input: UpdateAgentRequest, actorId?: string): Promise<Agent> {
  return requestJson<Agent>(server, `/api/agents/${encodeURIComponent(agentId)}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify({ ...input, ...(actorId ? { authorId: actorId } : {}) }),
  }, "The server rejected the agent change.")
}

export async function rotateAgentToken(server: string, agentId: string, actorId?: string): Promise<AgentTokenRotationResult> {
  return requestJson<AgentTokenRotationResult>(server, `/api/agents/${encodeURIComponent(agentId)}/rotate-token`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(actorId ? { authorId: actorId } : {}),
  }, "The server rejected the agent token rotation.")
}

export async function deleteAgent(server: string, agentId: string, actorId?: string): Promise<void> {
  await requestJson<unknown>(server, `/api/agents/${encodeURIComponent(agentId)}`, {
    method: "DELETE",
    headers: jsonHeaders(),
    body: JSON.stringify(actorId ? { authorId: actorId } : {}),
  }, "The server rejected deleting the agent.")
}

/** POST /api/channels/:id/messages — the message appears once it comes back
    over WS as `message.created`; nothing is added to the state here (no
    local optimism). */
export async function postMessage(
  server: string,
  input: MessageInput & { authorId: string },
): Promise<void> {
  const { channelId, ...body } = input
  let res: Response
  try {
    res = await fetch(`${server}/api/channels/${encodeURIComponent(channelId)}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error("Couldn't send the message: the server isn't responding.")
  }
  if (!res.ok) throw new Error(`The server rejected the message (${res.status}).`)
}

/** POST /api/channels/:id/messages — protocol-shaped variant for callers that
    rely on bearer-token authorship and the server's returned canonical row. */
export async function createMessage(server: string, channelId: string, input: MessageCreateRequest, actorId?: string): Promise<Message> {
  return requestJson<Message>(server, `/api/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ ...input, ...(actorId ? { authorId: actorId } : {}) }),
  }, "The server rejected the message.")
}

export async function editMessage(server: string, messageId: string, input: EditMessageRequest, actorId?: string): Promise<Message> {
  return requestJson<Message>(server, `/api/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify({ ...input, ...(actorId ? { authorId: actorId } : {}) }),
  }, "The server rejected the message edit.")
}

export async function deleteMessage(server: string, messageId: string, actorId?: string): Promise<Message> {
  return requestJson<Message>(server, `/api/messages/${encodeURIComponent(messageId)}`, {
    method: "DELETE",
    headers: jsonHeaders(),
    body: JSON.stringify(actorId ? { authorId: actorId } : {}),
  }, "The server rejected deleting the message.")
}

export async function addReaction(server: string, messageId: string, input: MessageReactionRequest, actorId?: string): Promise<MessageReaction[]> {
  return requestJson<MessageReaction[]>(server, `/api/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(input.emoji)}`, {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify({ ...input, ...(actorId ? { authorId: actorId } : {}) }),
  }, "The server rejected the reaction.")
}

export async function removeReaction(server: string, messageId: string, emoji: string, actorId?: string): Promise<MessageReaction[]> {
  return requestJson<MessageReaction[]>(server, `/api/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(emoji)}`, {
    method: "DELETE",
    headers: jsonHeaders(),
    body: JSON.stringify(actorId ? { authorId: actorId } : {}),
  }, "The server rejected removing the reaction.")
}

export async function markChannelRead(server: string, channelId: string, input: ReadMarkerRequest, actorId?: string): Promise<void> {
  await requestJson<unknown>(server, `/api/channels/${encodeURIComponent(channelId)}/read`, {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify({ ...input, ...(actorId ? { authorId: actorId } : {}) }),
  }, "The server rejected the read marker.")
}

/** POST /api/channels/:id/attachments. FormData owns the multipart boundary;
    setting content-type manually would make uploads fail in browsers. */
export async function uploadAttachment(
  server: string,
  channelId: string,
  file: Blob,
  name?: string,
  actorId?: string,
): Promise<Attachment> {
  const form = new FormData()
  const fileName = name ?? ("name" in file && typeof file.name === "string" ? file.name : "attachment")
  form.append("file", file, fileName)
  if (actorId) form.append("authorId", actorId)
  return requestJson<Attachment>(server, `/api/channels/${encodeURIComponent(channelId)}/attachments`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  }, "The server rejected the attachment upload.")
}

export async function deleteAttachment(server: string, attachmentId: string, actorId?: string): Promise<Attachment> {
  return requestJson<Attachment>(server, `/api/attachments/${encodeURIComponent(attachmentId)}`, {
    method: "DELETE",
    headers: jsonHeaders(),
    body: JSON.stringify(actorId ? { authorId: actorId } : {}),
  }, "The server rejected deleting the attachment.")
}

/** URL for an authenticated fetch/download of an attachment. */
export function attachmentDownloadUrl(server: string, attachmentId: string): string {
  return `${server}/api/attachments/${encodeURIComponent(attachmentId)}`
}

export async function downloadAttachment(server: string, attachmentId: string, viewerId?: string): Promise<Blob> {
  let response: Response
  try {
    const query = viewerId ? `?${new URLSearchParams({ authorId: viewerId })}` : ""
    response = await fetch(`${attachmentDownloadUrl(server, attachmentId)}${query}`, { headers: authHeaders() })
  } catch {
    throw new Error(unreachable(server))
  }
  if (!response.ok) await throwForStatus(response, "The attachment could not be downloaded.")
  return response.blob()
}

/** Friendly aliases used by callers that name the operation after the route. */
export const addMessageReaction = addReaction
export const removeMessageReaction = removeReaction
export const downloadAttachmentUrl = attachmentDownloadUrl

/** POST /api/threads — opens a thread on a message, or returns the one that
    message already has (the server dedupes by root). The thread also arrives
    over WS as `thread.created`; applying it twice is a no-op, so the caller can
    fold this one into the state right away instead of waiting for the event. */
export async function createThread(server: string, rootMessageId: string): Promise<Thread> {
  let res: Response
  try {
    res = await fetch(`${server}/api/threads`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ rootMessageId }),
    })
  } catch {
    throw new Error("Couldn't open the thread: the server isn't responding.")
  }
  if (!res.ok) throw new Error(`The server rejected the thread (${res.status}).`)
  const thread = (await res.json()) as Thread
  if (!thread || typeof thread.id !== "string" || !Array.isArray(thread.replyIds)) {
    throw new Error("The server returned a thread with a shape I don't recognize.")
  }
  return thread
}

/** Reads `{error}` off a non-2xx JSON body, falling back to a generic message
    when the body isn't there or isn't JSON. */
async function throwForStatus(res: Response, fallback: string): Promise<never> {
  let message = fallback
  let code: ApiErrorCode | undefined
  let field: string | undefined
  try {
    const body = (await res.json()) as { error?: unknown; code?: unknown; field?: unknown }
    if (typeof body.error === "string" && body.error) message = body.error
    if (typeof body.code === "string" && body.code) {
      const knownCodes: ApiErrorCode[] = ["invalid_input", "unauthorized", "forbidden", "not_found", "not_channel_member", "channel_archived", "conflict", "history_conflict"]
      if (knownCodes.includes(body.code as ApiErrorCode)) code = body.code as ApiErrorCode
    }
    if (typeof body.field === "string" && body.field) field = body.field
  } catch {
    // no JSON body: stick with the fallback
  }
  throw new ApiRequestError(message, res.status, code, field)
}

/** POST /api/modules/:id/materials — uploads one material to a module; the
    module comes back `compiling` and the ingest mention is on its way (the
    resulting `module.updated` and the mention's answer arrive over WS). */
export async function uploadMaterial(
  server: string,
  moduleId: string,
  input: { name: string; kind: Material["kind"]; size?: number; text?: string; authorId: string },
): Promise<Module> {
  let res: Response
  try {
    res = await fetch(`${server}/api/modules/${encodeURIComponent(moduleId)}/materials`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify(input),
    })
  } catch {
    throw new Error(unreachable(server))
  }
  if (!res.ok) await throwForStatus(res, `The server rejected the upload (${res.status}).`)
  return (await res.json()) as Module
}

/** PATCH /api/modules/:id — sets the module's difficulty (by hand, so it wins
    over an agent's suggestion) and/or its objectives. */
export async function patchModule(
  server: string,
  moduleId: string,
  input: { difficulty?: { level: DifficultyLevel; rationale?: string }; objectives?: string[]; authorId: string },
): Promise<Module> {
  let res: Response
  try {
    res = await fetch(`${server}/api/modules/${encodeURIComponent(moduleId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify(input),
    })
  } catch {
    throw new Error(unreachable(server))
  }
  if (!res.ok) await throwForStatus(res, `The server rejected the change (${res.status}).`)
  return (await res.json()) as Module
}

/** POST /api/reports/:id/reconcile — accepts a subset of an agent's report
    recommendations into the module, publishing the decision card. */
export async function reconcileReport(
  server: string,
  reportId: string,
  input: { accepted: string[]; note: string; authorId: string },
): Promise<Report> {
  let res: Response
  try {
    res = await fetch(`${server}/api/reports/${encodeURIComponent(reportId)}/reconcile`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify(input),
    })
  } catch {
    throw new Error(unreachable(server))
  }
  if (!res.ok) await throwForStatus(res, `The server rejected the reconciliation (${res.status}).`)
  return (await res.json()) as Report
}

/* ---- Membership: course info, claim, join, invites (DECISIONS.md §20) ------ */

export interface CourseInfo {
  name: string
  subtitle: string
}

/** GET /api/course — the course's public face; never needs a token. */
export async function fetchCourseInfo(server: string): Promise<CourseInfo> {
  let res: Response
  try {
    res = await fetch(`${server}/api/course`, { signal: AbortSignal.timeout(8000) })
  } catch {
    throw new Error(unreachable(server))
  }
  if (!res.ok) await throwForStatus(res, `The server responded ${res.status} when asking about the course.`)
  return (await res.json()) as CourseInfo
}

export interface JoinedAs {
  personId: string
  name: string
  personToken: string
}

/** POST /api/claim — the deploy's owner token binds the teacher. */
export async function claimOwner(server: string, token: string): Promise<JoinedAs> {
  let res: Response
  try {
    res = await fetch(`${server}/api/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
  } catch {
    throw new Error(unreachable(server))
  }
  if (!res.ok) await throwForStatus(res, `The server rejected the claim (${res.status}).`)
  return (await res.json()) as JoinedAs
}

/** POST /api/join — a single-use invite becomes a person. */
export async function joinCourse(server: string, token: string, name: string): Promise<JoinedAs> {
  let res: Response
  try {
    res = await fetch(`${server}/api/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, name }),
    })
  } catch {
    throw new Error(unreachable(server))
  }
  if (!res.ok) await throwForStatus(res, `The server rejected the join (${res.status}).`)
  return (await res.json()) as JoinedAs
}

/** POST /api/invites — teacher mints a single-use invite link. */
export async function createInvite(server: string, authorId: string): Promise<{ token: string; joinHash: string }> {
  let res: Response
  try {
    res = await fetch(`${server}/api/invites`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ authorId }),
    })
  } catch {
    throw new Error(unreachable(server))
  }
  if (!res.ok) await throwForStatus(res, `The server rejected the invite (${res.status}).`)
  return (await res.json()) as { token: string; joinHash: string }
}

/* ---- WS: defensive parsing ------------------------------------------------ */

/** Turns whatever arrived over WS into a `ServerEvent`, or `null` if it isn't
    recognized. Never throws: a broken event is logged and ignored. */
export function parseEvent(raw: unknown): ServerEvent | null {
  if (typeof raw !== "string") {
    console.warn("ada: got a WS frame that isn't text; ignoring it.")
    return null
  }
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    console.warn("ada: got a WS message that isn't JSON; ignoring it.", raw)
    return null
  }
  const parsed = serverEventSchema.safeParse(data)
  if (!parsed.success) {
    const type = typeof data === "object" && data !== null && "type" in data ? String(data.type) : "unknown"
    console.warn(`ada: invalid event "${type}"; ignoring it.`, parsed.error.issues)
    return null
  }
  return parsed.data
}

/* ---- WS: connection with reconnection ---------------------------------------- */

/** Opens the events WS and keeps it alive with gentle backoff (1 s, 2 s, 4 s…
    capped at 15 s). Returns the function to close it for good. */
export function connectEvents(
  server: string,
  handlers: {
    onEvent: (event: ServerEvent) => void
    onStatus: (connected: boolean) => void
  },
  memberId?: string,
): { close: () => void; setTyping: (channelId: string, typing: boolean) => void } {
  const stored = readStoredToken()
  const socketUrl = new URL(`${server.replace(/^http/, "ws")}/ws`)
  if (stored) socketUrl.searchParams.set("token", stored)
  if (!stored && memberId) socketUrl.searchParams.set("memberId", memberId)
  let ws: WebSocket | null = null
  let closed = false
  let attempts = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const open = () => {
    if (closed) return
    ws = new WebSocket(socketUrl)
    ws.onopen = () => {
      attempts = 0
      handlers.onStatus(true)
    }
    ws.onmessage = (e) => {
      const event = parseEvent(e.data)
      if (event) handlers.onEvent(event)
    }
    ws.onclose = () => {
      if (closed) return
      handlers.onStatus(false)
      const wait = Math.min(1000 * 2 ** attempts, 15000)
      attempts += 1
      timer = setTimeout(open, wait)
    }
  }

  open()

  return {
    close: () => {
      closed = true
      if (timer) clearTimeout(timer)
      ws?.close()
    },
    setTyping: (channelId, typing) => {
      if (ws?.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify({ type: "typing.set", payload: { channelId, typing } }))
    },
  }
}

/* ---- Cleaning references before they reach the state ---------------------- */

/** The message without the references that don't resolve: no seal for a card
    that isn't here, a citation back to the text it carried, no publication tile,
    no thread. Degrading beats dropping — what a person wrote stays readable. */
function degradeMessage(msg: Message, cards: Set<string>, threads: Set<string>): Message {
  const out: Message = { ...msg }
  if (out.fromCard && !cards.has(out.fromCard.cardId)) {
    console.warn(`ada: message "${out.id}" comes from an unknown card "${out.fromCard.cardId}"; showing it without the seal.`)
    delete out.fromCard
  }
  if (out.publishes && !cards.has(out.publishes)) {
    console.warn(`ada: message "${out.id}" publishes an unknown card "${out.publishes}"; showing it as a plain message.`)
    delete out.publishes
  }
  if (out.threadId && !threads.has(out.threadId)) {
    console.warn(`ada: message "${out.id}" belongs to an unknown thread "${out.threadId}"; showing it in the channel.`)
    delete out.threadId
  }
  if (out.paragraphs.some((p) => p.some((b) => b.kind === "cite" && !cards.has(b.cite.cardId)))) {
    console.warn(`ada: message "${out.id}" cites a card that isn't here; the citation goes back to being text.`)
    out.paragraphs = out.paragraphs.map((p) =>
      p.map((b): MessageBlock => (b.kind === "cite" && !cards.has(b.cite.cardId) ? { kind: "text", text: b.text } : b)),
    )
  }
  return out
}

/** The client's thread convention, applied to the message that opens a thread:
    the root carries its thread's id, which is what `components/ada/message.tsx`
    reads to offer "N replies" on it. The server never sets it — its `replyIds`
    come from `messages.thread_id`, so a root marked server-side would end up
    listed among its own replies — and without this a thread created from the UI
    would exist and be unreachable. Only fills a `threadId` that's missing. */
function markThreadRoot(msg: Message, threadId: string): Message {
  return msg.threadId ? msg : { ...msg, threadId }
}

/** The snapshot as the UI can actually draw it. The server doesn't check that a
    `fromCard`, a citation or a thread exists (it accepted `fromCard:
    {cardId:"no-such-card"}` and stored it), and the provider's lookups throw on
    a dangling id — with the message persisted, that used to blank the app on
    every load. Everything that can be degraded is; only what has no author, no
    channel or no root message is dropped. */
export function sanitizeSnapshot(snap: CommunitySnapshot): CommunitySnapshot {
  const memberIds = new Set(snap.members.map((m) => m.id))
  const channelIds = new Set(snap.channels.map((c) => c.id))

  // A channel draws the faces of the members it names.
  const channels = snap.channels.map((c) => {
    const ids = c.memberIds.filter((id) => memberIds.has(id))
    if (ids.length === c.memberIds.length) return c
    console.warn(`ada: channel "${c.id}" lists members that aren't in the course; leaving them out.`)
    return { ...c, memberIds: ids }
  })

  const cards = snap.cards.filter((c) => {
    if (!memberIds.has(c.authorId)) {
      console.warn(`ada: card "${c.id}" has an unknown author "${c.authorId}"; leaving it out.`)
      return false
    }
    if (!channelIds.has(c.channelId)) {
      console.warn(`ada: card "${c.id}" is in an unknown channel "${c.channelId}"; leaving it out.`)
      return false
    }
    return true
  })
  const cardIds = new Set(cards.map((c) => c.id))

  // A message with no author has no name and no avatar to be drawn with.
  const kept = snap.messages.filter((m) => {
    if (!memberIds.has(m.authorId)) {
      console.warn(`ada: message "${m.id}" has an unknown author "${m.authorId}"; leaving it out.`)
      return false
    }
    if (!channelIds.has(m.channelId)) {
      console.warn(`ada: message "${m.id}" is in an unknown channel "${m.channelId}"; leaving it out.`)
      return false
    }
    return true
  })
  const messageIds = new Set(kept.map((m) => m.id))

  // A thread opens from its root message; without it there's nothing to open.
  const threads = snap.threads.flatMap<Thread>((t) => {
    if (!messageIds.has(t.rootMessageId)) {
      console.warn(`ada: thread "${t.id}" has no root message "${t.rootMessageId}"; leaving it out.`)
      return []
    }
    const out: Thread = { ...t, replyIds: t.replyIds.filter((id) => messageIds.has(id)) }
    if (out.publishedCardId && !cardIds.has(out.publishedCardId)) {
      console.warn(`ada: thread "${t.id}" closes with an unknown card "${out.publishedCardId}"; leaving the card out.`)
      delete out.publishedCardId
    }
    return [out]
  })
  const threadIds = new Set(threads.map((t) => t.id))
  const rootOf = new Map(threads.map((t) => [t.rootMessageId, t.id]))

  const messages = kept.map((m) => {
    const msg = degradeMessage(m, cardIds, threadIds)
    const openedThread = rootOf.get(msg.id)
    return openedThread ? markThreadRoot(msg, openedThread) : msg
  })

  // Older servers (or a stale seed) may not send these at all: default rather
  // than reject, so the rest of the community still draws.
  const modules = Array.isArray(snap.modules) ? snap.modules : []
  const assignments = Array.isArray(snap.assignments) ? snap.assignments : []
  const moduleIds = new Set(modules.map((m) => m.id))
  const assignmentIds = new Set(assignments.map((a) => a.id))

  const feedback = (Array.isArray(snap.feedback) ? snap.feedback : []).filter((f) => {
    if (!memberIds.has(f.studentId)) {
      console.warn(`ada: feedback "${f.id}" is addressed to an unknown student "${f.studentId}"; leaving it out.`)
      return false
    }
    if (!assignmentIds.has(f.assignmentId)) {
      console.warn(`ada: feedback "${f.id}" points at an unknown assignment "${f.assignmentId}"; leaving it out.`)
      return false
    }
    return true
  })

  const reports = (Array.isArray(snap.reports) ? snap.reports : []).filter((r) => {
    if (!memberIds.has(r.studentId)) {
      console.warn(`ada: report "${r.id}" is about an unknown student "${r.studentId}"; leaving it out.`)
      return false
    }
    if (!moduleIds.has(r.moduleId)) {
      console.warn(`ada: report "${r.id}" points at an unknown module "${r.moduleId}"; leaving it out.`)
      return false
    }
    return true
  })

  return { ...snap, channels, cards, messages, threads, modules, assignments, feedback, reports }
}

/* ---- Reducer: apply events to the snapshot -------------------------------- */

/** Applies an event to the snapshot and returns the new snapshot, or `null` if
    the event names something the course doesn't have at all — an author, a
    member — and there's nothing left to draw (ignored with a warn: in connected
    mode a broken event can't crash the whole screen). Everything else lands
    degraded, via `degradeMessage`. */
export function applyEvent(snap: CommunitySnapshot, event: ServerEvent): CommunitySnapshot | null {
  switch (event.type) {
    case "message.created":
      return withMessage(snap, event.payload.message)

    case "thread.created": {
      const th = event.payload.thread
      if (!snap.messages.some((m) => m.id === th.rootMessageId)) {
        console.warn(`ada: thread.created "${th.id}" has no root message "${th.rootMessageId}"; ignoring it.`)
        return null
      }
      if (th.publishedCardId && !snap.cards.some((c) => c.id === th.publishedCardId)) {
        console.warn(`ada: thread.created with an unknown card "${th.publishedCardId}"; ignoring it.`)
        return null
      }
      const exists = snap.threads.some((t) => t.id === th.id)
      return {
        ...snap,
        messages: snap.messages.map((m) => (m.id === th.rootMessageId ? markThreadRoot(m, th.id) : m)),
        threads: exists ? snap.threads.map((t) => (t.id === th.id ? th : t)) : [...snap.threads, th],
      }
    }

    case "card.published": {
      const { card, message } = event.payload
      if (!snap.members.some((m) => m.id === card.authorId)) {
        console.warn(`ada: card.published with an unknown author "${card.authorId}"; ignoring it.`)
        return null
      }
      const exists = snap.cards.some((c) => c.id === card.id)
      const withCard: CommunitySnapshot = {
        ...snap,
        cards: exists ? snap.cards.map((c) => (c.id === card.id ? card : c)) : [...snap.cards, card],
      }
      // If the publication post itself is broken, the card still lands in the row.
      return withMessage(withCard, message) ?? withCard
    }

    case "member.presence": {
      const { memberId, presence } = event.payload
      if (!snap.members.some((m) => m.id === memberId)) {
        console.warn(`ada: member.presence for an unknown member "${memberId}"; ignoring it.`)
        return null
      }
      return {
        ...snap,
        members: snap.members.map((m) => (m.id === memberId ? { ...m, presence } : m)),
      }
    }

    case "module.updated": {
      const { module } = event.payload
      if (!snap.channels.some((c) => c.id === module.channelId)) {
        console.warn(`ada: module.updated "${module.id}" has an unknown channel "${module.channelId}"; ignoring it.`)
        return null
      }
      const exists = snap.modules.some((m) => m.id === module.id)
      return {
        ...snap,
        modules: exists ? snap.modules.map((m) => (m.id === module.id ? module : m)) : [...snap.modules, module],
      }
    }

    case "feedback.created": {
      const { feedback } = event.payload
      if (!snap.members.some((m) => m.id === feedback.studentId)) {
        console.warn(`ada: feedback.created "${feedback.id}" is addressed to an unknown student "${feedback.studentId}"; ignoring it.`)
        return null
      }
      if (!snap.assignments.some((a) => a.id === feedback.assignmentId)) {
        console.warn(`ada: feedback.created "${feedback.id}" points at an unknown assignment "${feedback.assignmentId}"; ignoring it.`)
        return null
      }
      const exists = snap.feedback.some((f) => f.id === feedback.id)
      return {
        ...snap,
        feedback: exists ? snap.feedback.map((f) => (f.id === feedback.id ? feedback : f)) : [...snap.feedback, feedback],
      }
    }

    case "member.joined": {
      const { member } = event.payload
      const exists = snap.members.some((m) => m.id === member.id)
      return {
        ...snap,
        members: exists ? snap.members.map((m) => (m.id === member.id ? member : m)) : [...snap.members, member],
      }
    }

    case "member.updated": {
      const { member } = event.payload
      const exists = snap.members.some((m) => m.id === member.id)
      return {
        ...snap,
        members: exists ? snap.members.map((m) => (m.id === member.id ? member : m)) : [...snap.members, member],
      }
    }

    case "member.deleted": {
      const { memberId } = event.payload
      if (!snap.members.some((m) => m.id === memberId)) return snap
      return sanitizeSnapshot({
        ...snap,
        members: snap.members.filter((m) => m.id !== memberId),
        channels: snap.channels.map((c) => ({ ...c, memberIds: c.memberIds.filter((id) => id !== memberId) })),
      })
    }

    case "channel.created": {
      const channel = event.payload.channel
      const memberIds = channel.memberIds.filter((id) => snap.members.some((m) => m.id === id))
      const exists = snap.channels.some((c) => c.id === channel.id)
      return {
        ...snap,
        channels: exists
          ? snap.channels.map((c) => (c.id === channel.id ? { ...channel, memberIds } : c))
          : [...snap.channels, { ...channel, memberIds }],
      }
    }

    case "channel.updated": {
      const channel = event.payload.channel
      const memberIds = channel.memberIds.filter((id) => snap.members.some((m) => m.id === id))
      const exists = snap.channels.some((c) => c.id === channel.id)
      return {
        ...snap,
        channels: exists
          ? snap.channels.map((c) => (c.id === channel.id ? { ...channel, memberIds } : c))
          : [...snap.channels, { ...channel, memberIds }],
      }
    }

    case "channel.deleted": {
      const { channelId } = event.payload
      if (!snap.channels.some((c) => c.id === channelId)) return snap
      const messages = snap.messages.filter((m) => m.channelId !== channelId)
      const messageIds = new Set(messages.map((m) => m.id))
      const cards = snap.cards.filter((c) => c.channelId !== channelId)
      const cardIds = new Set(cards.map((c) => c.id))
      const threads = snap.threads
        .filter((t) => messageIds.has(t.rootMessageId))
        .map((t) => ({ ...t, replyIds: t.replyIds.filter((id) => messageIds.has(id)), publishedCardId: t.publishedCardId && cardIds.has(t.publishedCardId) ? t.publishedCardId : undefined }))
      return sanitizeSnapshot({
        ...snap,
        channels: snap.channels.filter((c) => c.id !== channelId),
        cards,
        messages,
        threads,
        modules: snap.modules.filter((m) => m.channelId !== channelId),
        assignments: snap.assignments.filter((a) => a.channelId !== channelId),
      })
    }

    case "community.updated":
      return { ...snap, ...event.payload.community }

    case "message.updated":
    case "message.deleted":
      return withMessage(snap, event.payload.message)

    case "message.reactions.updated": {
      const { messageId, reactions } = event.payload
      if (!snap.messages.some((m) => m.id === messageId)) {
        console.warn(`ada: message.reactions.updated for an unknown message "${messageId}"; ignoring it.`)
        return null
      }
      return { ...snap, messages: snap.messages.map((m) => (m.id === messageId ? { ...m, reactions } : m)) }
    }

    case "channel.read": {
      const { channelId } = event.payload
      if (!snap.channels.some((c) => c.id === channelId)) return snap
      return { ...snap, channels: snap.channels.map((c) => (c.id === channelId ? { ...c, unread: false } : c)) }
    }

    case "typing.updated":
      // Typing state is intentionally ephemeral and is not part of the
      // Community snapshot. Consume the event without mutating durable state.
      return snap

    case "report.updated": {
      const { report } = event.payload
      if (!snap.members.some((m) => m.id === report.studentId)) {
        console.warn(`ada: report.updated "${report.id}" is about an unknown student "${report.studentId}"; ignoring it.`)
        return null
      }
      if (!snap.modules.some((m) => m.id === report.moduleId)) {
        console.warn(`ada: report.updated "${report.id}" points at an unknown module "${report.moduleId}"; ignoring it.`)
        return null
      }
      const exists = snap.reports.some((r) => r.id === report.id)
      return {
        ...snap,
        reports: exists ? snap.reports.map((r) => (r.id === report.id ? report : r)) : [...snap.reports, report],
      }
    }
  }
}

/** Adds (or replaces, by id) a message. Without an author or a channel it can't
    be drawn and is dropped; every other broken reference is degraded away, so a
    message that mentions a card we don't have still arrives as text. */
function withMessage(snap: CommunitySnapshot, incoming: Message): CommunitySnapshot | null {
  if (!snap.members.some((m) => m.id === incoming.authorId)) {
    console.warn(`ada: message from an unknown author "${incoming.authorId}"; ignoring it.`)
    return null
  }
  if (!snap.channels.some((c) => c.id === incoming.channelId)) {
    console.warn(`ada: message in an unknown channel "${incoming.channelId}"; ignoring it.`)
    return null
  }
  const degraded = degradeMessage(
    incoming,
    new Set(snap.cards.map((c) => c.id)),
    new Set(snap.threads.map((t) => t.id)),
  )
  // A message can arrive after the thread it opens (a re-send, or a thread the
  // server made on an older message): it carries the root's mark too.
  const opened = snap.threads.find((t) => t.rootMessageId === degraded.id)
  const msg = opened ? markThreadRoot(degraded, opened.id) : degraded

  const existingById = snap.messages.some((m) => m.id === msg.id)
  const existingByClient = msg.clientId ? snap.messages.find((m) => m.clientId === msg.clientId) : undefined
  const messages = existingByClient
    ? snap.messages.map((m) => (m.id === existingByClient.id ? msg : m))
    : existingById
      ? snap.messages.map((m) => (m.id === msg.id ? msg : m))
      : [...snap.messages, msg]

  // `degradeMessage` already dropped a threadId we don't know, so if one is
  // left the thread is here: the message joins its replies.
  let threads = snap.threads
  const th = msg.threadId ? snap.threads.find((t) => t.id === msg.threadId) : undefined
  if (th && th.rootMessageId !== msg.id && !th.replyIds.includes(msg.id)) {
    threads = snap.threads.map((t) => (t.id === th.id ? { ...t, replyIds: [...t.replyIds, msg.id] } : t))
  }

  return { ...snap, messages, threads }
}
