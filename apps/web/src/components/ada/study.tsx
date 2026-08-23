/* Study: the pieces of the student's page.

   Two voices on one screen (DESIGN.md → Three Voices): the feedback is a
   document — a white sheet floating on the panel, titled and read in Literata,
   with the score in Geist Mono because a score is a number, not a sentence. The
   modules and the conversation are Inter: they are operated, not read.

   Nothing here reaches into the provider: the screen resolves ids, guards the
   lookups that can miss and hands these components the objects. A card that
   doesn't resolve degrades to its text, never to a throw. */

import { type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatAgo, LEVEL_LABEL } from "@/lib/format"
import { CardTab, Cite, Pill } from "@/components/ada/card"
import { AgentFigure, agentInk } from "@/components/ada/identity"
import type { Agent, Card, Feedback, Module } from "@/lib/types"

/* ---- Small parts -------------------------------------------------------- */

/** Section caption inside the study sheet. Inter, small, not uppercase: `.label`
    is for the app's furniture; this is a heading inside a document. More air
    above than below, so the caption belongs to what follows it. */
export function StudySection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("mt-7", className)}>
      <h3 className="mb-2.5 font-sans text-[12px] font-semibold text-ink-3">{title}</h3>
      {children}
    </section>
  )
}

/** Quiet block for "there is nothing here yet". Flat on panel-2: it isn't a
    thing you can touch, so it doesn't float (Float Rule). */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-card bg-panel-2 px-4 py-3.5 font-sans text-[13.5px] leading-[1.5] text-ink-2">{children}</p>
}

/** Error-boundary fallback: says what broke, in the same block shape as an
    empty state, so a broken piece never leaves a hole. */
export function StudyBroken({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-card bg-panel-2 px-4 py-3.5">
      <p className="font-sans text-[13.5px] font-semibold text-ink">{title}</p>
      <p className="mt-1 font-sans text-[12.5px] leading-[1.4] text-ink-2">{detail}</p>
    </div>
  )
}

/* ---- The feedback document ---------------------------------------------- */

export function FeedbackTile({
  feedback,
  agent,
  agentName,
  assignmentTitle,
  now,
  /* One Sun Rule: the screen decides that this — and nothing else on it —
     wears the yellow, and only while the feedback is less than a day old. */
  fresh,
  cardOf,
  onOpenCard,
}: {
  feedback: Feedback
  agent?: Agent
  agentName: string
  assignmentTitle: string
  now: Date
  fresh: boolean
  /** guarded lookup: an id the snapshot can't resolve comes back undefined */
  cardOf: (id: string | undefined) => Card | undefined
  onOpenCard: (cardId: string) => void
}) {
  return (
    <article aria-label={`Feedback on ${assignmentTitle}`} className="overflow-hidden rounded-card bg-panel shadow-card">
      <header className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-5 py-3.5", fresh && "bg-sun")}>
        {agent && <AgentFigure agent={agent} size={22} />}
        <p className={cn("min-w-0 font-sans text-[13.5px] leading-[1.35]", fresh ? "text-sun-ink" : "text-ink-2")}>
          <span className={cn("font-semibold", !fresh && "text-ink")} style={!fresh && agent ? { color: agentInk(agent) } : undefined}>
            {agentName}
          </span>
          {" · feedback on "}
          <span className={cn("font-semibold", !fresh && "text-ink")}>{assignmentTitle}</span>
          {" · "}
          {formatAgo(feedback.at, now)}
        </p>
        {fresh && (
          /* On the yellow strip the "New" pill goes white: a sun pill on sun
             would be invisible, and sun-ink on white is the same voice. */
          <span className="pill ml-auto bg-panel text-sun-ink">New</span>
        )}
      </header>

      <div className="px-5 pt-4 pb-5">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
          <p className="shrink-0">
            <span className="font-mono text-[28px] leading-none font-medium text-ink">{feedback.score.got}</span>
            <span className="font-sans text-[13.5px] text-ink-3"> / {feedback.score.of}</span>
          </p>
          <p className="max-w-[60ch] min-w-0 font-serif text-[15.5px] leading-[1.6] text-ink">{feedback.summary}</p>
        </div>

        {feedback.strengths.length > 0 && (
          <StudySection title="What went well">
            <ul className="flex flex-col gap-2">
              {feedback.strengths.map((strength, i) => (
                <li key={i} className="flex gap-2.5 font-sans text-[14.5px] leading-[1.45] text-ink">
                  <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ok-ink" />
                  <span className="min-w-0">{strength}</span>
                </li>
              ))}
            </ul>
          </StudySection>
        )}

        {feedback.gaps.length > 0 && (
          <StudySection title="Where it slipped">
            <ul className="flex flex-col gap-3">
              {feedback.gaps.map((gap, i) => {
                const card = cardOf(gap.cardId)
                return (
                  <li key={`${gap.moduleId}-${i}`} className="font-sans text-[14.5px] leading-[1.5] text-ink">
                    <span className="mr-2 inline-flex h-[22px] items-center rounded-pill bg-panel px-2.5 align-[-5px] font-mono text-[11px] text-ink-2 ring-1 ring-line ring-inset">
                      {gap.moduleId}
                    </span>
                    {gap.note}
                    {card && (
                      <>
                        {" "}
                        <span className="meta text-ink-3">reread</span> <Cite card={card} onOpen={onOpenCard} />
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          </StudySection>
        )}

        {feedback.nextSteps.length > 0 && (
          <StudySection title="Next steps">
            <ol className="flex flex-col gap-2.5">
              {feedback.nextSteps.map((step, i) => {
                const card = cardOf(step.cardId)
                return (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-[3px] w-3 shrink-0 font-mono text-[11px] text-ink-3">{i + 1}</span>
                    <span className="min-w-0 font-sans text-[14.5px] leading-[1.5] text-ink">
                      {step.text}
                      {card && (
                        <>
                          {" "}
                          <Cite card={card} onOpen={onOpenCard} />
                        </>
                      )}
                    </span>
                  </li>
                )
              })}
            </ol>
          </StudySection>
        )}
      </div>
    </article>
  )
}

/* ---- Modules ------------------------------------------------------------- */

/** Where the student stands on a module, read off the latest feedback:
    `slipped` = a gap names it · `done` = before the first slip · `ahead` = after
    it · `unknown` = nothing graded yet, so the page claims nothing. */
export type ModuleState = "slipped" | "done" | "ahead" | "unknown"

export function ModuleRow({
  module,
  state,
  expanded,
  cards,
  authorNameOf,
  isCardOpen,
  onToggle,
  onOpenCard,
}: {
  module: Module
  state: ModuleState
  expanded: boolean
  /** the module's cards, oldest first; only read while expanded */
  cards: Card[]
  authorNameOf: (id: string) => string
  isCardOpen: (id: string) => boolean
  onToggle: () => void
  onOpenCard: (cardId: string) => void
}) {
  const bodyId = `study-module-${module.id}`
  return (
    <li>
      {/* The whole row is the control: "Learn it" is the emphasis a slipped
          module gets, not a second target inside the first one. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={expanded ? bodyId : undefined}
        className="group flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left outline-none transition-colors hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-seal"
      >
        <span className="w-5 shrink-0 font-mono text-[11px] text-ink-3">{String(module.index).padStart(2, "0")}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-[14.5px] leading-[1.3] font-medium text-ink">{module.title}</span>
          <span className="meta mt-0.5 block text-ink-3">{LEVEL_LABEL[module.difficulty.level] ?? module.difficulty.level}</span>
        </span>
        {state === "slipped" ? (
          <>
            <Pill tone="gray">slipped</Pill>
            <span className="inline-flex h-7 shrink-0 items-center rounded-pill bg-ink px-3.5 font-sans text-[12.5px] font-medium text-panel transition-colors group-hover:bg-ink/85">
              {expanded ? "Hide cards" : "Learn it"}
            </span>
          </>
        ) : (
          state !== "unknown" && <span className="meta shrink-0 text-ink-3">{state === "done" ? "done ✓" : "ahead"}</span>
        )}
        <ChevronDown
          aria-hidden
          size={15}
          className={cn("shrink-0 text-ink-3 transition-transform duration-200 ease-out-expo motion-reduce:transition-none", expanded && "rotate-180")}
        />
      </button>
      {expanded && (
        <div id={bodyId} className="px-3 pt-1 pb-3">
          {cards.length === 0 ? (
            <EmptyNote>No cards filed for this module yet.</EmptyNote>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {cards.map((card) => (
                <CardTab
                  key={card.id}
                  card={card}
                  authorName={authorNameOf(card.authorId)}
                  active={isCardOpen(card.id)}
                  onOpen={() => onOpenCard(card.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  )
}

/* ---- The conversation column -------------------------------------------- */

export function ConversationHeader({ agent, note }: { agent: Agent; note: string }) {
  return (
    <header className="flex items-center gap-2.5 px-[18px] py-4">
      <AgentFigure agent={agent} size={26} presence />
      <span className="min-w-0">
        <span className="block truncate font-sans text-[13.5px] leading-tight font-semibold" style={{ color: agentInk(agent) }}>
          {agent.name}
        </span>
        <span className="meta mt-0.5 block truncate text-ink-3">{note}</span>
      </span>
    </header>
  )
}

/** Only while the runner is thinking: the same pulsing blue dot the compiling
    pill uses, so "something is happening" reads the same everywhere. */
export function ThinkingLine({ name }: { name: string }) {
  return (
    <p role="status" className="flex items-center gap-2 px-[18px] pt-1 font-sans text-[12.5px] text-ink-3">
      <span aria-hidden className="size-1.5 shrink-0 animate-pulse rounded-full bg-seal motion-reduce:animate-none" />
      {name} is thinking…
    </p>
  )
}
