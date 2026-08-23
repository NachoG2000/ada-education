/* Community state + contextual panel (stack) navigation.

   The provider is source-agnostic: in demo mode it receives the synthetic
   community from demo.ts with a frozen NOW; in connected mode (VITE_ADA_SERVER)
   useConnectedCommunity feeds it with the server's snapshot and the WS events.
   Product components don't know which of the two sources is active. */

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react"
import {
  applyEvent,
  connectEvents,
  createThread,
  fetchCommunity,
  postMessage,
  type CommunitySnapshot,
  type MessageInput,
  type RunnerInfo,
  type ServerEvent,
} from "./api"
import type { Agent, Card, Community, Member, Message, Person, Thread } from "./types"

export type Panel =
  | { kind: "thread"; threadId: string }
  | { kind: "card"; cardId: string }
  | { kind: "agent"; agentId: string }

/** What a panel is, in one string: its React key and what the screen announces against. */
export function panelKey(p: Panel): string {
  return p.kind === "thread" ? `thread:${p.threadId}` : p.kind === "card" ? `card:${p.cardId}` : `agent:${p.agentId}`
}

interface CommunityCtx {
  community: Community
  /** "now": frozen in demo, real clock when connected; filters future messages and sets the day labels */
  now: Date
  /** active source; product components should NOT look at this to render differently */
  mode: "demo" | "connected"
  me: Member
  /** WS state (stays true in demo so it never triggers warnings) */
  connected: boolean
  /** posts over REST when connected; rejects with a clear error in demo */
  sendMessage: (input: MessageInput) => Promise<void>
  /** opens a thread on a message and shows it in the panel; rejects in demo */
  replyInThread: (messageId: string) => Promise<void>
  /** runtime and model reported by the agent's runner (via member.presence) */
  runnerInfo: (memberId: string) => RunnerInfo | undefined
  activeChannelId: string
  setActiveChannelId: (id: string) => void
  panels: Panel[]
  openThread: (threadId: string) => void
  openCard: (cardId: string) => void
  openAgent: (agentId: string) => void
  closePanel: () => void
  popPanel: () => void
  member: (id: string) => Member
  card: (id: string) => Card
  thread: (id: string) => Thread
  message: (id: string) => Message
  authorName: (id: string) => string
}

const Ctx = createContext<CommunityCtx | null>(null)

/* Demo-mode defaults: module-level stable identities. */
const sendMessageDemo = (): Promise<void> =>
  Promise.reject(new Error("You're in demo mode: the message doesn't go anywhere. Set VITE_ADA_SERVER to connect to a course."))
const startThreadDemo = (): Promise<Thread> =>
  Promise.reject(new Error("You're in demo mode: the threads are the ones in demo.ts. Set VITE_ADA_SERVER to connect to a course."))
const runnerInfoDemo = (): RunnerInfo | undefined => undefined

export function CommunityProvider({
  community,
  initialChannelId,
  initialPanels = [],
  now,
  mode = "demo",
  connected = true,
  sendMessage = sendMessageDemo,
  startThread = startThreadDemo,
  runnerInfo = runnerInfoDemo,
  children,
}: {
  community: Community
  initialChannelId: string
  /** initial stack for the contextual panel; the first one stays on top */
  initialPanels?: Panel[]
  now: Date
  mode?: "demo" | "connected"
  connected?: boolean
  sendMessage?: (input: MessageInput) => Promise<void>
  /** creates the thread on the server and folds it into the state; the panel is this provider's job */
  startThread?: (messageId: string) => Promise<Thread>
  runnerInfo?: (memberId: string) => RunnerInfo | undefined
  children: ReactNode
}) {
  const [activeChannelId, setActiveChannel] = useState(initialChannelId)
  const [panels, setPanels] = useState<Panel[]>(initialPanels)

  /* Unread, the way a chat app does it: a channel you're not looking at gets a
     mark when someone else writes there, and loses it when you open it. Only
     what arrives after the screen is up counts — history isn't "unread". */
  const [unread, setUnread] = useState<Set<string>>(() => new Set())
  const seenIds = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (seenIds.current === null) {
      seenIds.current = new Set(community.messages.map((m) => m.id))
      return
    }
    const seen = seenIds.current
    const fresh = new Set<string>()
    for (const m of community.messages) {
      if (seen.has(m.id)) continue
      seen.add(m.id)
      if (m.channelId !== activeChannelId && m.authorId !== community.meId) fresh.add(m.channelId)
    }
    if (fresh.size) setUnread((prev) => new Set([...prev, ...fresh]))
  }, [community.messages, community.meId, activeChannelId])

  const setActiveChannelId = useCallback(
    (id: string) => {
      setActiveChannel(id)
      setUnread((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      if (mode === "connected") storeChannel(id)
    },
    [mode],
  )

  // The tab title carries the count, so the channel shows up in the tab strip too.
  useEffect(() => {
    const base = "Ada"
    document.title = unread.size ? `(${unread.size}) ${base}` : base
    return () => {
      document.title = base
    }
  }, [unread])

  const communityWithUnread = useMemo<Community>(
    () =>
      unread.size
        ? { ...community, channels: community.channels.map((c) => (unread.has(c.id) ? { ...c, unread: true } : c)) }
        : community,
    [community, unread],
  )

  const byId = useMemo(() => {
    const members = new Map(community.members.map((m) => [m.id, m]))
    const cards = new Map(community.cards.map((c) => [c.id, c]))
    const threads = new Map(community.threads.map((t) => [t.id, t]))
    const messages = new Map(community.messages.map((m) => [m.id, m]))
    return { members, cards, threads, messages }
  }, [community])

  const openThread = useCallback((threadId: string) => {
    setPanels((p) => {
      const base = p.filter((x) => x.kind !== "thread")
      return [{ kind: "thread", threadId }, ...base].slice(0, 2) as Panel[]
    })
  }, [])
  const openCard = useCallback((cardId: string) => {
    setPanels((p) => {
      const rest = p.filter((x) => !(x.kind === "card" && x.cardId === cardId))
      return [{ kind: "card", cardId }, ...rest].slice(0, 2) as Panel[]
    })
  }, [])
  /* One sheet at a time: opening another agent replaces the one that was open,
     the same way a thread replaces the previous thread. */
  const openAgent = useCallback((agentId: string) => {
    setPanels((p) => {
      const base = p.filter((x) => x.kind !== "agent")
      return [{ kind: "agent", agentId }, ...base].slice(0, 2) as Panel[]
    })
  }, [])
  const closePanel = useCallback(() => setPanels([]), [])
  const popPanel = useCallback(() => setPanels((p) => p.slice(1)), [])

  /* Open a thread on a message that doesn't have one yet: the server creates it
     (or hands back the one it already had), the state takes it, and the panel
     opens on it. It throws if the server said no, so the button that called it
     can show why. */
  const replyInThread = useCallback(
    async (messageId: string) => {
      const thread = await startThread(messageId)
      openThread(thread.id)
    },
    [startThread, openThread],
  )

  const value = useMemo<CommunityCtx>(() => {
    /* Lookups throw on broken ids: an invalid id in demo.ts is a bug we want to
       see head-on. In connected mode the ids come from another process, so two
       guards sit around this: api.ts cleans the snapshot and every event before
       they reach the state (a dangling `fromCard` loses its seal, a dangling
       citation becomes its text), and the boundaries in components/ada/boundary
       keep whatever still throws inside one message or one panel. */
    const must = <T,>(m: Map<string, T>, id: string, what: string): T => {
      const v = m.get(id)
      if (!v) throw new Error(`${what} not found: ${id}`)
      return v
    }
    const member = (id: string) => must(byId.members, id, "member")
    return {
      community: communityWithUnread,
      now,
      mode,
      connected,
      sendMessage,
      replyInThread,
      runnerInfo,
      me: member(community.meId),
      activeChannelId,
      setActiveChannelId,
      panels,
      openThread,
      openCard,
      openAgent,
      closePanel,
      popPanel,
      member,
      card: (id) => must(byId.cards, id, "card"),
      thread: (id) => must(byId.threads, id, "thread"),
      message: (id) => must(byId.messages, id, "message"),
      authorName: (id) => member(id).name,
    }
  }, [community.meId, communityWithUnread, now, mode, connected, sendMessage, replyInThread, runnerInfo, activeChannelId, setActiveChannelId, panels, byId, openThread, openCard, openAgent, closePanel, popPanel])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCommunity() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useCommunity outside CommunityProvider")
  return v
}

/* ---- Connected mode ------------------------------------------------------ */

const ME_KEY = "ada:me"
const CHANNEL_KEY = "ada:channel"

/** Connected mode reopens where you left off, like any chat app. */
function readStoredChannel(): string | null {
  try {
    return localStorage.getItem(CHANNEL_KEY)
  } catch {
    return null
  }
}
export function storeChannel(id: string) {
  try {
    localStorage.setItem(CHANNEL_KEY, id)
  } catch {
    // no storage: fine, we open on the default channel next time
  }
}

function readStoredMe(): string | null {
  try {
    return localStorage.getItem(ME_KEY)
  } catch {
    return null // no storage: asked again on every visit
  }
}

function storeMe(id: string) {
  try {
    localStorage.setItem(ME_KEY, id)
  } catch {
    // no storage: the choice only holds for this session
  }
}

function clearMe() {
  try {
    localStorage.removeItem(ME_KEY)
  } catch {
    // no storage, nothing to clear
  }
}

/** Live state of connected mode: the snapshot plus whatever each runner reported. */
type Live = { snapshot: CommunitySnapshot; runners: Record<string, RunnerInfo> }

type LiveAction =
  | { type: "hydrate"; snapshot: CommunitySnapshot }
  | { type: "resync"; snapshot: CommunitySnapshot }
  | { type: "event"; event: ServerEvent }

function reduceLive(state: Live | null, action: LiveAction): Live | null {
  if (action.type === "hydrate") return { snapshot: action.snapshot, runners: {} }
  // A fresh snapshot after a gap (reconnect, tab back in front): the server's
  // truth replaces ours, what the runners reported stays.
  if (action.type === "resync") return { snapshot: action.snapshot, runners: state?.runners ?? {} }
  if (!state) return state // the WS opens after the GET; this shouldn't happen
  const snapshot = applyEvent(state.snapshot, action.event)
  if (!snapshot) return state // event ignored (the reason was already logged)
  let runners = state.runners
  if (action.event.type === "member.presence") {
    const { memberId, runtime, model } = action.event.payload
    // Keeps the last thing the runner reported; when it disconnects, the memory
    // stays (the agent's card distinguishes "no runner" = never connected).
    if (runtime !== undefined || model !== undefined) runners = { ...runners, [memberId]: { runtime, model } }
  }
  return { snapshot, runners }
}

/** So a message that just arrived never gets filtered out as "future" due to
    clock skew between server and client: now advances to the newest `at`. */
function nowWithEvent(prev: Date, event: ServerEvent): Date {
  let max = Math.max(prev.getTime(), Date.now())
  const at =
    event.type === "message.created" || event.type === "card.published" ? event.payload.message.at : undefined
  if (at) {
    const t = new Date(at).getTime()
    if (Number.isFinite(t)) max = Math.max(max, t)
  }
  return new Date(max)
}

export type ConnectionState =
  | { phase: "loading" }
  | { phase: "error"; detail: string; retry: () => void }
  | { phase: "choosing-person"; courseName: string; people: Person[]; choose: (p: Person) => void }
  | {
      phase: "ready"
      community: Community
      initialChannelId: string
      now: Date
      connected: boolean
      sendMessage: (input: MessageInput) => Promise<void>
      startThread: (messageId: string) => Promise<Thread>
      runnerInfo: (memberId: string) => RunnerInfo | undefined
    }

/** The connected source: hydrates with GET /api/community, applies WS events
    with the reducer, and resolves the local identity (localStorage["ada:me"]). */
export function useConnectedCommunity(server: string): ConnectionState {
  const [loadState, setLoadState] = useState<{ phase: "loading" } | { phase: "error"; detail: string } | { phase: "ready" }>({
    phase: "loading",
  })
  const [live, dispatch] = useReducer(reduceLive, null)
  const [meId, setMeId] = useState<string | null>(readStoredMe)
  const [connected, setConnected] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [attempt, setAttempt] = useState(0)

  // Bootstrap: GET first, WS only after. Events that land in between are
  // lost; for this weekend's local scope that's good enough (see AGENTS.md
  // §decisions).
  useEffect(() => {
    let isActive = true
    let closeWs: (() => void) | null = null
    fetchCommunity(server)
      .then((snapshot) => {
        if (!isActive) return
        dispatch({ type: "hydrate", snapshot })
        setNow(new Date())
        setLoadState({ phase: "ready" })
        // A stored identity that no longer exists in the course → clear it and
        // ask again. Validating here is enough: events never add members.
        setMeId((current) => {
          if (current !== null && !snapshot.members.some((m) => m.kind === "person" && m.id === current)) {
            console.warn(`ada: the stored identity "${current}" doesn't exist in the course; asking who you are again.`)
            clearMe()
            return null
          }
          return current
        })
        /* Like Slack: anything that happened while we weren't listening is
           fetched back, never lost. Every WS open (the first one closes the
           GET→WS gap; later ones follow a disconnect), the tab coming back
           in front, and the network coming back all trigger a resync. */
        let resyncing: Promise<void> | null = null
        const resync = () => {
          if (resyncing) return resyncing
          resyncing = fetchCommunity(server)
            .then((fresh) => {
              if (!isActive) return
              dispatch({ type: "resync", snapshot: fresh })
              setNow((prev) => new Date(Math.max(prev.getTime(), Date.now())))
            })
            .catch((e: unknown) => console.warn("ada: couldn't resync with the server; keeping what we have.", e))
            .finally(() => {
              resyncing = null
            })
          return resyncing
        }
        closeWs = connectEvents(server, {
          onEvent: (event) => {
            dispatch({ type: "event", event })
            setNow((prev) => nowWithEvent(prev, event))
          },
          onStatus: (ok) => {
            if (!isActive) return
            setConnected(ok)
            if (ok) void resync()
          },
        })
        const onVisible = () => {
          if (document.visibilityState === "visible") void resync()
        }
        const onOnline = () => void resync()
        document.addEventListener("visibilitychange", onVisible)
        window.addEventListener("online", onOnline)
        const closeEvents = closeWs
        closeWs = () => {
          document.removeEventListener("visibilitychange", onVisible)
          window.removeEventListener("online", onOnline)
          closeEvents()
        }
      })
      .catch((e: unknown) => {
        if (isActive) setLoadState({ phase: "error", detail: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      isActive = false
      closeWs?.()
    }
  }, [server, attempt])

  // Clock tick for the day labels (never goes backward).
  useEffect(() => {
    const t = setInterval(() => setNow((prev) => new Date(Math.max(prev.getTime(), Date.now()))), 60_000)
    return () => clearInterval(t)
  }, [])

  const people = useMemo(
    () => (live ? live.snapshot.members.filter((m): m is Person => m.kind === "person") : []),
    [live],
  )
  const meIsValid = meId !== null && people.some((p) => p.id === meId)

  const choose = useCallback((p: Person) => {
    storeMe(p.id)
    setMeId(p.id)
  }, [])

  const retry = useCallback(() => {
    setLoadState({ phase: "loading" })
    setAttempt((n) => n + 1)
  }, [])

  const sendMessage = useCallback(
    async (input: MessageInput) => {
      if (!meId) throw new Error("You haven't chosen who you are yet.")
      await postMessage(server, { ...input, authorId: meId })
    },
    [server, meId],
  )

  /* The thread goes into the state here, through the same reducer branch the
     `thread.created` event uses (that's where the root message gets marked with
     its thread id). The WS then delivers the same thread and lands on a no-op:
     the panel doesn't have to wait for the round trip. */
  const startThread = useCallback(
    async (messageId: string) => {
      const thread = await createThread(server, messageId)
      dispatch({ type: "event", event: { type: "thread.created", payload: { thread } } })
      return thread
    },
    [server],
  )

  const runners = live?.runners
  const runnerInfo = useCallback((memberId: string) => runners?.[memberId], [runners])

  const community = useMemo<Community | null>(
    () => (live && meId !== null ? { ...live.snapshot, meId } : null),
    [live, meId],
  )

  if (loadState.phase === "error") return { phase: "error", detail: loadState.detail, retry }
  if (loadState.phase === "loading" || !live) return { phase: "loading" }
  if (live.snapshot.channels.length === 0) {
    return { phase: "error", detail: "The course doesn't have any channels yet. Run `npm run seed` in the server.", retry }
  }
  if (!meIsValid || !community) {
    return { phase: "choosing-person", courseName: live.snapshot.name, people, choose }
  }
  return {
    phase: "ready",
    community,
    // The course opens where the questions are (the same channel the demo opens
    // in); if the seed doesn't have one, the first channel it does have.
    initialChannelId: (
      live.snapshot.channels.find((c) => c.id === readStoredChannel()) ??
      live.snapshot.channels.find((c) => c.id === "questions") ??
      live.snapshot.channels[0]
    ).id,
    now,
    connected,
    sendMessage,
    startThread,
    runnerInfo,
  }
}

/** A card is "new" during the first 24 h since it was published. */
export function isNew(card: Card, now: Date) {
  return card.state === "new" && now.getTime() - new Date(card.publishedAt).getTime() < 24 * 3600 * 1000
}

export function isAgent(m: Member): m is Agent {
  return m.kind === "agent"
}

export function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
}

export function dayLabel(iso: string, now: Date) {
  const d = new Date(iso)
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const diff = Math.round((b - a) / 86400000)
  if (diff === 0) return "today"
  if (diff === 1) return "yesterday"
  if (diff === -1) return "tomorrow"
  return d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })
}
