import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** The shared frame for routed management pages, including Settings and Agents. */
export function PageScroller({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <main className="size-full min-w-0 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8"><div className={cn("w-full", wide ? "max-w-6xl" : "max-w-3xl")}>{children}</div></main>
}

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="flex flex-wrap items-start justify-between gap-4" data-slot="page-header"><div className="min-w-0 flex-1 basis-60"><h1 className="text-page font-semibold">{title}</h1><p className="mt-1 max-w-[68ch] text-sm leading-5 text-muted-foreground">{description}</p></div>{action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}</header>
}

export function NavigationItem({ active, icon, label, onClick }: { active?: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-current={active ? "page" : undefined} data-slot="navigation-item" className={cn("flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 aria-[current=page]:hover:bg-sidebar-accent dark:aria-[current=page]:hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring", active && "bg-sidebar-accent font-medium")}><span aria-hidden className="flex size-4 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-4 [&>svg]:stroke-2">{icon}</span><span className="min-w-0 flex-1 truncate">{label}</span></button>
}

/** Same structure for ordinary and destructive settings actions. */
export function ActionSection({ title, description, action, destructive = false }: { title: string; description: ReactNode; action: ReactNode; destructive?: boolean }) {
  return <section data-slot="action-section" className={cn("flex flex-wrap items-start justify-between gap-4 rounded-lg border p-4", destructive && "border-destructive/40")}><div className="min-w-0 flex-1 basis-48"><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p></div>{action}</section>
}
