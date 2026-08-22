/* Panel contextual (stack): Thread y Ficha. */

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { isAgent, isNew, useCommunity, type Panel } from "@/lib/community"
import type { Page } from "@/lib/types"
import { Composer } from "./channel"
import { FloatingButton, Folder, FolderTab } from "./folder"
import { PageState, Pill, Tab } from "./ficha"
import { MemberAvatar, agentInk } from "./identity"
import { Markdown } from "./markdown"
import { MessageRow } from "./message"

export function PanelStack() {
  const { panels, closePanel, popPanel, page, thread, message, member } = useCommunity()
  if (panels.length === 0) return null
  const top = panels[0]

  const tabLabel = (p: Panel) =>
    p.kind === "thread" ? `Thread · ${member(message(thread(p.threadId).rootMessageId).authorId).name}` : page(p.pageId).title

  return (
    <Folder
      tabs={panels.map((p, i) => (
        <FolderTab
          key={p.kind === "thread" ? p.threadId : p.pageId}
          active={i === 0}
          onClick={() => i !== 0 && popPanel()}
          icon={p.kind === "thread" ? <ThreadGlyph /> : <FichaGlyph />}
        >
          {tabLabel(p)}
        </FolderTab>
      ))}
      actions={
        <FloatingButton label="Cerrar panel" onClick={closePanel}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </FloatingButton>
      }
    >
      {top.kind === "thread" ? <ThreadPanel threadId={top.threadId} /> : <FichaPanel pageId={top.pageId} />}
    </Folder>
  )
}

/* ---- Thread ------------------------------------------------------------ */

function ThreadPanel({ threadId }: { threadId: string }) {
  const { thread, message, page, member, openPage } = useCommunity()
  const th = thread(threadId)
  const root = message(th.rootMessageId)
  const published = th.publishedPageId ? page(th.publishedPageId) : null

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-4 mt-2 rounded-card bg-panel-2 px-1 py-1">
          <MessageRow message={root} showThreadLink={false} className="hover:bg-transparent" />
        </div>
        <p className="meta px-7 pt-4 pb-1 text-ink-3">
          {th.replyIds.length} {th.replyIds.length === 1 ? "respuesta" : "respuestas"}
        </p>
        <div className="flex flex-col gap-0.5 px-1 pb-2">
          {th.replyIds.map((id) => (
            <MessageRow key={id} message={message(id)} compact showThreadLink={false} />
          ))}
        </div>
        {published && <PublishedCard page={published} authorName={member(published.authorId).name} onOpen={() => openPage(published.id)} />}
      </div>
      <Composer compact placeholder="Responder en el thread…" />
    </>
  )
}

/** Cierre del thread: la ficha que quedó archivada. */
function PublishedCard({ page, authorName, onOpen }: { page: Page; authorName: string; onOpen: () => void }) {
  return (
    <div className="mx-4 mt-2 mb-4">
      <div className="flex items-end pl-1.5">
        <Tab type={page.type} size="sm" />
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 rounded-card rounded-tl-none bg-panel px-4 py-3 text-left shadow-card outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-sello"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-serif text-[15.5px] font-medium text-ink">{page.title}</span>
            <Pill tone="ok" animate>
              Archivada
            </Pill>
          </span>
          <span className="meta mt-1 block text-ink-3">
            Publicada como {page.type} · v{page.version} · {authorName}
          </span>
        </span>
        <span className="shrink-0 font-sans text-[12.5px] font-semibold text-ink">Abrir →</span>
      </button>
    </div>
  )
}

/* ---- Ficha (documento) ------------------------------------------------- */

function FichaPanel({ pageId }: { pageId: string }) {
  const { page, member, me, community, now } = useCommunity()
  const p = page(pageId)
  const author = member(p.authorId)
  const fresh = isNew(p, now)
  const replaced = p.replaces ? community.pages.find((x) => x.id === p.replaces) : null
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
            <Tab type={p.type} />
          </div>
          <div className={cn("rounded-card rounded-tl-none shadow-card", fresh ? "bg-sol" : "bg-panel-2")}>
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-start justify-between gap-3">
                <h2
                  className={cn("font-serif text-[25px] leading-[1.18] font-medium tracking-[-0.01em] text-balance", fresh ? "text-sol-ink" : "text-ink")}
                  style={{ fontVariationSettings: '"opsz" 24' }}
                >
                  {p.title}
                </h2>
                {fresh && <Pill tone="ink">Nueva</Pill>}
              </div>
            </div>
          </div>
          <dl ref={sourcesRef} className="mx-0 mt-4 grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5 border-b border-line pb-4">
            <Row k="Autor">
              <span className="flex items-center gap-2.5">
                <MemberAvatar member={author} size={isAgent(author) ? 40 : 24} />
                <span className="flex flex-col">
                  <span className="font-medium" style={isAgent(author) ? { color: agentInk(author) } : undefined}>
                    {author.name}
                  </span>
                  {isAgent(author) && (
                    <span className="meta text-ink-3">
                      {author.scope === "personal"
                        ? `agente personal · de ${member(author.createdBy).name}`
                        : `agente de la comunidad · creado por ${member(author.createdBy).name}`}
                    </span>
                  )}
                </span>
              </span>
            </Row>
            <Row k="Versión">
              <span className="font-mono text-[12px]">v{p.version}</span>
              <span className="meta ml-1.5 text-ink-3">
                · {new Date(p.publishedAt).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
              </span>
              {p.state && p.state !== "nueva" && (
                <span className="ml-2">
                  <PageState page={p} />
                </span>
              )}
            </Row>
            <Row k="Fuentes">
              <span className="flex flex-col gap-1">
                {p.sources.map((s) => (
                  <span key={s.ref} data-source-ref={s.kind === "mensaje" ? `msg-${s.ref}` : undefined} className="inline-flex items-center gap-1.5 text-ink-2">
                    <span aria-hidden className="text-ink-4">{s.kind === "mensaje" ? "↳" : "▤"}</span>
                    <span>{s.label}</span>
                  </span>
                ))}
              </span>
            </Row>
            {replaced && (
              <Row k="Reemplaza a">
                <span className="font-serif text-[13.5px] text-ink-3 line-through decoration-alerta/70">{replaced.title}</span>
              </Row>
            )}
            <Row k="Visible para">
              <Pill tone="gris">{p.visibility === "canal" ? "miembros del canal" : "solo vos"}</Pill>
            </Row>
          </dl>
          <div className="px-0 pt-5 pb-6">
            <Markdown source={p.body} />
          </div>
        </div>
      </article>

      <footer className="flex items-center gap-1 border-t border-line px-3 py-2.5">
        <Action active={xray} onClick={() => setXray((v) => !v)}>
          Ver fuentes
        </Action>
        <Action disabled={!mine} title={mine ? undefined : "Solo el autor puede editar"}>
          Editar
        </Action>
        <Action>Archivar en otro canal</Action>
        <Action className="ml-auto">Historial</Action>
      </footer>
      {xray && <XRay rootRef={sourcesRef} />}
    </>
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
  title,
  className,
}: {
  children: React.ReactNode
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  title?: string
  className?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 rounded-full px-3 font-sans text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sello",
        active ? "bg-ink text-panel" : "text-ink-2 hover:bg-panel-2 hover:text-ink",
        disabled && "cursor-not-allowed text-ink-4 hover:bg-transparent hover:text-ink-4",
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ---- Rayos X de fuentes: líneas desde la ficha hasta los mensajes de origen ---- */

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
            <circle cx={l.x2} cy={l.y2} r="4" fill="var(--color-sol)" stroke="currentColor" strokeWidth="1.5" />
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
function FichaGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
      <path d="M2.5 7h11" />
    </svg>
  )
}
