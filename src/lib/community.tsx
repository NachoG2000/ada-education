/* Estado de la comunidad en la demo + navegación del panel contextual (stack). */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import type { Agent, Community, Member, Message, Page, Person, Thread } from "./types"

export type Panel = { kind: "thread"; threadId: string } | { kind: "ficha"; pageId: string }

interface CommunityCtx {
  community: Community
  /** "ahora" de la demo: filtra mensajes futuros y fija las etiquetas de día */
  now: Date
  me: Person
  activeChannelId: string
  setActiveChannelId: (id: string) => void
  panels: Panel[]
  openThread: (threadId: string) => void
  openPage: (pageId: string) => void
  closePanel: () => void
  popPanel: () => void
  member: (id: string) => Member
  page: (id: string) => Page
  thread: (id: string) => Thread
  message: (id: string) => Message
  authorName: (id: string) => string
}

const Ctx = createContext<CommunityCtx | null>(null)

export function CommunityProvider({
  community,
  initialChannelId,
  initialPanels = [],
  now,
  children,
}: {
  community: Community
  initialChannelId: string
  /** stack inicial del panel contextual; el primero queda arriba */
  initialPanels?: Panel[]
  now: Date
  children: ReactNode
}) {
  const [activeChannelId, setActiveChannelId] = useState(initialChannelId)
  const [panels, setPanels] = useState<Panel[]>(initialPanels)

  const byId = useMemo(() => {
    const members = new Map(community.members.map((m) => [m.id, m]))
    const pages = new Map(community.pages.map((p) => [p.id, p]))
    const threads = new Map(community.threads.map((t) => [t.id, t]))
    const messages = new Map(community.messages.map((m) => [m.id, m]))
    return { members, pages, threads, messages }
  }, [community])

  const openThread = useCallback((threadId: string) => {
    setPanels((p) => {
      const base = p.filter((x) => x.kind !== "thread")
      return [{ kind: "thread", threadId }, ...base].slice(0, 2) as Panel[]
    })
  }, [])
  const openPage = useCallback((pageId: string) => {
    setPanels((p) => {
      const rest = p.filter((x) => !(x.kind === "ficha" && x.pageId === pageId))
      return [{ kind: "ficha", pageId }, ...rest].slice(0, 2) as Panel[]
    })
  }, [])
  const closePanel = useCallback(() => setPanels([]), [])
  const popPanel = useCallback(() => setPanels((p) => p.slice(1)), [])

  const value = useMemo<CommunityCtx>(() => {
    const must = <T,>(m: Map<string, T>, id: string, what: string): T => {
      const v = m.get(id)
      if (!v) throw new Error(`${what} no encontrado: ${id}`)
      return v
    }
    const member = (id: string) => must(byId.members, id, "miembro")
    return {
      community,
      now,
      me: member(community.meId) as Person,
      activeChannelId,
      setActiveChannelId,
      panels,
      openThread,
      openPage,
      closePanel,
      popPanel,
      member,
      page: (id) => must(byId.pages, id, "ficha"),
      thread: (id) => must(byId.threads, id, "thread"),
      message: (id) => must(byId.messages, id, "mensaje"),
      authorName: (id) => member(id).name,
    }
  }, [community, now, activeChannelId, panels, byId, openThread, openPage, closePanel, popPanel])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCommunity() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useCommunity fuera de CommunityProvider")
  return v
}

/** Una ficha es "nueva" durante las primeras 24 h desde su publicación. */
export function isNew(page: Page, now: Date) {
  return page.state === "nueva" && now.getTime() - new Date(page.publishedAt).getTime() < 24 * 3600 * 1000
}

export function isAgent(m: Member): m is Agent {
  return m.kind === "agent"
}

export function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
}

export function dayLabel(iso: string, now: Date) {
  const d = new Date(iso)
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const diff = Math.round((b - a) / 86400000)
  if (diff === 0) return "hoy"
  if (diff === 1) return "ayer"
  if (diff === -1) return "mañana"
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
}
