/* Fichas: pestaña plegada por tipo, pills de estado, ficha en la fila, cita inline, ficha como mensaje. */

import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { Page, PageType } from "@/lib/types"
import { PAGE_TYPE_LABEL } from "@/lib/demo"

export const TAB_BG: Record<PageType, string> = {
  apunte: "bg-tab-apunte",
  consigna: "bg-tab-consigna",
  decision: "bg-tab-decision",
  respuesta: "bg-tab-respuesta",
  entrega: "bg-tab-entrega",
}
export const TAB_INK: Record<PageType, string> = {
  apunte: "text-tab-apunte-ink",
  consigna: "text-tab-consigna-ink",
  decision: "text-tab-decision-ink",
  respuesta: "text-tab-respuesta-ink",
  entrega: "text-tab-entrega-ink",
}
export const TAB_DOT: Record<PageType, string> = {
  apunte: "bg-tab-apunte-ink",
  consigna: "bg-tab-consigna-ink",
  decision: "bg-tab-decision-ink",
  respuesta: "bg-tab-respuesta-ink",
  entrega: "bg-tab-entrega-ink",
}

export const TAB_FILL: Record<PageType, string> = {
  apunte: "fill-tab-apunte",
  consigna: "fill-tab-consigna",
  decision: "fill-tab-decision",
  respuesta: "fill-tab-respuesta",
  entrega: "fill-tab-entrega",
}

/** Pestaña: el tipo de ficha como lengüeta con borde derecho curvo (misma familia que las lengüetas de panel). */
export function Tab({ type, className, size = "md" }: { type: PageType; className?: string; size?: "sm" | "md" }) {
  const h = size === "md" ? 22 : 18
  const w = size === "md" ? 16 : 13
  return (
    <span
      className={cn(
        "label relative inline-flex items-center rounded-tl-[8px] font-semibold",
        size === "md" ? "pr-1.5 pl-3 text-[10.5px]" : "pr-1 pl-2.5 text-[10px]",
        TAB_BG[type],
        TAB_INK[type],
        className,
      )}
      style={{ height: h, marginRight: w - 2 }}
    >
      {PAGE_TYPE_LABEL[type]}
      <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={cn("pointer-events-none absolute top-0 left-full", TAB_FILL[type])}>
        <path d={`M0 0 C ${w * 0.55} 0 ${w * 0.45} ${h} ${w} ${h} L 0 ${h} Z`} />
      </svg>
    </span>
  )
}

/* ---- Pills de estado ----------------------------------------------------- */

type PillTone = "sol" | "ok" | "gris" | "azul" | "alerta" | "ink"

const PILL: Record<PillTone, string> = {
  sol: "bg-sol text-sol-ink",
  ok: "bg-ok text-ok-ink",
  gris: "bg-panel-3 text-ink-2",
  azul: "bg-sello-soft text-sello",
  alerta: "bg-alerta-soft text-alerta",
  ink: "bg-ink text-panel",
}

export function Pill({
  children,
  tone = "gris",
  animate = false,
  className,
  style,
}: {
  children: ReactNode
  tone?: PillTone
  animate?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <span className={cn("pill", PILL[tone], animate && "animate-sellar", className)} style={style}>
      {children}
    </span>
  )
}

/** Estado de la ficha como pill. */
export function PageState({ page, animate, fresh = true }: { page: Page; animate?: boolean; fresh?: boolean }) {
  if (!page.state) return null
  if (page.state === "nueva")
    return fresh ? (
      <Pill tone="sol" animate={animate}>
        Nueva
      </Pill>
    ) : null
  if (page.state === "actualizada") return <Pill tone="azul">Actualizada · v{page.version}</Pill>
  if (page.state === "reemplazada")
    return (
      <Pill tone="gris" className="line-through">
        Reemplazada
      </Pill>
    )
  return (
    <Pill tone="gris">
      <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-sello" />
      Compilando
    </Pill>
  )
}

/* ---- Ficha en la fila del canal ------------------------------------------ */

export function FichaTab({
  page,
  authorName,
  active = false,
  fresh = false,
  animate = false,
  onOpen,
  style,
}: {
  page: Page
  authorName: string
  active?: boolean
  fresh?: boolean
  animate?: boolean
  onOpen?: () => void
  style?: CSSProperties
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={style}
      className={cn(
        "group relative flex min-w-0 flex-1 basis-0 max-w-[224px] flex-col rounded-ficha text-left outline-none transition-transform duration-200 ease-out-expo hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-sello",
        animate && "animate-archivar",
      )}
      aria-current={active ? "true" : undefined}
    >
      <span className="flex items-end justify-between pl-1">
        <Tab type={page.type} size="sm" />
      </span>
      <span
        className={cn(
          "relative flex h-[82px] flex-col justify-between rounded-ficha rounded-tl-none px-3.5 pt-2.5 pb-2.5 shadow-card transition-shadow",
          fresh ? "bg-sol" : "bg-panel",
          active && "ring-2 ring-ink",
          page.base && "bg-panel-2 shadow-none ring-1 ring-inset ring-line-strong",
        )}
      >
        <span className={cn("line-clamp-2 font-serif text-[14.5px] leading-[18px] font-medium", fresh ? "text-sol-ink" : "text-ink")}>
          {page.title}
        </span>
        <span className={cn("meta flex items-center gap-1.5", fresh ? "text-sol-ink/80" : "text-ink-3")}>
          <span className="font-mono text-[11px]">v{page.version}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{authorName}</span>
          {fresh && <span className="ml-auto font-semibold">Nueva</span>}
          {page.state && page.state !== "nueva" && (
            <span className="ml-auto">
              <PageState page={page} />
            </span>
          )}
        </span>
      </span>
    </button>
  )
}

/* ---- Cita inline: pill con el punto del tipo ----------------------------- */

export function Cite({ page, section, onOpen }: { page: Page; section?: string; onOpen?: (pageId: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(page.id)}
      className={cn(
        "group/cite mx-0.5 inline-flex h-6 max-w-full items-center gap-1.5 rounded-full bg-panel-2 pr-2.5 pl-2 align-[-6px] outline-none ring-1 ring-line ring-inset transition-colors",
        "hover:bg-panel-3 hover:ring-line-strong focus-visible:ring-2 focus-visible:ring-sello",
      )}
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", TAB_DOT[page.type])} />
      <span className="truncate font-serif text-[13.5px] leading-none text-ink">{page.title}</span>
      {section && <span className="font-mono text-[10.5px] text-ink-3">{section}</span>}
    </button>
  )
}

/* ---- Ficha publicada como mensaje ---------------------------------------- */

export function FichaCard({
  page,
  authorName,
  sourcesCount,
  onOpen,
  animate = false,
  fresh = false,
}: {
  page: Page
  authorName: string
  sourcesCount: number
  onOpen?: () => void
  animate?: boolean
  fresh?: boolean
}) {
  return (
    <div className={cn("relative mt-2 w-[520px] max-w-full", animate && "animate-archivar")}>
      <div className="flex items-end pl-2">
        <Tab type={page.type} />
      </div>
      <div className={cn("rounded-card rounded-tl-none shadow-card", fresh ? "bg-sol" : "bg-panel")}>
        <div className="flex items-center justify-between gap-4 px-4 pt-3.5 pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className={cn("truncate font-serif text-[19px] leading-tight font-medium", fresh ? "text-sol-ink" : "text-ink")}>{page.title}</span>
              {fresh && (
                <Pill tone="ink" animate={animate}>
                  Nueva
                </Pill>
              )}
            </div>
            <div className={cn("meta mt-1.5 flex items-center gap-1.5", fresh ? "text-sol-ink/80" : "text-ink-3")}>
              <span className="font-mono text-[11px]">v{page.version}</span>
              <span aria-hidden>·</span>
              <span>{authorName}</span>
              <span aria-hidden>·</span>
              <span>
                {sourcesCount} {sourcesCount === 1 ? "fuente" : "fuentes"}
              </span>
              <span aria-hidden>·</span>
              <span>{page.visibility === "canal" ? "miembros del canal" : "solo vos"}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="h-8 shrink-0 rounded-full bg-ink px-3.5 text-[12.5px] font-medium text-panel outline-none hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-sello"
          >
            Abrir
          </button>
        </div>
      </div>
    </div>
  )
}
