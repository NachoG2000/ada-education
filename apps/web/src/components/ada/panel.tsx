/* Contextual panel (stack): Thread, Card, and an agent's sheet. */

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { isAgent, isNew, useCommunity, type Panel } from "@/lib/community"
import type { Card, Member } from "@/lib/types"
import { Composer } from "./channel"
import { FloatingButton, Folder, FolderTab } from "./folder"
import { CardState, Cite, Pill, Tab } from "./card"
import { MemberAvatar, PresenceTag, agentInk } from "./identity"
import { Markdown } from "./markdown"
import { MessageRow } from "./message"

export function PanelStack() {
  const { panels, closePanel, popPanel, card, thread, message, member } = useCommunity()
  /* An agent's sheet is not a provider `Panel` yet (the stack is
     thread | card, see community.tsx): it opens from here and closes on its
     own as soon as what's underneath changes, so it never covers a thread or
     a card just opened from the channel. */
  const [agentId, setAgentId] = useState<string | null>(null)
  const [seenPanels, setSeenPanels] = useState(panels)
  if (seenPanels !== panels) {
    setSeenPanels(panels)
    setAgentId(null)
  }
  const agent = seenPanels === panels ? agentId : null

  if (panels.length === 0) return null
  const top = panels[0]
  // With the agent sheet on top, only one extra tab: never three.
  const below = agent ? panels.slice(0, 1) : panels

  const tabLabel = (p: Panel) =>
    p.kind === "thread" ? `Thread · ${member(message(thread(p.threadId).rootMessageId).authorId).name}` : card(p.cardId).title

  return (
    <Folder
      tabs={
        <>
          {agent && (
            <FolderTab active icon={<AgentGlyph />}>
              {member(agent).name}
            </FolderTab>
          )}
          {below.map((p, i) => (
            <FolderTab
              key={p.kind === "thread" ? p.threadId : p.cardId}
              active={!agent && i === 0}
              onClick={() => {
                if (agent) setAgentId(null)
                else if (i !== 0) popPanel()
              }}
              icon={p.kind === "thread" ? <ThreadGlyph /> : <CardGlyph />}
            >
              {tabLabel(p)}
            </FolderTab>
          ))}
        </>
      }
      actions={
        <FloatingButton label="Close panel" onClick={closePanel}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </FloatingButton>
      }
    >
      {agent ? (
        <AgentPanel agentId={agent} />
      ) : top.kind === "thread" ? (
        <ThreadPanel threadId={top.threadId} onOpenAgent={setAgentId} />
      ) : (
        <CardPanel cardId={top.cardId} onOpenAgent={setAgentId} />
      )}
    </Folder>
  )
}

/* ---- Thread ------------------------------------------------------------ */

function ThreadPanel({ threadId, onOpenAgent }: { threadId: string; onOpenAgent: (id: string) => void }) {
  const { thread, message, card, member, openCard } = useCommunity()
  const th = thread(threadId)
  const root = message(th.rootMessageId)
  const published = th.publishedCardId ? card(th.publishedCardId) : null
  const people = [...new Set([root.authorId, ...th.replyIds.map((id) => message(id).authorId)])].map(member)

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ThreadHeader people={people} onOpenAgent={onOpenAgent} />
        <div className="mx-4 rounded-card bg-panel-2 px-1 py-1">
          <MessageRow message={root} showThreadLink={false} className="hover:bg-transparent" />
        </div>
        <p className="meta px-7 pt-4 pb-1 text-ink-3">
          {th.replyIds.length} {th.replyIds.length === 1 ? "reply" : "replies"}
        </p>
        <div className="flex flex-col gap-0.5 px-1 pb-2">
          {th.replyIds.map((id) => (
            <MessageRow key={id} message={message(id)} compact showThreadLink={false} />
          ))}
        </div>
        {published && <PublishedCard card={published} authorName={member(published.authorId).name} onOpen={() => openCard(published.id)} />}
      </div>
      <Composer compact placeholder="Reply in the thread…" />
    </>
  )
}

/** Who's in the thread; if there's an agent, how its runner is doing right now. */
function ThreadHeader({ people, onOpenAgent }: { people: Member[]; onOpenAgent: (id: string) => void }) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 pt-3 pb-2">
      <span className="flex items-center">
        {people.slice(0, 5).map((m, i) => (
          <span key={m.id} className={cn("rounded-full ring-2 ring-panel", i > 0 && "-ml-1.5")}>
            <MemberAvatar member={m} size={20} />
          </span>
        ))}
      </span>
      <span className="meta text-ink-3">{people.length} in the thread</span>
      {people.filter(isAgent).map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onOpenAgent(a.id)}
          title={`View ${a.name}'s sheet`}
          className="meta -mx-1 inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-ink-3 outline-none transition-colors hover:bg-panel-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-seal"
        >
          <span className="font-medium" style={a.presence === "away" ? undefined : { color: agentInk(a) }}>
            {a.name}
          </span>
          <PresenceTag member={a} />
        </button>
      ))}
    </header>
  )
}

/** Thread close: the card that got filed. */
function PublishedCard({ card, authorName, onOpen }: { card: Card; authorName: string; onOpen: () => void }) {
  return (
    <div className="mx-4 mt-2 mb-4">
      <div className="flex items-end pl-1.5">
        <Tab type={card.type} size="sm" />
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 rounded-card rounded-tl-none bg-panel px-4 py-3 text-left shadow-card outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-seal"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-serif text-[15.5px] font-medium text-ink">{card.title}</span>
            <Pill tone="ok" animate>
              Archived
            </Pill>
          </span>
          <span className="meta mt-1 block text-ink-3">
            Published as {card.type} · v{card.version} · {authorName}
          </span>
        </span>
        <span className="shrink-0 font-sans text-[12.5px] font-semibold text-ink">Open →</span>
      </button>
    </div>
  )
}

/* ---- Card (document) ---------------------------------------------------- */

function CardPanel({ cardId, onOpenAgent }: { cardId: string; onOpenAgent: (id: string) => void }) {
  const { card, member, me, community, now } = useCommunity()
  const c = card(cardId)
  const author = member(c.authorId)
  const fresh = isNew(c, now)
  const replaced = c.replaces ? community.cards.find((x) => x.id === c.replaces) : null
  const mine = author.id === me.id
  const [xray, setXray] = useState(false)
  const sourcesRef = useRef<HTMLDListElement>(null)

  useEffect(() => {
    document.documentElement.toggleAttribute("data-xray", xray)
    return () => document.documentElement.removeAttribute("data-xray")
  }, [xray])

  return (
    <>
      <article className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pt-2">
          <div className="flex items-end pl-1">
            <Tab type={c.type} />
          </div>
          {/* One Sun Rule: the full yellow is already spent on this card's row in
              the channel strip. Open, the card keeps its own surface and the
              "New" pill is the only sun in the panel. */}
          <div className="rounded-card rounded-tl-none bg-panel-2 shadow-card">
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-start justify-between gap-3">
                <h2
                  className="font-serif text-[25px] leading-[1.18] font-medium tracking-[-0.01em] text-ink text-balance"
                  style={{ fontVariationSettings: '"opsz" 24' }}
                >
                  {c.title}
                </h2>
                {fresh && <Pill tone="sun">New</Pill>}
              </div>
            </div>
          </div>
          <dl ref={sourcesRef} className="mx-0 mt-4 grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5 border-b border-line pb-4">
            <Row k="Author">
              {isAgent(author) ? (
                <button
                  type="button"
                  onClick={() => onOpenAgent(author.id)}
                  title={`View ${author.name}'s sheet`}
                  className="-my-1 -ml-1.5 flex items-center gap-2.5 rounded-control px-1.5 py-1 text-left outline-none transition-colors hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-seal"
                >
                  <MemberAvatar member={author} size={40} />
                  <span className="flex flex-col">
                    <span className="font-medium" style={{ color: agentInk(author) }}>
                      {author.name}
                    </span>
                    {/* Inline text, not flex: so the «·» never opens a line. */}
                    <span className="meta text-ink-3">
                      {author.scope === "personal"
                        ? `personal agent · ${member(author.createdBy).name}'s`
                        : `community agent · created by ${member(author.createdBy).name}`}{" "}
                      <span className="whitespace-nowrap">
                        · <PresenceTag member={author} />
                      </span>
                    </span>
                  </span>
                </button>
              ) : (
                <span className="flex items-center gap-2.5">
                  <MemberAvatar member={author} size={24} />
                  <span className="font-medium">{author.name}</span>
                </span>
              )}
            </Row>
            <Row k="Version">
              <span className="font-mono text-[12px]">v{c.version}</span>
              <span className="meta ml-1.5 text-ink-3">
                · {new Date(c.publishedAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
              </span>
              {c.state && c.state !== "new" && (
                <span className="ml-2">
                  <CardState card={c} />
                </span>
              )}
            </Row>
            <Row k="Sources">
              <span className="flex flex-col gap-1">
                {c.sources.map((s) => (
                  <span key={s.ref} data-source-ref={s.kind === "message" ? `msg-${s.ref}` : undefined} className="inline-flex items-center gap-1.5 text-ink-2">
                    <span aria-hidden className="text-ink-4">{s.kind === "message" ? "↳" : "▤"}</span>
                    <span>{s.label}</span>
                  </span>
                ))}
              </span>
            </Row>
            {replaced && (
              <Row k="Replaces">
                <span className="font-serif text-[13.5px] text-ink-3 line-through decoration-alert/70">{replaced.title}</span>
              </Row>
            )}
            <Row k="Visible to">
              {/* Never tell a non-author "only you": visibility belongs to the card, not the viewer. */}
              <Pill tone="gray">{c.visibility === "channel" ? "channel members" : mine ? "only me" : `only ${author.name}`}</Pill>
            </Row>
          </dl>
          <div className="px-0 pt-5 pb-6">
            <Markdown source={c.body} />
          </div>
        </div>
      </article>

      <footer className="flex items-center gap-1 border-t border-line px-3 py-2.5">
        <Action active={xray} onClick={() => setXray((v) => !v)}>
          View sources
        </Action>
        <Action disabled={!mine} reason={mine ? undefined : "only the author can edit"}>
          Edit
        </Action>
        <Action>File in another channel</Action>
        <Action className="ml-auto">History</Action>
      </footer>
      {xray && <XRay rootRef={sourcesRef} />}
    </>
  )
}

/* ---- Agent sheet --------------------------------------------------------- */

/** Who the agent is, who created it, which runner is running it, and what it filed. */
function AgentPanel({ agentId }: { agentId: string }) {
  const { member, community, runnerInfo, openCard, setActiveChannelId } = useCommunity()
  const a = member(agentId)
  if (!isAgent(a)) return null

  const creator = member(a.createdBy).name
  const scopeLabel = a.scope === "personal" ? `${creator}'s personal agent` : `community agent · created by ${creator}`
  const runner = runnerInfo(a.id)
  // "No runner" means it never connected: if it ever reported, the sheet keeps what it said.
  const noRunner = !runner && a.presence === "away"
  const channels = community.channels.filter((c) => a.channelIds.includes(c.id))
  const cards = community.cards.filter((c) => c.authorId === a.id)

  return (
    <article className="min-h-0 flex-1 overflow-y-auto">
      <div className="px-4 pt-2">
        <div className="flex items-center gap-4 rounded-card bg-panel-2 px-5 py-4 shadow-card">
          <MemberAvatar member={a} size={56} presence />
          <div className="min-w-0">
            <h2
              className="font-serif text-[25px] leading-[1.18] font-medium tracking-[-0.01em]"
              style={{ color: agentInk(a), fontVariationSettings: '"opsz" 24' }}
            >
              {a.name}
            </h2>
            <p className="meta mt-1 text-ink-3">
              {scopeLabel}{" "}
              {runner?.runtime && (
                <span className="whitespace-nowrap">
                  · <span className="font-mono text-[11.5px]">{runner.runtime}</span>{" "}
                </span>
              )}
              <span className="whitespace-nowrap">· {noRunner ? "no runner" : <PresenceTag member={a} />}</span>
            </p>
          </div>
        </div>

        <dl className="mx-0 mt-4 grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5 border-b border-line pb-4">
          <Row k="Model">
            <span className="font-mono text-[12px]">{runner?.model ?? a.provider.model}</span>
            <span className="meta ml-1.5 text-ink-3">· {a.provider.mode === "subscription" ? "via subscription" : "via API key"}</span>
          </Row>
          <Row k="Channels">
            <span className="flex flex-wrap gap-1.5">
              {channels.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveChannelId(c.id)}
                  className="pill bg-panel-3 text-ink-2 outline-none transition-colors hover:bg-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-seal"
                >
                  <span aria-hidden className="text-ink-4">#</span>
                  {c.name}
                </button>
              ))}
              {channels.length === 0 && <span className="text-ink-3">not in any channel yet</span>}
            </span>
          </Row>
          <Row k="Instructions">
            <span className="font-serif text-[14px] leading-[1.5] text-ink-2">{a.instructions}</span>
          </Row>
        </dl>

        <section className="pt-5 pb-6">
          <h3 className="label text-ink-3">
            Published cards <span className="font-normal">· {cards.length}</span>
          </h3>
          {cards.length === 0 ? (
            <p className="mt-2 font-serif text-[14px] text-ink-3 italic">No cards filed yet.</p>
          ) : (
            <ul className="mt-2.5 flex flex-col items-start gap-1.5">
              {cards.map((c) => (
                <li key={c.id} className="max-w-full">
                  <Cite card={c} onOpen={openCard} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  )
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="meta flex min-h-[20px] items-start pt-[3px] text-ink-3">{k}</dt>
      <dd className="flex min-h-[20px] min-w-0 items-start font-sans text-[13px] text-ink">{children}</dd>
    </>
  )
}

function Action({
  children,
  active,
  disabled,
  onClick,
  reason,
  className,
}: {
  children: React.ReactNode
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  /** why it can't be done, when disabled */
  reason?: string
  className?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={reason}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 rounded-full px-3 font-sans text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-seal",
        active ? "bg-ink text-panel" : "text-ink-2 hover:bg-panel-2 hover:text-ink",
        disabled && "cursor-not-allowed text-ink-4 hover:bg-transparent hover:text-ink-4",
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ---- Source x-ray: lines from the card to the origin messages ---- */

function XRay({ rootRef }: { rootRef: React.RefObject<HTMLDListElement | null> }) {
  const [lines, setLines] = useState<Array<{ x1: number; y1: number; x2: number; y2: number }>>([])

  useLayoutEffect(() => {
    const compute = () => {
      const root = rootRef.current
      if (!root) return
      const out: typeof lines = []
      root.querySelectorAll<HTMLElement>("[data-source-ref]").forEach((el) => {
        const target = document.getElementById(el.dataset.sourceRef!)
        if (!target) return
        const a = el.getBoundingClientRect()
        const b = target.getBoundingClientRect()
        target.setAttribute("data-xray-target", "")
        out.push({ x1: a.left - 8, y1: a.top + a.height / 2, x2: b.right + 6, y2: b.top + b.height / 2 })
      })
      setLines(out)
    }
    compute()
    window.addEventListener("resize", compute)
    const t = setInterval(compute, 250)
    return () => {
      window.removeEventListener("resize", compute)
      clearInterval(t)
      document.querySelectorAll("[data-xray-target]").forEach((n) => n.removeAttribute("data-xray-target"))
    }
  }, [rootRef])

  return (
    <svg className="pointer-events-none fixed inset-0 z-40 size-full" aria-hidden>
      {lines.map((l, i) => {
        const dx = Math.max(48, (l.x1 - l.x2) * 0.45)
        const d = `M${l.x1} ${l.y1} C ${l.x1 - dx} ${l.y1}, ${l.x2 + dx} ${l.y2}, ${l.x2} ${l.y2}`
        return (
          <g key={i} className="text-ink">
            <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" className="animate-[dash_300ms_ease-out]" />
            <circle cx={l.x2} cy={l.y2} r="4" fill="var(--color-sun)" stroke="currentColor" strokeWidth="1.5" />
            <circle cx={l.x1} cy={l.y1} r="3" fill="currentColor" />
          </g>
        )
      })}
    </svg>
  )
}

function ThreadGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3.5h10v7H7.5L4 13.5v-3H3z" />
    </svg>
  )
}
function CardGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
      <path d="M2.5 7h11" />
    </svg>
  )
}
/** The figure in miniature: body, antenna and two eyes. Never a "BOT" badge. */
function AgentGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="10" height="8.5" rx="3" />
      <path d="M8 2.5v2.5" />
      <path d="M6.4 9h.01M9.6 9h.01" />
    </svg>
  )
}
