/* Client for connected mode: REST + WS against apps/server.
   The event types below are a hand mirror of packages/protocol/src/events.ts
   (they agree today); switching to `import type { ServerEvent, CommunitySnapshot }
   from "@ada/protocol"` is pending so the two can't drift.

   Rule for this file: nothing that comes in over the network is allowed to
   crash the screen. The provider's lookups throw on a dangling id, so every
   reference is checked HERE, before it touches the state — both in the
   snapshot that hydrates the app and in each event. What can be degraded is
   degraded (a message that points at a card we don't have loses its seal and
   keeps its text); only what can't be drawn at all is dropped. Always with a
   console.warn, because it means the server sent something inconsistent. */

import type { Card, Community, Message, MessageBlock, Presence, Thread } from "./types"

/* ---- Contract mirror types ----------------------------------------- */

/** The community as the server serves it: without `meId` (each client decides that). */
export type CommunitySnapshot = Omit<Community, "meId">

/** Events server → web client over `/ws` (goal-2-api.md §1 "In scope"). */
export type ServerEvent =
  | { type: "message.created"; payload: { message: Message } }
  | { type: "thread.created"; payload: { thread: Thread } }
  | { type: "card.published"; payload: { card: Card; message: Message } }
  | { type: "member.presence"; payload: { memberId: string; presence: Presence; runtime?: string; model?: string } }

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

/** GET /api/community → full snapshot to hydrate the provider. */
export async function fetchCommunity(server: string): Promise<CommunitySnapshot> {
  let res: Response
  try {
    // Short timeout: an error screen with retry beats an endless spinner.
    res = await fetch(`${server}/api/community`, { signal: AbortSignal.timeout(8000) })
  } catch {
    throw new Error(unreachable(server))
  }
  // Behind the Vite proxy a server that isn't running answers 502/503/504, not a network error.
  if (res.status >= 502 && res.status <= 504) throw new Error(unreachable(server))
  if (!res.ok) throw new Error(`The server responded ${res.status} when asking for the community.`)
  const data = (await res.json()) as CommunitySnapshot
  if (!data || !Array.isArray(data.members) || !Array.isArray(data.channels) || !Array.isArray(data.messages) || !Array.isArray(data.cards) || !Array.isArray(data.threads)) {
    throw new Error("The server returned a community with a shape I don't recognize.")
  }
  return sanitizeSnapshot(data)
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
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error("Couldn't send the message: the server isn't responding.")
  }
  if (!res.ok) throw new Error(`The server rejected the message (${res.status}).`)
}

/** POST /api/threads — opens a thread on a message, or returns the one that
    message already has (the server dedupes by root). The thread also arrives
    over WS as `thread.created`; applying it twice is a no-op, so the caller can
    fold this one into the state right away instead of waiting for the event. */
export async function createThread(server: string, rootMessageId: string): Promise<Thread> {
  let res: Response
  try {
    res = await fetch(`${server}/api/threads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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

/* ---- WS: defensive parsing ------------------------------------------------ */

const EVENT_TYPES = new Set(["message.created", "thread.created", "card.published", "member.presence"])

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
  if (typeof data !== "object" || data === null) {
    console.warn("ada: WS event that isn't an object; ignoring it.", data)
    return null
  }
  const ev = data as { type?: unknown; payload?: unknown }
  if (typeof ev.type !== "string" || !EVENT_TYPES.has(ev.type)) {
    console.warn(`ada: unknown event "${String(ev.type)}"; ignoring it.`)
    return null
  }
  if (typeof ev.payload !== "object" || ev.payload === null) {
    console.warn(`ada: event "${ev.type}" with no payload; ignoring it.`)
    return null
  }
  // Minimal shape check per type. The server is ours: this just guards
  // against a broken payload crashing the reducer.
  const p = ev.payload as Record<string, unknown>
  const isObjectWithId = (x: unknown): boolean =>
    typeof x === "object" && x !== null && typeof (x as { id?: unknown }).id === "string"
  const valid =
    (ev.type === "message.created" && isObjectWithId(p.message)) ||
    (ev.type === "thread.created" && isObjectWithId(p.thread)) ||
    (ev.type === "card.published" && isObjectWithId(p.card) && isObjectWithId(p.message)) ||
    (ev.type === "member.presence" && typeof p.memberId === "string" && typeof p.presence === "string")
  if (!valid) {
    console.warn(`ada: event "${ev.type}" with a payload I don't recognize; ignoring it.`, p)
    return null
  }
  return ev as ServerEvent
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
): () => void {
  const url = `${server.replace(/^http/, "ws")}/ws`
  let ws: WebSocket | null = null
  let closed = false
  let attempts = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const open = () => {
    if (closed) return
    ws = new WebSocket(url)
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

  return () => {
    closed = true
    if (timer) clearTimeout(timer)
    ws?.close()
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

  return { ...snap, channels, cards, messages, threads }
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

  const exists = snap.messages.some((m) => m.id === msg.id)
  const messages = exists ? snap.messages.map((m) => (m.id === msg.id ? msg : m)) : [...snap.messages, msg]

  // `degradeMessage` already dropped a threadId we don't know, so if one is
  // left the thread is here: the message joins its replies.
  let threads = snap.threads
  const th = msg.threadId ? snap.threads.find((t) => t.id === msg.threadId) : undefined
  if (th && th.rootMessageId !== msg.id && !th.replyIds.includes(msg.id)) {
    threads = snap.threads.map((t) => (t.id === th.id ? { ...t, replyIds: [...t.replyIds, msg.id] } : t))
  }

  return { ...snap, messages, threads }
}
