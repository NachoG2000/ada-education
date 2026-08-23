/* Modules: the pieces the teacher's Modules screen is made of.

   A module is a folder in the file: material goes in on the left of the desk,
   cards come out on the right, and the agent files a report about what it saw
   happen to the students. Nothing here decides anything on its own — the level
   is the teacher's, the recommendation is a checkbox the teacher accepts.

   `screens/Modules.tsx` assembles these; everything below reads the community
   from the context, the same way channel.tsx does. */

import { Fragment, useId, useMemo, useRef, useState, type ReactNode } from "react"
import { FileIcon, FileTextIcon, LinkIcon, PresentationIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatAgo, LEVEL_LABEL } from "@/lib/format"
import { isNew, useCommunity } from "@/lib/community"
import type { Agent, Card, Difficulty, DifficultyLevel, Material, Module, Report } from "@/lib/types"
import { Checkbox } from "@/components/ui/checkbox"
import { ErrorBoundary } from "./boundary"
import { CardTab, Cite, Pill } from "./card"
import { AgentFigure, MemberAvatar, presenceLabel } from "./identity"

/* ---- Small shared pieces ------------------------------------------------ */

const LEVELS: DifficultyLevel[] = ["intro", "core", "advanced"]
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })

/** The gray pill with the pulsing dot: the same indicator a compiling card
    wears (card.tsx → CardState), so "the agent is working" reads the same
    everywhere. `compact` is the density of a list row. */
export function CompilingPill({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <Pill tone="gray" className={cn(compact && "h-[19px] px-2 text-[11px]")}>
      <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-seal motion-reduce:animate-none" />
      {children}
    </Pill>
  )
}

/** A section of the module sheet. Four of these exist and no more: Difficulty ·
    Material · Cards · Reports. More air above the label than below it. */
function Section({ label, aside, children }: { label: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-9">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="label text-ink-2">{label}</h2>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** Meta parts separated by the dot the rest of the app uses. */
function Dotted({ children }: { children: ReactNode[] }) {
  return (
    <>
      {children.map((node, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span aria-hidden className="text-ink-4">
              ·
            </span>
          )}
          {node}
        </Fragment>
      ))}
    </>
  )
}

/* ---- The agent in the tab strip ----------------------------------------- */

/** Who compiles, and whether it's running. When the runner is off the strip
    says so in words: it's the reason nothing new shows up under Cards. */
export function AgentPresence({ agentId }: { agentId: string }) {
  const { community, presenceOf } = useCommunity()
  const agent = community.members.find((m): m is Agent => m.kind === "agent" && m.id === agentId)
  if (!agent) return null
  // presenceOf is the live one (the WS may have moved it since the snapshot).
  const live: Agent = { ...agent, presence: presenceOf(agentId) }
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-full bg-panel pr-3 pl-1.5 ring-1 ring-line ring-inset">
      <AgentFigure agent={live} size={22} presence />
      <span className="meta whitespace-nowrap text-ink-3">
        {live.presence === "away" ? `${agent.name}'s runner is off` : presenceLabel(live)}
      </span>
    </span>
  )
}

/* ---- Left column: the modules of the course ----------------------------- */

export function ModuleList({
  modules,
  selectedId,
  onSelect,
  className,
}: {
  modules: Module[]
  selectedId: string
  onSelect: (id: string) => void
  className?: string
}) {
  const { community } = useCommunity()
  /* Only the count is shown here: one pass over the cards per change, not a
     filter-and-sort per module per render. */
  const counts = useMemo(() => {
    const byChannel = new Map<string, number>()
    for (const c of community.cards) {
      if (c.base) continue
      byChannel.set(c.channelId, (byChannel.get(c.channelId) ?? 0) + 1)
    }
    return byChannel
  }, [community.cards])
  const rows = useRef(new Map<string, HTMLButtonElement | null>())

  const go = (index: number) => {
    const next = modules[Math.max(0, Math.min(modules.length - 1, index))]
    if (!next) return
    onSelect(next.id)
    rows.current.get(next.id)?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const at = modules.findIndex((m) => m.id === selectedId)
    const to =
      e.key === "ArrowDown" ? at + 1 : e.key === "ArrowUp" ? at - 1 : e.key === "Home" ? 0 : e.key === "End" ? modules.length - 1 : null
    if (to === null) return
    e.preventDefault()
    go(to)
  }

  return (
    <div
      role="listbox"
      aria-label="Course modules"
      aria-orientation="vertical"
      onKeyDown={onKeyDown}
      className={cn("w-[248px] shrink-0 overflow-y-auto rounded-bl-panel bg-panel-2 p-2", className)}
    >
      {modules.map((m) => {
        const cards = counts.get(m.channelId) ?? 0
        const selected = m.id === selectedId
        return (
          <button
            key={m.id}
            type="button"
            role="option"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            ref={(el) => {
              rows.current.set(m.id, el)
            }}
            onClick={() => onSelect(m.id)}
            className={cn(
              "mb-1 flex w-full flex-col items-start rounded-control px-3 py-2.5 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-seal",
              // Selected floats (Float Rule); it isn't marked with a rule down the side.
              selected ? "bg-panel shadow-card" : "hover:bg-panel-3",
            )}
          >
            <span className="flex w-full min-w-0 items-baseline gap-2">
              <span className="font-mono text-[11px] text-ink-3">{String(m.index).padStart(2, "0")}</span>
              <span className="min-w-0 truncate font-serif text-[14.5px] leading-[1.25] font-medium text-ink">{m.title}</span>
            </span>
            <span className="meta mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-ink-3">
              <Dotted>
                {[
                  ...(m.status === "compiling"
                    ? [<CompilingPill key="s" compact>Compiling</CompilingPill>]
                    : m.status === "empty"
                      ? [<span key="s">no material yet</span>]
                      : []),
                  <span key="c">{cards === 1 ? "1 card" : `${cards} cards`}</span>,
                  <span key="l">{m.difficulty.level}</span>,
                ]}
              </Dotted>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ---- Right column: the module sheet ------------------------------------- */

export function ModuleSheet({ module }: { module: Module }) {
  const { community, moduleCards, showChannel } = useCommunity()
  const channel = community.channels.find((c) => c.id === module.channelId)
  const cards = moduleCards(module.id)
  return (
    <article className="mx-auto max-w-[760px] px-7 py-6">
      <header>
        <h1 className="font-serif text-[25px] leading-[1.18] font-medium tracking-[-0.01em] text-ink">{module.title}</h1>
        <div className="meta mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-ink-3">
          <Dotted>
            {[
              <button
                key="ch"
                type="button"
                onClick={() => showChannel(module.channelId)}
                className="rounded-control font-medium text-ink-2 underline-offset-4 outline-none transition-colors hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-seal"
              >
                #{channel?.name ?? module.channelId}
              </button>,
              <span key="n">{cards.length === 1 ? "1 card" : `${cards.length} cards`}</span>,
            ]}
          </Dotted>
        </div>
        {module.revision && <p className="mt-2 font-sans text-[12.5px] leading-[1.4] text-ink-2">{module.revision}</p>}
        {module.summary && <p className="mt-3 max-w-[68ch] font-sans text-[14.5px] leading-[1.55] text-ink-2">{module.summary}</p>}
      </header>

      <DifficultySection module={module} />
      <MaterialSection module={module} />
      <ModuleCards cards={cards} />
      <ReportsSection module={module} />
    </article>
  )
}

/* ---- Difficulty --------------------------------------------------------- */

/** What the agent proposed, when it can be known: while nobody has set the
    level by hand, what's stored IS the suggestion (the server only overwrites
    `level` while `setBy` is empty). Once the teacher sets it, the suggestion
    survives only in the rationale, so we read the level it names — and when it
    names none, no suggestion is claimed. */
function suggestedLevel(d: Difficulty): DifficultyLevel | null {
  if (!d.suggestedBy) return null
  if (!d.setBy) return d.level
  const named = d.rationale ? /\b(intro|core|advanced)\b/i.exec(d.rationale) : null
  return named ? (named[1].toLowerCase() as DifficultyLevel) : null
}

export function DifficultySection({ module }: { module: Module }) {
  const { community, patchModule } = useCommunity()
  const [pending, setPending] = useState<DifficultyLevel | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { difficulty } = module
  // Optimistic: the pill moves on click and the server's `module.updated`
  // confirms it. If it rejects, the pill goes back and says why.
  const level = pending ?? difficulty.level
  const agent = community.members.find((m): m is Agent => m.kind === "agent" && m.id === difficulty.suggestedBy)
  const suggested = suggestedLevel(difficulty)
  const evidence = difficulty.evidence ?? []

  const set = async (next: DifficultyLevel) => {
    if (pending !== null || next === difficulty.level) return
    setPending(next)
    setError(null)
    try {
      await patchModule(module.id, { difficulty: { level: next } })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change the level.")
    } finally {
      setPending(null)
    }
  }

  return (
    <Section label="Difficulty">
      <div role="group" aria-label={`Difficulty of ${module.title}`} className="flex flex-wrap items-center gap-1.5">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={l === level}
            disabled={pending !== null}
            onClick={() => void set(l)}
            className={cn(
              "h-8 rounded-full px-3.5 font-sans text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-seal",
              l === level ? "bg-ink text-panel" : "bg-panel text-ink-2 ring-1 ring-line ring-inset hover:text-ink hover:ring-line-strong",
              pending !== null && "cursor-not-allowed opacity-70",
            )}
          >
            {LEVEL_LABEL[l]}
          </button>
        ))}
        {pending !== null && (
          <span role="status" className="meta ml-1 text-ink-3">
            Saving…
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2.5 font-sans text-[13px] leading-[1.45] text-alert-ink">
          {error}
        </p>
      )}

      {difficulty.rationale && (
        <p className="mt-4 flex items-start gap-2.5 font-sans text-[13.5px] leading-[1.5] text-ink-2">
          {agent && <AgentFigure agent={agent} size={20} className="mt-px" />}
          <span>
            {suggested ? (
              <>
                {agent?.name ?? "The agent"} suggests <strong className="font-semibold text-ink">{LEVEL_LABEL[suggested]}</strong> — {difficulty.rationale}
              </>
            ) : (
              <>
                {agent?.name ?? "The agent"} on {module.title} — {difficulty.rationale}
              </>
            )}
          </span>
        </p>
      )}

      {evidence.length > 0 && (
        <ul className={cn("mt-2.5 flex flex-col gap-1.5", agent && "pl-[30px]")}>
          {evidence.map((e, i) => (
            <li key={i} className="flex items-start gap-2 font-sans text-[13px] leading-[1.45] text-ink-2">
              <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ink-4" />
              <span>{e}</span>
            </li>
          ))}
        </ul>
      )}

      {suggested && suggested !== level && (
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => void set(suggested)}
          className={cn(
            "mt-3.5 inline-flex h-7 items-center rounded-full bg-ink px-3 font-sans text-[12.5px] font-medium text-panel outline-none transition-colors hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-seal",
            "disabled:cursor-not-allowed disabled:bg-ink-4 disabled:hover:bg-ink-4",
            agent && "ml-[30px]",
          )}
        >
          Use {LEVEL_LABEL[suggested]}
        </button>
      )}
    </Section>
  )
}

/* ---- Material ----------------------------------------------------------- */

const MATERIAL_ICON: Record<Material["kind"], typeof FileIcon> = {
  markdown: FileTextIcon,
  pdf: FileIcon,
  slides: PresentationIcon,
  link: LinkIcon,
}

const ACCEPT = ".md,.markdown,.pdf,.pptx,.key,.txt"

/** What the file is, by its extension. `null` = something the agent doesn't
    read, and we say so instead of filing it under a kind that isn't true. */
function kindOf(name: string): Material["kind"] | null {
  const dot = name.lastIndexOf(".")
  const ext = dot === -1 ? "" : name.slice(dot).toLowerCase()
  if (ext === ".md" || ext === ".markdown" || ext === ".txt") return "markdown"
  if (ext === ".pdf") return "pdf"
  if (ext === ".pptx" || ext === ".ppt" || ext === ".key") return "slides"
  return null
}

export function MaterialSection({ module }: { module: Module }) {
  const { uploadMaterial } = useCommunity()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [failed, setFailed] = useState<File | null>(null)

  const upload = async (file: File) => {
    const kind = kindOf(file.name)
    if (!kind) {
      setFailed(null)
      setError(`The agent reads markdown, PDF or slides. "${file.name}" isn't one of those.`)
      return
    }
    setError(null)
    setUploading(file.name)
    try {
      // Only text formats travel as text; a binary one is filed by name and the
      // server leaves a placeholder next to it.
      const text = kind === "markdown" ? await file.text() : undefined
      await uploadMaterial(module.id, { name: file.name, kind, size: file.size, text })
      setFailed(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload the file.")
      setFailed(file)
    } finally {
      setUploading(null)
    }
  }

  return (
    <Section
      label="Material"
      aside={module.status === "compiling" ? <CompilingPill>The agent is compiling cards…</CompilingPill> : undefined}
    >
      {module.materials.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1.5">
          {module.materials.map((m) => {
            const Glyph = MATERIAL_ICON[m.kind] ?? FileIcon
            return (
              <li key={m.id} className="flex items-center gap-2.5">
                <Glyph aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={1.6} />
                <span className="min-w-0 flex-1 truncate font-sans text-[13.5px] font-medium text-ink">{m.name}</span>
                <span className="meta shrink-0 text-ink-3">
                  <Dotted>
                    {[
                      ...(m.size ? [<span key="s">{Math.max(1, Math.round(m.size / 1024))} KB</span>] : []),
                      <span key="d">uploaded {DAY.format(new Date(m.uploadedAt))}</span>,
                    ]}
                  </Dotted>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {uploading && (
        <div className="mb-3 flex items-center gap-2.5">
          <FileTextIcon aria-hidden className="size-4 shrink-0 text-ink-4" strokeWidth={1.6} />
          <span className="min-w-0 flex-1 truncate font-sans text-[13.5px] font-medium text-ink-2">{uploading}</span>
          <Pill tone="gray">Uploading</Pill>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const file = e.dataTransfer.files[0]
          if (file) void upload(file)
        }}
        className={cn(
          "flex h-[72px] items-center gap-4 rounded-card px-4 transition-colors",
          over ? "bg-sun-soft" : "bg-panel-2",
        )}
      >
        <p className={cn("min-w-0 flex-1 font-sans text-[13.5px] leading-[1.45]", over ? "text-sun-ink" : "text-ink-2")}>
          Drop markdown, PDF or slides here — the agent reads them and compiles cards
        </p>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            // Cleared so choosing the same file twice fires again.
            e.target.value = ""
            if (file) void upload(file)
          }}
        />
        <button
          type="button"
          disabled={uploading !== null}
          onClick={() => input.current?.click()}
          className="h-8 shrink-0 rounded-full bg-panel px-4 font-sans text-[12.5px] font-medium text-ink shadow-card outline-none transition-colors hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-seal disabled:cursor-not-allowed disabled:text-ink-4"
        >
          Choose file
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2.5 flex flex-wrap items-center gap-2.5 font-sans text-[13px] leading-[1.45] text-alert-ink">
          <span>{error}</span>
          {failed && (
            <button
              type="button"
              onClick={() => void upload(failed)}
              className="h-7 rounded-full px-3 font-sans text-[12.5px] font-medium text-ink-2 outline-none transition-colors hover:bg-panel-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-seal"
            >
              Try again
            </button>
          )}
        </p>
      )}
    </Section>
  )
}

/* ---- Cards -------------------------------------------------------------- */

export function ModuleCards({ cards }: { cards: Card[] }) {
  const { authorName, openCard, panels, now } = useCommunity()
  /* One Sun Rule: several cards can be new at once, so the full yellow goes to
     the newest of them and the rest just say "New". */
  const newest = cards.reduce<Card | null>((best, c) => (isNew(c, now) && (!best || c.publishedAt > best.publishedAt) ? c : best), null)
  const openId = panels.find((p) => p.kind === "card")?.cardId
  return (
    <Section label="Cards">
      {cards.length === 0 ? (
        <p className="font-sans text-[13.5px] leading-[1.5] text-ink-3">
          No cards yet. Drop material above and the agent files the first ones.
        </p>
      ) : (
        <div className="-mb-3 flex flex-wrap items-end gap-3 gap-y-4 pb-3">
          {cards.map((c) => (
            <CardTab
              key={c.id}
              card={c}
              authorName={authorName(c.authorId)}
              active={openId === c.id}
              fresh={isNew(c, now)}
              sun={c.id === newest?.id}
              onOpen={() => openCard(c.id)}
              style={{ minWidth: 160 }}
            />
          ))}
        </div>
      )}
    </Section>
  )
}

/* ---- Reports ------------------------------------------------------------ */

export function ReportsSection({ module }: { module: Module }) {
  const { community } = useCommunity()
  const reports = useMemo(
    () => community.reports.filter((r) => r.moduleId === module.id).sort((a, b) => b.at.localeCompare(a.at)),
    [community.reports, module.id],
  )
  return (
    <Section label="Reports">
      {reports.length === 0 ? (
        <p className="font-sans text-[13.5px] leading-[1.5] text-ink-3">
          No reports yet. The agent files one when it advises a student on this module.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            /* Keyed by status too: when the server confirms the reconcile, the
               tile is rebuilt from the stored decision instead of keeping the
               half-edited local one. */
            <ErrorBoundary key={`${r.id}:${r.status}`} fallback={(e) => <TileBroken detail={e.message} />}>
              <ReportTile report={r} />
            </ErrorBoundary>
          ))}
        </div>
      )}
    </Section>
  )
}

function TileBroken({ detail }: { detail: string }) {
  return (
    <div className="rounded-card bg-panel-2 px-4 py-3.5">
      <p className="font-sans text-[13px] leading-[1.45] text-ink">
        This report can't be shown: it points at something that isn't in the course file.
      </p>
      <p className="meta mt-1 text-ink-3">{detail}</p>
    </div>
  )
}

function ReportTile({ report }: { report: Report }) {
  const { community, member, now, openCard, reconcileReport } = useCommunity()
  const uid = useId()
  const agent = member(report.agentId)
  const student = member(report.studentId)
  const done = report.status === "reconciled"

  const [accepted, setAccepted] = useState<string[]>(() => report.reconciled?.accepted ?? [])
  const [note, setNote] = useState(report.reconciled?.note ?? "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Guarded on purpose: a card id that doesn't resolve renders nothing instead
  // of throwing the whole tile away.
  const find = (id: string) => community.cards.find((c) => c.id === id)
  const based = report.cardIds.map(find).filter((c): c is Card => c !== undefined)
  const decision = report.reconciled ? find(report.reconciled.cardId) : undefined

  const apply = async () => {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await reconcileReport(report.id, { accepted, note: note.trim() })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't apply it to the module.")
    } finally {
      setPending(false)
    }
  }

  return (
    <article className="rounded-card bg-panel px-[18px] py-4 shadow-card">
      <div className="flex items-start gap-2.5">
        <MemberAvatar member={agent} size={22} className="mt-px" />
        <p className="min-w-0 flex-1 font-sans text-[13.5px] leading-[1.4] text-ink-2">
          <strong className="font-semibold text-ink">{agent.name}</strong> · about{" "}
          <strong className="font-semibold text-ink">{student.name}</strong> · <span className="text-ink-3">{formatAgo(report.at, now)}</span>
        </p>
        {done ? (
          <Pill tone="ok">Reconciled</Pill>
        ) : (
          <Pill tone="blue">New</Pill>
        )}
      </div>

      <p className="mt-3.5 font-sans text-[12px] leading-[1.3] text-ink-3">What I told {student.name}</p>
      {/* The agent's own writing: the reading voice, like a card. */}
      <p className="mt-1.5 font-serif text-[15px] leading-[1.55] text-ink">{report.told}</p>

      {based.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="meta text-ink-3">Based on</span>
          {based.map((c) => (
            <Cite key={c.id} card={c} onOpen={openCard} />
          ))}
        </div>
      )}

      {report.recommendations.length > 0 && (
        <>
          <p className="mt-4 font-sans text-[12px] leading-[1.3] text-ink-3">What I recommend for the module</p>
          <ul className="mt-2 flex flex-col gap-2">
            {report.recommendations.map((r) => {
              const id = `${uid}-${r.id}`
              const on = accepted.includes(r.id)
              return (
                <li key={r.id} className="flex items-start gap-2.5">
                  <Checkbox
                    id={id}
                    checked={on}
                    disabled={done || pending}
                    onCheckedChange={(next) => setAccepted((prev) => (next ? [...prev, r.id] : prev.filter((x) => x !== r.id)))}
                    className="mt-[3px] focus-visible:ring-2 focus-visible:ring-seal"
                  />
                  <label
                    htmlFor={id}
                    className={cn("font-sans text-[13.5px] leading-[1.45]", done && !on ? "text-ink-3 line-through" : "text-ink")}
                  >
                    {r.text}
                  </label>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {done ? (
        <>
          {report.reconciled?.note && <p className="mt-3.5 font-serif text-[15px] leading-[1.55] text-ink">{report.reconciled.note}</p>}
          {decision && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="meta text-ink-3">Filed as</span>
              <Cite card={decision} onOpen={openCard} />
            </div>
          )}
        </>
      ) : (
        <>
          <label className="sr-only" htmlFor={`${uid}-note`}>
            Your note on {student.name}'s report
          </label>
          <textarea
            id={`${uid}-note`}
            rows={2}
            value={note}
            disabled={pending}
            placeholder="Your note — what stays a learning goal, what changes"
            onChange={(e) => {
              setNote(e.target.value)
              if (error) setError(null)
            }}
            className="mt-3.5 block w-full resize-none rounded-control bg-panel-2 px-3 py-2 font-sans text-[13.5px] leading-[1.45] text-ink ring-1 ring-line ring-inset outline-none transition-colors placeholder:text-ink-3 focus-visible:ring-2 focus-visible:ring-seal disabled:opacity-70"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || (accepted.length === 0 && note.trim() === "")}
              title={accepted.length === 0 && note.trim() === "" ? "Accept a recommendation or write a note first" : undefined}
              onClick={() => void apply()}
              className="h-8 rounded-full bg-ink px-4 font-sans text-[12.5px] font-medium text-panel outline-none transition-colors hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-seal disabled:cursor-not-allowed disabled:bg-ink-4 disabled:hover:bg-ink-4"
            >
              {pending ? "Applying…" : "Apply to module"}
            </button>
            {error && (
              <p role="alert" className="font-sans text-[13px] leading-[1.45] text-alert-ink">
                {error}
              </p>
            )}
          </div>
        </>
      )}
    </article>
  )
}
