/* Conversation stays conversation: plain text, name, time. No bubbles. */

import { Fragment, useMemo, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { formatTime, isNew, useCommunity } from "@/lib/community"
import type { Member, Message, MessageBlock } from "@/lib/types"
import { agentInk, MemberAvatar, MemberName } from "./identity"
import { CardMessage, Cite, Pill } from "./card"

/* Mentions: the server detects `@<id>` over kind:"text" blocks
   (openspec/changes/demo-local-backend/goal-2-api.md §1); here it highlights
   with the same rule, but for any member, not only agents. */
const MENTION = /@([a-zA-Z0-9][a-zA-Z0-9_-]*)/g

/** A mention reads like the member's name: weight and ink. Never a chip or a type color. */
function Mention({ member, text }: { member: Member; text: string }) {
  return (
    <span
      className="font-semibold text-ink"
      style={member.kind === "agent" ? { color: agentInk(member) } : undefined}
      title={`${member.name}${member.kind === "agent" ? ", agent" : ""}`}
    >
      {text}
    </span>
  )
}

/** Splits the text into plain runs and mentions of members that exist. If there are none, returns the text as-is. */
function withMentions(text: string, byId: Map<string, Member>): ReactNode {
  const out: ReactNode[] = []
  let last = 0
  let k = 0
  for (const m of text.matchAll(MENTION)) {
    const found = byId.get(m[1].toLowerCase())
    if (!found) continue
    if (m.index > last) out.push(<Fragment key={k++}>{text.slice(last, m.index)}</Fragment>)
    out.push(<Mention key={k++} member={found} text={m[0]} />)
    last = m.index + m[0].length
  }
  if (!out.length) return text
  if (last < text.length) out.push(<Fragment key={k++}>{text.slice(last)}</Fragment>)
  return out
}

export function Inline({ blocks, onOpenCard }: { blocks: MessageBlock[]; onOpenCard: (id: string) => void }) {
  const { card, community } = useCommunity()
  const byId = useMemo(() => new Map(community.members.map((m) => [m.id.toLowerCase(), m] as const)), [community.members])
  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === "text") return <Fragment key={i}>{withMentions(b.text, byId)}</Fragment>
        if (b.kind === "code")
          return (
            <code key={i} className="rounded-[6px] bg-panel-3 px-1.5 py-px font-mono text-[12.5px] break-words text-ink-2">
              {b.text}
            </code>
          )
        return <Cite key={i} card={card(b.cite.cardId)} section={b.cite.section} onOpen={onOpenCard} />
      })}
    </>
  )
}

export function MessageRow({
  message,
  compact = false,
  showThreadLink = true,
  className,
  highlight = false,
  id,
}: {
  message: Message
  compact?: boolean
  showThreadLink?: boolean
  className?: string
  highlight?: boolean
  id?: string
}) {
  const { member, card, thread, openThread, openCard, me, community, now } = useCommunity()
  const author = member(message.authorId)
  const th = message.threadId ? thread(message.threadId) : undefined
  const isRoot = th?.rootMessageId === message.id
  const avatar = compact ? 30 : 36

  if (message.publishes) {
    const c = card(message.publishes)
    return (
      <div id={id} className={cn("group grid grid-cols-[36px_1fr] gap-x-3.5 rounded-card px-3 py-2", className)}>
        <MemberAvatar member={author} size={36} />
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <MemberName member={author} />
            <span className="font-sans text-[11.5px] text-ink-3 tabular-nums">{formatTime(message.at)}</span>
            <span className="font-sans text-[12.5px] text-ink-3">
              filed a card in #{community.channels.find((ch) => ch.id === message.channelId)?.name}
            </span>
          </div>
          <CardMessage
            card={c}
            authorName={member(c.authorId).name}
            sourcesCount={c.sources.length}
            onOpen={() => openCard(c.id)}
            animate={isNew(c, now)}
            fresh={isNew(c, now)}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      id={id}
      className={cn(
        "group grid gap-x-3.5 rounded-card px-3 transition-colors",
        compact ? "grid-cols-[30px_1fr] py-2" : "grid-cols-[36px_1fr] py-2",
        highlight ? "bg-sun-soft" : "hover:bg-panel-2",
        className,
      )}
    >
      <MemberAvatar member={author} size={avatar} />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <MemberName member={author} />
          {author.id === me.id && <span className="font-sans text-[11.5px] text-ink-3">you</span>}
          <span className="font-sans text-[11.5px] text-ink-3 tabular-nums">{formatTime(message.at)}</span>
        </div>

        {message.fromCard && <FromCard cardId={message.fromCard.cardId} ago={message.fromCard.ago} />}

        <div className="max-w-[68ch] font-sans text-[14.5px] leading-[1.55] break-words text-ink">
          {message.paragraphs.map((para, i) => (
            <p key={i} className={cn(i > 0 && "mt-2")}>
              <Inline blocks={para} onOpenCard={openCard} />
            </p>
          ))}
        </div>

        {message.reactions && (
          <div className="mt-2 flex gap-1.5">
            {message.reactions.map((r) => (
              <span key={r.emoji} className="inline-flex h-6 items-center gap-1 rounded-full bg-panel-2 px-2.5 font-sans text-[12px] text-ink-2 ring-1 ring-line ring-inset">
                <span>{r.emoji}</span>
                <span className="font-medium tabular-nums">{r.count}</span>
              </span>
            ))}
          </div>
        )}

        {showThreadLink && isRoot && th && (
          <button
            type="button"
            onClick={() => openThread(th.id)}
            className="mt-2 inline-flex h-7 items-center gap-2 rounded-full bg-panel px-3 font-sans text-[12.5px] font-semibold text-ink shadow-card outline-none hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-seal"
          >
            <ThreadIcon />
            {th.replyIds.length} {th.replyIds.length === 1 ? "reply" : "replies"}
            {th.publishedCardId && (
              <span className="font-normal text-ink-3">· {member(card(th.publishedCardId).authorId).name} filed a card</span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

/** The "from the card file" marker: the demo's key moment. */
function FromCard({ cardId, ago }: { cardId: string; ago: string }) {
  const { card, member, openCard } = useCommunity()
  const c = card(cardId)
  return (
    <div className="my-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      <Pill tone="sun" animate>
        <CheckIcon />
        Already on file · {ago}
      </Pill>
      <Cite card={c} onOpen={openCard} />
      <span className="meta text-ink-3">
        v{c.version} · {member(c.authorId).name}
      </span>
    </div>
  )
}

function ThreadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3.5h10v7H7.5L4 13.5v-3H3z" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  )
}
