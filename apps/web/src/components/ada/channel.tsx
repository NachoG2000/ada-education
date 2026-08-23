/* The channel: header, card row, conversation and composer. */

import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { dayLabel, isAgent, isNew, useCommunity } from "@/lib/community"
import type { Agent, Card, Channel, Member, Message, MessageBlock } from "@/lib/types"
import { CardTab } from "./card"
import { MemberAvatar, PresenceTag, agentInk, presenceLabel } from "./identity"
import { MessageRow } from "./message"

/** Channel actions (they live in the tab strip, outside the body).
    Today it's information only: who's here. Search and channel settings don't
    exist yet, and a button that does nothing lies, so they're not here. */
export function ChannelActions({ channel }: { channel: Channel }) {
  const { member } = useCommunity()
  const faces = channel.memberIds.slice(0, 4).map(member)
  const total = channel.memberCount ?? channel.memberIds.length
  return (
    <div className="inline-flex h-8 items-center gap-2 rounded-full bg-panel pr-3 pl-2 ring-1 ring-line ring-inset">
      <span aria-hidden className="flex items-center">
        {faces.map((m, i) => (
          <span key={m.id} className={cn("rounded-full ring-2 ring-panel", i > 0 && "-ml-1.5")}>
            <MemberAvatar member={m} size={18} />
          </span>
        ))}
      </span>
      <span className="meta text-ink-3">{total}</span>
      <span className="sr-only">{total} members in the channel</span>
    </div>
  )
}

/** The channel description under the tab, and the agents that inhabit it,
    with their live status (`member.presence`, which arrives over the WS). */
export function ChannelHeader({ channel }: { channel: Channel }) {
  const { community } = useCommunity()
  const agents = useMemo(
    () => community.members.filter((m): m is Agent => isAgent(m) && channel.memberIds.includes(m.id)),
    [community.members, channel.memberIds],
  )
  if (!channel.description && agents.length === 0) return null
  return (
    <header className="px-5 pt-4 pb-3">
      {channel.description && <p className="font-sans text-[13px] text-ink-3">{channel.description}</p>}
      {agents.length > 0 && (
        <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", channel.description && "mt-2.5")}>
          {agents.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              <MemberAvatar member={a} size={20} />
              {/* Same name + status pair as the thread header (panel.tsx). */}
              <span className="meta font-semibold" style={a.presence === "away" ? undefined : { color: agentInk(a) }}>
                {a.name}
              </span>
              <PresenceTag member={a} className="meta text-ink-3" />
            </li>
          ))}
        </ul>
      )}
    </header>
  )
}

export function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  title,
  className,
}: {
  label: string
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  /** why it's not possible, when disabled */
  title?: string
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-seal",
        disabled ? "cursor-not-allowed text-ink-4" : "text-ink-3 hover:bg-panel-2 hover:text-ink",
        className,
      )}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  )
}

/** Floor for a card in the row: below this the title clips mid-word and the
    meta line stops being readable. */
const CARD_MIN_W = 160
/** `gap-3` between cards, and the width of the "+N" button (`w-12`). */
const CARD_GAP = 12
const MORE_W = 48

/** How many cards fit at the legible floor. Never zero: one card, even tight,
    beats an empty row. */
function fit(available: number) {
  return Math.max(1, Math.floor((available + CARD_GAP) / (CARD_MIN_W + CARD_GAP)))
}

/** The channel's card row: cards peeking through their tabs; the newest one, in yellow. */
export function CardRow({ channel }: { channel: Channel }) {
  const { community, member, openCard, panels, now } = useCommunity()
  const [expanded, setExpanded] = useState(false)
  /* The row measures itself: with the contextual panel open there's room for
     one or two cards, not three, and squeezing them into 140 px slivers was
     what clipped the titles. What doesn't fit goes behind the "+N". */
  const row = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = row.current
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const cards = community.cards.filter((c) => c.channelId === channel.id)
  // Before the first measurement, the design's three: the layout effect
  // corrects it before the browser paints.
  const capacity = width === null ? 3 : fit(width) >= cards.length ? cards.length : fit(width - MORE_W - CARD_GAP)
  const limit = expanded ? cards.length : Math.min(3, capacity)
  /* One Sun Rule (DESIGN.md): the full yellow is one large surface per screen.
     In a live channel several cards are `new` at once, so the sun goes to the
     newest of them — the others say "New" in the same ink, without the field. */
  const newest = cards.reduce<Card | null>((best, c) => (isNew(c, now) && (!best || c.publishedAt > best.publishedAt) ? c : best), null)
  const head = cards.slice(0, limit)
  // And the row exists to show what's new: if the newest card fell behind the
  // "+N" because there was no room, it takes the last slot.
  const shown = newest && !head.includes(newest) ? [...head.slice(0, limit - 1), newest] : head
  const more = cards.length - shown.length
  const openId = panels.find((p) => p.kind === "card")?.cardId
  const news = cards.filter((c) => isNew(c, now)).length

  if (cards.length === 0) {
    return (
      <section className="mx-4 mb-2 flex items-center gap-3 rounded-card bg-panel-2 px-4 py-3">
        <span className="label text-ink-3">Cards · 0</span>
        <span className="font-serif text-[14px] text-ink-3 italic">No cards yet. When someone files something, it shows up here.</span>
      </section>
    )
  }

  return (
    <section aria-label="Channel cards" className="mx-4 mb-1 rounded-card bg-panel-2 px-4 pt-3 pb-4">
      <div className="flex items-end gap-4">
        <div className="flex w-[92px] shrink-0 flex-col self-stretch pt-5 pb-1">
          <span className="label text-ink-2">Cards</span>
          <span className="meta mt-1 text-ink-3">{cards.length} in the channel</span>
          {news > 0 && <span className="meta mt-auto font-semibold text-sun-ink">{news} new</span>}
        </div>
        <div ref={row} className="flex min-w-0 flex-1 items-end gap-3">
          {/* `pb-3 -mb-3` gives the shadow and the archive animation room
              without moving the row; the expand button stays outside it,
              because it's the way out. */}
          <div className={cn("-mb-3 flex min-w-0 flex-1 items-end gap-3 pt-2 pb-3", expanded ? "flex-wrap gap-y-4" : "overflow-x-auto")}>
            {shown.map((c, i) => (
              <CardTab
                key={c.id}
                card={c}
                authorName={member(c.authorId).name}
                active={openId === c.id}
                fresh={isNew(c, now)}
                sun={c.id === newest?.id}
                animate={isNew(c, now)}
                onOpen={() => openCard(c.id)}
                style={{ animationDelay: `${i * 40}ms`, minWidth: CARD_MIN_W }}
              />
            ))}
          </div>
          {(more > 0 || expanded) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-label={expanded ? "Show only the cards that fit" : `Show the ${more} remaining cards`}
              className="meta mb-px flex h-[82px] w-12 shrink-0 items-center justify-center rounded-card-tab bg-panel text-ink-3 shadow-card outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-seal"
            >
              {expanded ? "Less" : `+${more}`}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

export function Conversation({ channel, messages }: { channel: Channel; messages: Message[] }) {
  const { panels, now, thread } = useCommunity()
  const openThread = panels.find((p) => p.kind === "thread")?.threadId
  const rootId = openThread ? thread(openThread).rootMessageId : undefined
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    const root = rootId ? document.getElementById(`msg-${rootId}`) : null
    if (root) {
      const top = root.offsetTop - el.offsetTop - 12
      if (top < el.scrollTop) el.scrollTop = Math.max(0, top)
    }
  }, [messages, channel.id, rootId])
  const rows = messages.map((m, i) => {
    const day = dayLabel(m.at, now)
    const sep = i === 0 || day !== dayLabel(messages[i - 1].at, now)
    return { m, day, sep }
  })
  return (
    <div ref={scroller} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1 pb-2">
      <div className="mt-auto flex flex-col gap-0.5">
        {rows.map(({ m, day, sep }) => (
          <Fragment key={m.id}>
            {sep && <DaySeparator label={day} />}
            <MessageRow id={`msg-${m.id}`} message={m} highlight={!!rootId && m.id === rootId} />
          </Fragment>
        ))}
      </div>
      <span className="sr-only">Channel #{channel.name}</span>
    </div>
  )
}

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="my-3 flex items-center gap-3 px-3" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-line" />
      <span className="meta rounded-full bg-panel-2 px-2.5 py-1 text-ink-3">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

/* ---- Composer ------------------------------------------------------------ */

/** Mentions: the same rule message.tsx uses to highlight them and the server
    uses to detect them (`@<id>` over kind:"text" blocks, goal-2-api.md §1). */
const MENTION = /@([a-zA-Z0-9][a-zA-Z0-9_-]*)/g

/** The token being typed right before the caret, if it's a mention. */
function mentionInProgress(value: string, caret: number): { from: number; query: string } | null {
  const m = /(?:^|\s)@([a-zA-Z0-9_-]*)$/.exec(value.slice(0, caret))
  if (!m) return null
  return { from: caret - m[1].length - 1, query: m[1] }
}

/** Lowercased and accent-free, so filtering doesn't fight the spelling. */
function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

/** The field's text as paragraphs: a blank line separates one paragraph from the next. */
function toParagraphs(text: string): MessageBlock[][] {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p): MessageBlock[] => [{ kind: "text", text: p }])
}

export function Composer({ placeholder, compact = false, threadId }: { placeholder: string; compact?: boolean; threadId?: string }) {
  const { community, activeChannelId, panels, mode, connected, sendMessage } = useCommunity()
  const channel = community.channels.find((c) => c.id === activeChannelId)

  // The compact composer lives inside the thread panel; until panel.tsx passes
  // the id down, it takes it from the top of the stack, which is that thread.
  const top = panels[0]
  const target = threadId ?? (compact && top && top.kind === "thread" ? top.threadId : undefined)

  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mention, setMention] = useState<{ from: number; query: string } | null>(null)
  /** position of the `@` whose menu was closed with Escape: it doesn't reopen on its own */
  const [muted, setMuted] = useState<number | null>(null)
  const [index, setIndex] = useState(0)

  const field = useRef<HTMLTextAreaElement>(null)
  /** where to leave the caret after the next render (the textarea is controlled) */
  const pendingCaret = useRef<number | null>(null)
  const uid = useId()
  const fieldId = `composer${uid}`
  const listId = `mentions${uid}`
  const helpId = `mentions-help${uid}`

  // Channel members, agents first: the composer exists mostly to call them.
  const members = useMemo(() => {
    const ids = new Set(channel?.memberIds ?? [])
    const inChannel = community.members.filter((m) => ids.has(m.id))
    return [...inChannel.filter(isAgent), ...inChannel.filter((m) => !isAgent(m))]
  }, [community.members, channel])

  const candidates = useMemo(() => {
    if (!mention) return []
    const q = normalize(mention.query)
    if (!q) return members
    return members.filter((m) => normalize(m.id).startsWith(q) || normalize(m.name).includes(q))
  }, [mention, members])

  const open = mention !== null && mention.from !== muted && candidates.length > 0
  const active = candidates.length > 0 ? Math.min(index, candidates.length - 1) : 0

  // Agents mentioned in the text whose runner isn't running.
  const disconnected = useMemo(() => {
    const byId = new Map(members.filter(isAgent).map((a) => [a.id.toLowerCase(), a] as const))
    const out: Agent[] = []
    for (const m of text.matchAll(MENTION)) {
      const a = byId.get(m[1].toLowerCase())
      if (a && a.presence === "away" && !out.includes(a)) out.push(a)
    }
    return out
  }, [text, members])

  useLayoutEffect(() => {
    const pos = pendingCaret.current
    if (pos === null) return
    pendingCaret.current = null
    const ta = field.current
    if (!ta || ta.disabled) return
    ta.focus()
    ta.setSelectionRange(pos, pos)
  })

  /** Recomputes the mentions menu from the field's real state. */
  const sync = () => {
    const ta = field.current
    if (!ta) return
    const m = mentionInProgress(ta.value, ta.selectionStart ?? ta.value.length)
    setMention(m)
    setIndex(0)
    if (!m || m.from !== muted) setMuted(null)
  }

  const choose = (m: Member) => {
    const ta = field.current
    if (!mention || !ta) return
    const caret = ta.selectionStart ?? text.length
    const before = text.slice(0, mention.from)
    const inserted = `@${m.id} `
    setText(`${before}${inserted}${text.slice(caret)}`)
    setMention(null)
    setMuted(null)
    pendingCaret.current = before.length + inserted.length
  }

  const openMentions = () => {
    const ta = field.current
    if (!ta) return
    const caret = ta.selectionStart ?? text.length
    const before = text.slice(0, caret)
    // Mentions are detected at a word start: if needed, a space first.
    const sep = before === "" || /\s$/.test(before) ? "" : " "
    setText(`${before}${sep}@${text.slice(caret)}`)
    const pos = before.length + sep.length + 1
    pendingCaret.current = pos
    setMention({ from: pos - 1, query: "" })
    setMuted(null)
    setIndex(0)
  }

  const send = async () => {
    // Demo mode: the community is synthetic and the composer doesn't send anywhere.
    if (mode === "demo" || sending || !channel) return
    const body = text.trim()
    if (body === "") return
    setSending(true)
    setError(null)
    try {
      await sendMessage({ channelId: channel.id, threadId: target, paragraphs: toParagraphs(body) })
      // Cleared only once the server confirmed: the message comes in over the WS.
      setText("")
      setMention(null)
      pendingCaret.current = 0
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the message.")
      pendingCaret.current = text.length
    } finally {
      setSending(false)
    }
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setIndex((active + 1) % candidates.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setIndex((active - 1 + candidates.length) % candidates.length)
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        choose(candidates[active])
        return
      }
      if (e.key === "Escape" && mention) {
        e.preventDefault()
        setMuted(mention.from)
        return
      }
    }
    // Enter sends only when there's somewhere to send to; in demo it stays a line break.
    if (e.key === "Enter" && !e.shiftKey && mode === "connected") {
      e.preventDefault()
      void send()
    }
  }

  const note = sending ? "Sending…" : mode === "connected" && !connected ? "No connection to the server" : null

  return (
    <form
      className="relative mx-4 mt-2 mb-4 rounded-card bg-panel-2 ring-1 ring-line ring-inset transition-shadow focus-within:bg-panel focus-within:ring-2 focus-within:ring-seal"
      onSubmit={(e) => {
        e.preventDefault()
        void send()
      }}
    >
      {open && (
        <div className="absolute bottom-full left-2 z-30 mb-2 w-[320px] max-w-[calc(100%-1rem)] overflow-hidden rounded-card bg-panel shadow-pop">
          <ul id={listId} role="listbox" aria-label={channel ? `Members of #${channel.name}` : "Channel members"} className="max-h-60 overflow-y-auto py-1">
            {candidates.map((m, i) => (
              <li
                key={m.id}
                id={`${listId}-${m.id}`}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault() // so the field doesn't lose focus
                  choose(m)
                }}
                className={cn("flex cursor-pointer items-center gap-2.5 px-3 py-1.5", i === active && "bg-panel-3")}
              >
                <MemberAvatar member={m} size={isAgent(m) ? 22 : 20} />
                <span className="min-w-0 flex-1 truncate font-sans text-[13.5px] font-medium text-ink" style={isAgent(m) ? { color: agentInk(m) } : undefined}>
                  {m.name}
                </span>
                <span className="meta shrink-0 text-ink-3">{isAgent(m) ? `@${m.id} · ${presenceLabel(m)}` : `@${m.id}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="sr-only" htmlFor={fieldId}>
        {placeholder}
      </label>
      <textarea
        ref={field}
        id={fieldId}
        rows={compact ? 1 : 2}
        value={text}
        disabled={sending}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value)
          if (error) setError(null)
          sync()
        }}
        onSelect={sync}
        onBlur={() => setMention(null)}
        onKeyDown={onKey}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${candidates[active].id}` : undefined}
        aria-describedby={open ? helpId : undefined}
        className="block w-full resize-none bg-transparent px-4 pt-3 font-sans text-[14.5px] text-ink outline-none placeholder:text-ink-3 disabled:opacity-70"
      />
      {open && (
        <p id={helpId} className="sr-only">
          Arrows to move through the members, Enter to choose, Escape to close.
        </p>
      )}

      {(disconnected.length > 0 || error) && (
        <div className="flex flex-col gap-1 px-4 pt-1.5">
          {disconnected.map((a) => (
            <p key={a.id} role="status" className="flex items-start gap-2 font-sans text-[12.5px] leading-[1.35] text-ink-2">
              <span aria-hidden className="mt-[5px] size-1.5 shrink-0 rounded-full bg-ink-4" />
              <span>
                <span className="font-semibold text-ink">{a.name}</span> is disconnected: its runner isn't running.{" "}
                {/* Only what we know: the server stores the message and the
                    channel shows it. Whether the mention reaches the agent when
                    its runner comes back isn't the client's promise to make. */}
                <span className="text-ink-3">The message still goes into the channel.</span>
              </span>
            </p>
          ))}
          {error && (
            <p role="alert" className="flex items-start gap-2 font-sans text-[12.5px] leading-[1.35] text-ink">
              <svg width="13" height="13" viewBox="0 0 16 16" className="mt-[3px] shrink-0 text-alert" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
                <circle cx="8" cy="8" r="6.2" />
                <path d="M8 4.8v3.7M8 10.9v.1" />
              </svg>
              <span>
                {error} <span className="text-ink-2">Your text is still here: try again.</span>
              </span>
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-0.5 px-2.5 pb-2">
        <IconButton label="Mention someone in the channel" onClick={openMentions}>
          <circle cx="8" cy="8" r="3" />
          <path d="M11 8v1.5a1.5 1.5 0 0 0 3 0V8a6 6 0 1 0-2.5 4.9" />
        </IconButton>
        <IconButton label="File as a card" disabled title="Cards are published by agents from their runner; not from the composer yet">
          <path d="M4 2h6l3 3v9H4z" />
          <path d="M10 2v3h3M6 8h5M6 11h5" />
        </IconButton>
        {note && <span className="meta ml-1.5 truncate text-ink-3">{note}</span>}
        <button
          type="submit"
          aria-label={sending ? "Sending the message" : "Send"}
          title={mode === "demo" ? "Demo mode: the conversation is a mockup and doesn't go anywhere" : undefined}
          disabled={sending || text.trim() === ""}
          className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-panel outline-none transition-colors hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-seal disabled:cursor-not-allowed disabled:bg-ink-4 disabled:hover:bg-ink-4"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 13V3M4 7l4-4 4 4" />
          </svg>
        </button>
      </div>
    </form>
  )
}
