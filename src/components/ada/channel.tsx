/* El canal: cabecera, fila de fichas, conversación y composer. */

import { Fragment, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { dayLabel, isNew, useCommunity } from "@/lib/community"
import type { Channel, Message } from "@/lib/types"
import { FichaTab } from "./ficha"
import { MemberAvatar } from "./identity"
import { MessageRow } from "./message"
import { FloatingButton } from "./folder"

/** Acciones flotantes del canal (van en la tira de lengüetas, fuera del cuerpo). */
export function ChannelActions({ channel }: { channel: Channel }) {
  const { member } = useCommunity()
  const faces = channel.memberIds.slice(0, 4).map(member)
  return (
    <>
      <FloatingButton label="Miembros del canal" className="pr-3 pl-2">
        <span className="flex items-center">
          {faces.map((m, i) => (
            <span key={m.id} className={cn("rounded-full ring-2 ring-panel", i > 0 && "-ml-1.5")}>
              <MemberAvatar member={m} size={18} />
            </span>
          ))}
        </span>
        <span className="meta text-ink-3">{channel.memberCount ?? channel.memberIds.length}</span>
      </FloatingButton>
      <FloatingButton label="Buscar en el canal">
        <Glyph>
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" />
        </Glyph>
      </FloatingButton>
      <FloatingButton label="Configurar canal">
        <Glyph>
          <circle cx="8" cy="8" r="2" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
        </Glyph>
      </FloatingButton>
    </>
  )
}

/** Descripción del canal dentro del cuerpo, debajo de la lengüeta. */
export function ChannelHeader({ channel }: { channel: Channel }) {
  if (!channel.description) return null
  return (
    <header className="px-5 pt-4 pb-3">
      <p className="font-sans text-[13px] text-ink-3">{channel.description}</p>
    </header>
  )
}

export function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

export function IconButton({ label, children, onClick, className }: { label: string; children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full text-ink-3 outline-none transition-colors hover:bg-panel-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-sello",
        className,
      )}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  )
}

/** La fila de fichas del canal: las fichas asomando por sus pestañas; la nueva, en amarillo. */
export function FichaRow({ channel }: { channel: Channel }) {
  const { community, member, openPage, panels, now } = useCommunity()
  const pages = community.pages.filter((p) => p.channelId === channel.id)
  const shown = pages.slice(0, 3)
  const more = pages.length - shown.length
  const openId = panels.find((p) => p.kind === "ficha")?.pageId
  const news = pages.filter((p) => isNew(p, now)).length

  if (pages.length === 0) {
    return (
      <section className="mx-4 mb-2 flex items-center gap-3 rounded-card bg-panel-2 px-4 py-3">
        <span className="label text-ink-3">Fichas · 0</span>
        <span className="font-serif text-[14px] text-ink-3 italic">Todavía no hay fichas. Cuando alguien archive algo, aparece acá.</span>
      </section>
    )
  }

  return (
    <section aria-label="Fichas del canal" className="mx-4 mb-1 rounded-card bg-panel-2 px-4 pt-3 pb-4">
      <div className="flex items-end gap-4">
        <div className="flex w-[92px] shrink-0 flex-col self-stretch pt-5 pb-1">
          <span className="label text-ink-2">Fichas</span>
          <span className="meta mt-1 text-ink-3">{pages.length} en el canal</span>
          {news > 0 && <span className="meta mt-auto font-semibold text-sol-ink">{news} nueva</span>}
        </div>
        <div className="flex min-w-0 flex-1 items-end gap-3 pt-2">
          {shown.map((p, i) => (
            <FichaTab
              key={p.id}
              page={p}
              authorName={member(p.authorId).name}
              active={openId === p.id}
              fresh={isNew(p, now)}
              animate={isNew(p, now)}
              onOpen={() => openPage(p.id)}
              style={{ animationDelay: `${i * 40}ms` }}
            />
          ))}
          {more > 0 && (
            <button
              type="button"
              className="meta mb-px flex h-[82px] w-12 shrink-0 items-center justify-center rounded-ficha bg-panel text-ink-3 shadow-card hover:text-ink"
              aria-label={`Ver las ${more} fichas restantes`}
            >
              +{more}
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
      <span className="sr-only">Canal #{channel.name}</span>
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

export function Composer({ placeholder, compact = false }: { placeholder: string; compact?: boolean }) {
  return (
    <form
      className={cn(
        "rounded-[16px] bg-panel-2 ring-1 ring-line ring-inset transition-shadow focus-within:bg-panel focus-within:ring-2 focus-within:ring-sello",
        compact ? "mx-4 mt-2 mb-4" : "mx-4 mt-2 mb-4",
      )}
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="sr-only" htmlFor={`composer-${compact ? "thread" : "channel"}`}>
        {placeholder}
      </label>
      <textarea
        id={`composer-${compact ? "thread" : "channel"}`}
        rows={compact ? 1 : 2}
        placeholder={placeholder}
        className="block w-full resize-none bg-transparent px-4 pt-3 font-sans text-[14.5px] text-ink outline-none placeholder:text-ink-3"
      />
      <div className="flex items-center gap-0.5 px-2.5 pb-2">
        <IconButton label="Adjuntar">
          <path d="M8 3v10M3 8h10" />
        </IconButton>
        <IconButton label="Mencionar">
          <circle cx="8" cy="8" r="3" />
          <path d="M11 8v1.5a1.5 1.5 0 0 0 3 0V8a6 6 0 1 0-2.5 4.9" />
        </IconButton>
        <IconButton label="Archivar como ficha">
          <path d="M4 2h6l3 3v9H4z" />
          <path d="M10 2v3h3M6 8h5M6 11h5" />
        </IconButton>
        <button
          type="submit"
          aria-label="Enviar"
          className="ml-auto flex size-8 items-center justify-center rounded-full bg-ink text-panel outline-none hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-sello"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 13V3M4 7l4-4 4 4" />
          </svg>
        </button>
      </div>
    </form>
  )
}
