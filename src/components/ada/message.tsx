/* La conversación se queda en conversación: texto plano, nombre, hora. Sin burbujas. */

import { cn } from "@/lib/utils"
import { formatTime, isNew, useCommunity } from "@/lib/community"
import type { Message, MessageBlock } from "@/lib/types"
import { MemberAvatar, MemberName } from "./identity"
import { Cite, FichaCard, Pill } from "./ficha"

export function Inline({ blocks, onOpenPage }: { blocks: MessageBlock[]; onOpenPage: (id: string) => void }) {
  const { page } = useCommunity()
  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === "text") return <span key={i}>{b.text}</span>
        if (b.kind === "code")
          return (
            <code key={i} className="rounded-[6px] bg-panel-3 px-1.5 py-px font-mono text-[12.5px] text-ink-2">
              {b.text}
            </code>
          )
        return <Cite key={i} page={page(b.cite.pageId)} section={b.cite.section} onOpen={onOpenPage} />
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
  const { member, page, thread, openThread, openPage, me, community, now } = useCommunity()
  const author = member(message.authorId)
  const th = message.threadId ? thread(message.threadId) : undefined
  const isRoot = th?.rootMessageId === message.id
  const avatar = compact ? 30 : 36

  if (message.publishes) {
    const p = page(message.publishes)
    return (
      <div id={id} className={cn("group grid grid-cols-[36px_1fr] gap-x-3.5 rounded-card px-3 py-2", className)}>
        <MemberAvatar member={author} size={36} />
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <MemberName member={author} />
            <span className="font-sans text-[11.5px] text-ink-4 tabular-nums">{formatTime(message.at)}</span>
            <span className="font-sans text-[12.5px] text-ink-3">
              archivó una ficha en #{community.channels.find((c) => c.id === message.channelId)?.name}
            </span>
          </div>
          <FichaCard
            page={p}
            authorName={member(p.authorId).name}
            sourcesCount={p.sources.length}
            onOpen={() => openPage(p.id)}
            animate={isNew(p, now)}
            fresh={isNew(p, now)}
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
        highlight ? "bg-sol-soft" : "hover:bg-panel-2",
        className,
      )}
    >
      <MemberAvatar member={author} size={avatar} />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <MemberName member={author} />
          {author.id === me.id && <span className="font-sans text-[11.5px] text-ink-4">vos</span>}
          <span className="font-sans text-[11.5px] text-ink-4 tabular-nums">{formatTime(message.at)}</span>
        </div>

        {message.fromPage && <FromFicha pageId={message.fromPage.pageId} ago={message.fromPage.ago} />}

        <div className="max-w-[68ch] font-sans text-[14.5px] leading-[1.55] text-ink">
          {message.paragraphs.map((para, i) => (
            <p key={i} className={cn(i > 0 && "mt-2")}>
              <Inline blocks={para} onOpenPage={openPage} />
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
            className="mt-2 inline-flex h-7 items-center gap-2 rounded-full bg-panel px-3 font-sans text-[12.5px] font-semibold text-ink shadow-card outline-none hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-sello"
          >
            <ThreadIcon />
            {th.replyIds.length} {th.replyIds.length === 1 ? "respuesta" : "respuestas"}
            {th.publishedPageId && (
              <span className="font-normal text-ink-3">· {member(page(th.publishedPageId).authorId).name} archivó una ficha</span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

/** Marcador "desde la ficha": el momento clave de la demo. */
function FromFicha({ pageId, ago }: { pageId: string; ago: string }) {
  const { page, member, openPage } = useCommunity()
  const p = page(pageId)
  return (
    <div className="my-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      <Pill tone="sol" animate>
        <CheckIcon />
        Ya en el fichero · {ago}
      </Pill>
      <Cite page={p} onOpen={openPage} />
      <span className="meta text-ink-3">
        v{p.version} · {member(p.authorId).name}
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
