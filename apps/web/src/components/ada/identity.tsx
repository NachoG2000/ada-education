/* Identity: people = pastel circles with initials; agents = flat procedural figures (solid silhouette, two eyes). */

import { useId, useMemo } from "react"
import { cn } from "@/lib/utils"
import { BODY, figureParams, silhouette, type FigureParams } from "@/lib/figure"
import type { Agent, Member, Person, Presence } from "@/lib/types"

/* ---- Presence ------------------------------------------------------------ */

/* The four `Presence` states look distinct, not two:
   - away: gray, still (an away agent is a runner that isn't running);
   - online: solid green, still;
   - thinking / publishing: the pulsing blue dot, the same indicator that
     "Compiling" uses in card.tsx. It's a state change, so it may animate;
     `motion-reduce` turns it off (DESIGN.md → animations). */
const PRESENCE_DOT: Record<Presence, string> = {
  online: "bg-status-active",
  away: "bg-ink-4",
  thinking: "bg-seal animate-pulse motion-reduce:animate-none",
  publishing: "bg-seal animate-pulse motion-reduce:animate-none",
}

/** The presence dot attached to an avatar. */
export function PresenceDot({ presence, className }: { presence: Presence; className?: string }) {
  return <span aria-hidden className={cn("absolute right-0 bottom-0 block size-2 rounded-full ring-2 ring-panel", PRESENCE_DOT[presence], className)} />
}

/** The same dot, but inline with its text: thread header, agent sheet. */
export function PresenceTag({ member, className }: { member: Member; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", PRESENCE_DOT[member.presence])} />
      {presenceLabel(member)}
    </span>
  )
}

export const PRESENCE_LABEL: Record<Presence, string> = {
  online: "online",
  away: "away",
  thinking: "thinking…",
  publishing: "filing a card",
}

/** How each presence reads depending on whose it is: for an agent, "away" means its runner isn't running. */
export function presenceLabel(member: Member) {
  if (member.kind === "agent" && member.presence === "away") return "disconnected"
  return PRESENCE_LABEL[member.presence]
}

/* ---- Person -------------------------------------------------------------- */

/* People's cardstock colors come from `Person.tone` (the field exists exactly
   for this) and paint with system tokens. No pair uses a tab color: the Tab
   Rule reserves the `tab-*` set for the folded tab and a citation's dot.
   Initials are always in ink; the tone lives in the background. */
const PERSON_TONE: Record<Person["tone"], string> = {
  card: "bg-panel text-ink ring-1 ring-line-strong ring-inset",
  cardstock: "bg-panel-3 text-ink",
  "seal-soft": "bg-seal-soft text-ink",
  "red-soft": "bg-alert-soft text-ink",
}

export function PersonAvatar({
  person,
  size = 28,
  presence = false,
  className,
}: {
  person: Person
  size?: number
  presence?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-sans font-semibold",
        // unknown tone (data from an old server): cardstock, which never clashes
        PERSON_TONE[person.tone] ?? PERSON_TONE.cardstock,
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-label={person.name}
    >
      {person.initials}
      {presence && <PresenceDot presence={person.presence} />}
    </span>
  )
}

/* ---- Agent figure (flat, minimal) -------------------------------------- */

export function Figure({ params, size = 32, className }: { params: FigureParams; size?: number; className?: string }) {
  const uid = useId().replace(/:/g, "")
  const maskId = `m${uid}`
  // The silhouette is pure geometry derived from params: recomputing it on
  // every render rebuilds the whole SVG mask without a single pixel changing.
  const { shapes, cuts } = useMemo(() => silhouette(params), [params])
  const eyeY = BODY.y + params.eyes.y * BODY.h
  const gap = params.eyes.gap * BODY.w
  const er = params.eyes.r * 100
  const cx = BODY.x + BODY.w / 2

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={cn("block overflow-visible", className)} aria-hidden>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="-20" y="-20" width="140" height="140">
          {shapes.map((sh, i) =>
            sh.kind === "rect" ? (
              <rect key={i} x={sh.x} y={sh.y} width={sh.w} height={sh.h} rx={sh.r} fill="#fff" />
            ) : sh.kind === "circle" ? (
              <circle key={i} cx={sh.cx} cy={sh.cy} r={sh.r} fill="#fff" />
            ) : (
              <path key={i} d={sh.d} fill="#fff" />
            ),
          )}
          {cuts.map((c, i) =>
            c.kind === "circle" ? (
              <circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} fill="#000" />
            ) : (
              <rect key={`c${i}`} x={c.x} y={c.y} width={c.w} height={c.h} rx={c.r} fill="#000" />
            ),
          )}
        </mask>
      </defs>
      <rect x="-20" y="-20" width="140" height="140" fill={params.color} mask={`url(#${maskId})`} />
      <circle cx={cx - gap / 2} cy={eyeY} r={er} fill="#15151a" />
      <circle cx={cx + gap / 2} cy={eyeY} r={er} fill="#15151a" />
    </svg>
  )
}

export function AgentFigure({
  agent,
  size = 32,
  presence = false,
  className,
}: {
  agent: Agent
  size?: number
  presence?: boolean
  className?: string
}) {
  const params = useMemo(() => figureParams(agent.figureSeed ?? agent.id, agent.figureColor), [agent.figureSeed, agent.id, agent.figureColor])
  // Disconnected: the figure dims but stays readable. No animation.
  const dimmed = presence && agent.presence === "away"
  return (
    <span
      className={cn("relative inline-block shrink-0 align-middle", className)}
      style={{ width: size, height: size }}
      aria-label={presence ? `${agent.name}, agent · ${presenceLabel(agent)}` : `${agent.name}, agent`}
      role="img"
    >
      <Figure params={params} size={size} className={cn(dimmed && "opacity-55")} />
      {presence && <PresenceDot presence={agent.presence} />}
    </span>
  )
}

export function MemberAvatar({
  member,
  size,
  presence,
  className,
}: {
  member: Person | Agent
  size?: number
  presence?: boolean
  className?: string
}) {
  return member.kind === "agent" ? (
    <AgentFigure agent={member} size={size} presence={presence} className={className} />
  ) : (
    <PersonAvatar person={member} size={size} presence={presence} className={className} />
  )
}

/** Member name: people in ink; agents in their tint. */
export function MemberName({ member, className }: { member: Person | Agent; className?: string }) {
  return (
    <span className={cn("font-sans text-[13.5px] font-semibold text-ink", className)} style={member.kind === "agent" ? { color: agentInk(member) } : undefined}>
      {member.name}
    </span>
  )
}

/** Agent ink: the readable version of its color, for its name. */
export function agentInk(agent: Agent) {
  return figureParams(agent.figureSeed ?? agent.id, agent.figureColor).ink
}
