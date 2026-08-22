/* Cards: folded tab by type, status pills, card in the row, inline citation, card as a message. */

import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { Card, CardType } from "@/lib/types"
import { CARD_TYPE_LABEL } from "@/lib/demo"

export const TAB_BG: Record<CardType, string> = {
  note: "bg-tab-note",
  assignment: "bg-tab-assignment",
  decision: "bg-tab-decision",
  answer: "bg-tab-answer",
  submission: "bg-tab-submission",
}
export const TAB_INK: Record<CardType, string> = {
  note: "text-tab-note-ink",
  assignment: "text-tab-assignment-ink",
  decision: "text-tab-decision-ink",
  answer: "text-tab-answer-ink",
  submission: "text-tab-submission-ink",
}
export const TAB_DOT: Record<CardType, string> = {
  note: "bg-tab-note-ink",
  assignment: "bg-tab-assignment-ink",
  decision: "bg-tab-decision-ink",
  answer: "bg-tab-answer-ink",
  submission: "bg-tab-submission-ink",
}

export const TAB_FILL: Record<CardType, string> = {
  note: "fill-tab-note",
  assignment: "fill-tab-assignment",
  decision: "fill-tab-decision",
  answer: "fill-tab-answer",
  submission: "fill-tab-submission",
}

/** Tab: the card type as a tab with a curved right edge (same family as the panel tabs). */
export function Tab({ type, className, size = "md" }: { type: CardType; className?: string; size?: "sm" | "md" }) {
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
      {CARD_TYPE_LABEL[type]}
      <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={cn("pointer-events-none absolute top-0 left-full", TAB_FILL[type])}>
        <path d={`M0 0 C ${w * 0.55} 0 ${w * 0.45} ${h} ${w} ${h} L 0 ${h} Z`} />
      </svg>
    </span>
  )
}

/* ---- Status pills ----------------------------------------------------- */

type PillTone = "sun" | "ok" | "gray" | "blue" | "alert" | "ink"

const PILL: Record<PillTone, string> = {
  sun: "bg-sun text-sun-ink",
  ok: "bg-ok text-ok-ink",
  gray: "bg-panel-3 text-ink-2",
  blue: "bg-seal-soft text-seal",
  alert: "bg-alert-soft text-alert",
  ink: "bg-ink text-panel",
}

export function Pill({
  children,
  tone = "gray",
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
    <span className={cn("pill", PILL[tone], animate && "animate-seal", className)} style={style}>
      {children}
    </span>
  )
}

/** Card state as a pill. */
export function CardState({ card, animate, fresh = true }: { card: Card; animate?: boolean; fresh?: boolean }) {
  if (!card.state) return null
  if (card.state === "new")
    return fresh ? (
      <Pill tone="sun" animate={animate}>
        New
      </Pill>
    ) : null
  if (card.state === "updated") return <Pill tone="blue">Updated · v{card.version}</Pill>
  if (card.state === "superseded")
    return (
      <Pill tone="gray" className="line-through">
        Superseded
      </Pill>
    )
  return (
    <Pill tone="gray">
      <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-seal motion-reduce:animate-none" />
      Compiling
    </Pill>
  )
}

/* ---- Card in the channel row ------------------------------------------ */

export function CardTab({
  card,
  authorName,
  active = false,
  fresh = false,
  animate = false,
  onOpen,
  style,
}: {
  card: Card
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
        "group relative flex min-w-0 flex-1 basis-0 max-w-[224px] flex-col rounded-card-tab text-left outline-none transition-transform duration-200 ease-out-expo hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-seal",
        animate && "animate-archive",
      )}
      aria-current={active ? "true" : undefined}
    >
      <span className="flex items-end justify-between pl-1">
        <Tab type={card.type} size="sm" />
      </span>
      <span
        className={cn(
          "relative flex h-[82px] flex-col justify-between rounded-card-tab rounded-tl-none px-3.5 pt-2.5 pb-2.5 shadow-card transition-shadow",
          fresh ? "bg-sun" : "bg-panel",
          active && "ring-2 ring-ink",
          card.base && "bg-panel-2 shadow-none ring-1 ring-inset ring-line-strong",
        )}
      >
        <span className={cn("line-clamp-2 font-serif text-[14.5px] leading-[18px] font-medium", fresh ? "text-sun-ink" : "text-ink")}>
          {card.title}
        </span>
        <span className={cn("meta flex items-center gap-1.5", fresh ? "text-sun-ink" : "text-ink-3")}>
          <span className="font-mono text-[11px]">v{card.version}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{authorName}</span>
          {fresh && <span className="ml-auto font-semibold">New</span>}
          {card.state && card.state !== "new" && (
            <span className="ml-auto">
              <CardState card={card} />
            </span>
          )}
        </span>
      </span>
    </button>
  )
}

/* ---- Inline citation: pill with the type's dot ----------------------------- */

export function Cite({ card, section, onOpen }: { card: Card; section?: string; onOpen?: (cardId: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(card.id)}
      className={cn(
        "group/cite mx-0.5 inline-flex h-6 max-w-full items-center gap-1.5 rounded-full bg-panel-2 pr-2.5 pl-2 align-[-6px] outline-none ring-1 ring-line ring-inset transition-colors",
        "hover:bg-panel-3 hover:ring-line-strong focus-visible:ring-2 focus-visible:ring-seal",
      )}
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", TAB_DOT[card.type])} />
      <span className="truncate font-serif text-[13.5px] leading-none text-ink">{card.title}</span>
      {section && <span className="font-mono text-[10.5px] text-ink-3">{section}</span>}
    </button>
  )
}

/* ---- Card published as a message ---------------------------------------- */

export function CardMessage({
  card,
  authorName,
  sourcesCount,
  onOpen,
  animate = false,
  fresh = false,
}: {
  card: Card
  authorName: string
  sourcesCount: number
  onOpen?: () => void
  animate?: boolean
  fresh?: boolean
}) {
  return (
    <div className={cn("relative mt-2 w-[520px] max-w-full", animate && "animate-archive")}>
      <div className="flex items-end pl-2">
        <Tab type={card.type} />
      </div>
      <div className="rounded-card rounded-tl-none bg-panel shadow-card">
        <div className="flex items-center justify-between gap-4 px-4 pt-3.5 pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="truncate font-serif text-[19px] leading-tight font-medium text-ink">{card.title}</span>
              {fresh && (
                <Pill tone="sun" animate={animate}>
                  New
                </Pill>
              )}
            </div>
            <div className="meta mt-1.5 flex items-center gap-1.5 text-ink-3">
              <span className="font-mono text-[11px]">v{card.version}</span>
              <span aria-hidden>·</span>
              <span>{authorName}</span>
              <span aria-hidden>·</span>
              <span>
                {sourcesCount} {sourcesCount === 1 ? "source" : "sources"}
              </span>
              <span aria-hidden>·</span>
              <span>{card.visibility === "channel" ? "channel members" : "only you"}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="h-8 shrink-0 rounded-full bg-ink px-3.5 text-[12.5px] font-medium text-panel outline-none hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-seal"
          >
            Open
          </button>
        </div>
      </div>
    </div>
  )
}
