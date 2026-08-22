/* Client for connected mode: REST + WS against apps/server.
   Local mirror of the goal-2-api.md contract; migrate to @ada/protocol
   once events.ts exists (task 1.4b).

   Rule for this file: nothing that comes in over the network is allowed to
   crash the screen. An unknown event or one with broken ids is ignored with
   console.warn; the provider's lookups still throw, which is why validation
   happens here BEFORE touching the state. */

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

/** Server URL if the app is running connected; `undefined` = demo mode. */
export function configuredServer(): string | undefined {
  const v: unknown = import.meta.env.VITE_ADA_SERVER
  if (typeof v !== "string" || v.trim() === "") return undefined
  return v.trim().replace(/\/+$/, "")
}

/* ---- REST ---------------------------------------------------------------- */

/** GET /api/community → full snapshot to hydrate the provider. */
export async function fetchCommunity(server: string): Promise<CommunitySnapshot> {
  let res: Response
  try {
    // Short timeout: an error screen with retry beats an endless spinner.
    res = await fetch(`${server}/api/community`, { signal: AbortSignal.timeout(8000) })
  } catch {
    throw new Error(`Couldn't reach the server at ${server}. Is it running? Try \`npm run dev:server\`.`)
  }
  if (!res.ok) throw new Error(`The server responded ${res.status} when asking for the community.`)
  const data = (await res.json()) as CommunitySnapshot
  if (!data || !Array.isArray(data.members) || !Array.isArray(data.channels) || !Array.isArray(data.messages) || !Array.isArray(data.cards) || !Array.isArray(data.threads)) {
    throw new Error("The server returned a community with a shape I don't recognize.")
  }
  return data
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

/* TODO: POST /api/threads is intentionally left unimplemented. Today's UI only
   opens threads that already exist (the replies button in
   components/ada/message.tsx); there's no flow that creates a thread from the
   client. When the composer gets "reply by creating a thread", it goes here. */

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

/* ---- Reducer: apply events to the snapshot -------------------------------- */

/** Applies an event to the snapshot and returns the new snapshot, or `null`
    if the event references ids that don't exist (ignored with a warn: in
    connected mode a broken event can't crash the whole screen). */
export function applyEvent(snap: CommunitySnapshot, event: ServerEvent): CommunitySnapshot | null {
  switch (event.type) {
    case "message.created":
      return withMessage(snap, event.payload.message)

    case "thread.created": {
      const th = event.payload.thread
      if (th.publishedCardId && !snap.cards.some((c) => c.id === th.publishedCardId)) {
        console.warn(`ada: thread.created with an unknown card "${th.publishedCardId}"; ignoring it.`)
        return null
      }
      const exists = snap.threads.some((t) => t.id === th.id)
      return {
        ...snap,
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

/** Adds (or replaces, by id) a message, validating that everything the UI is
    going to look up exists: author, channel, and cited cards. */
function withMessage(snap: CommunitySnapshot, msg: Message): CommunitySnapshot | null {
  if (!snap.members.some((m) => m.id === msg.authorId)) {
    console.warn(`ada: message from an unknown author "${msg.authorId}"; ignoring it.`)
    return null
  }
  if (!snap.channels.some((c) => c.id === msg.channelId)) {
    console.warn(`ada: message in an unknown channel "${msg.channelId}"; ignoring it.`)
    return null
  }
  for (const cardId of cardsReferenced(msg)) {
    if (!snap.cards.some((c) => c.id === cardId)) {
      console.warn(`ada: message "${msg.id}" cites an unknown card "${cardId}"; ignoring it.`)
      return null
    }
  }

  const exists = snap.messages.some((m) => m.id === msg.id)
  const messages = exists ? snap.messages.map((m) => (m.id === msg.id ? msg : m)) : [...snap.messages, msg]

  let threads = snap.threads
  if (msg.threadId) {
    const th = snap.threads.find((t) => t.id === msg.threadId)
    if (!th) {
      // thread.created may arrive right after; the message still lands in the channel.
      console.warn(`ada: message in an unknown thread "${msg.threadId}"; adding it to the channel anyway.`)
    } else if (th.rootMessageId !== msg.id && !th.replyIds.includes(msg.id)) {
      threads = snap.threads.map((t) => (t.id === th.id ? { ...t, replyIds: [...t.replyIds, msg.id] } : t))
    }
  }

  return { ...snap, messages, threads }
}

/** Card ids the UI will resolve when rendering this message. */
function cardsReferenced(msg: Message): string[] {
  const refs: string[] = []
  if (msg.publishes) refs.push(msg.publishes)
  if (msg.fromCard) refs.push(msg.fromCard.cardId)
  for (const paragraph of msg.paragraphs) {
    for (const block of paragraph) {
      if (block.kind === "cite") refs.push(block.cite.cardId)
    }
  }
  return refs
}
