/* Folder: a panel with tabs on top (the active one merges with the body) and actions floating to the right.
   The tab ends in a soft curve (like a folder's or a browser's), not a straight cut. */

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const TAB_H = 36
const CURVE_W = 26

export function FolderTab({
  active = false,
  onClick,
  icon,
  children,
  className,
}: {
  active?: boolean
  onClick?: () => void
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      style={{ height: TAB_H, marginRight: CURVE_W - 4 }}
      className={cn(
        "group/tab relative flex max-w-[260px] shrink-0 items-center gap-2 rounded-tl-xl pr-2 pl-4 font-sans text-[13.5px] outline-none transition-colors",
        active ? "bg-panel font-semibold text-ink" : "bg-panel/55 font-medium text-ink-3 hover:bg-panel hover:text-ink",
        "focus-visible:bg-panel focus-visible:text-ink focus-visible:underline focus-visible:decoration-seal focus-visible:underline-offset-4",
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
      {/* curved right edge, same color as the tab */}
      <svg
        aria-hidden
        width={CURVE_W}
        height={TAB_H}
        viewBox={`0 0 ${CURVE_W} ${TAB_H}`}
        className={cn(
          "pointer-events-none absolute top-0 left-full transition-colors",
          active ? "fill-panel" : "fill-panel/55 group-hover/tab:fill-panel group-focus-visible/tab:fill-panel",
        )}
      >
        <path d={`M0 0 C ${CURVE_W * 0.55} 0 ${CURVE_W * 0.45} ${TAB_H} ${CURVE_W} ${TAB_H} L 0 ${TAB_H} Z`} />
      </svg>
    </button>
  )
}

/** Folder frame: tab strip + floating actions, and the white body below. */
export function Folder({ tabs, actions, children, className }: { tabs: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-full min-h-0 min-w-0 flex-col", className)}>
      <div className="flex shrink-0 items-end" style={{ height: TAB_H }}>
        <div className="flex min-w-0 items-end">{tabs}</div>
        {actions && <div className="ml-auto flex shrink-0 items-center gap-1.5 pb-0.5 pl-3">{actions}</div>}
      </div>
      <div className="panel flex min-h-0 min-w-0 flex-1 flex-col rounded-tl-none">{children}</div>
    </div>
  )
}

/** Floating button for the tab strip: flat white pill with a hairline, no shadow. */
export function FloatingButton({ label, onClick, children, className }: { label: string; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full bg-panel px-2.5 text-ink-3 ring-1 ring-line ring-inset outline-none transition-colors hover:text-ink hover:ring-line-strong focus-visible:ring-2 focus-visible:ring-seal",
        className,
      )}
    >
      {children}
    </button>
  )
}
