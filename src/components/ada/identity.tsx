/* Identidad: personas = círculos pastel con iniciales; agentes = personajes procedurales planos (silueta sólida, dos ojos). */

import { useId, useMemo } from "react"
import { cn } from "@/lib/utils"
import { BODY, figureParams, silhouette, type FigureParams } from "@/lib/figure"
import type { Agent, Person, Presence } from "@/lib/types"

export function PresenceDot({ presence, className }: { presence: Presence; className?: string }) {
  const on = presence !== "ausente"
  return (
    <span
      aria-hidden
      className={cn(
        "absolute right-0 bottom-0 block size-2 rounded-full ring-2 ring-panel",
        on ? "bg-estado-activo" : "bg-ink-4",
        className,
      )}
    />
  )
}

/* ---- Persona ------------------------------------------------------------ */

const PERSON_TONES = [
  ["#ffe3ec", "#8a2e55"],
  ["#e3ecff", "#2b4fa8"],
  ["#e1f5e8", "#1f6b3c"],
  ["#fff0c9", "#7a5a00"],
  ["#ece3ff", "#52399c"],
  ["#ffe8d6", "#9a4f0a"],
] as const

function toneFor(name: string) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PERSON_TONES[h % PERSON_TONES.length]
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
  const [bg, fg] = toneFor(person.name)
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full font-sans font-semibold", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: bg, color: fg }}
      aria-label={person.name}
    >
      {person.initials}
      {presence && <PresenceDot presence={person.presence} />}
    </span>
  )
}

/* ---- Personaje de agente (plano, minimalista) ------------------------- */

export function Figure({ params, size = 32, className }: { params: FigureParams; size?: number; className?: string }) {
  const uid = useId().replace(/:/g, "")
  const maskId = `m${uid}`
  const { shapes, cuts } = silhouette(params)
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
  return (
    <span
      className={cn("relative inline-block shrink-0 align-middle", className)}
      style={{ width: size, height: size }}
      aria-label={`${agent.name}, agente`}
      role="img"
    >
      <Figure params={params} size={size} />
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

/** Nombre de miembro: personas en tinta; agentes en su tono. */
export function MemberName({ member, className }: { member: Person | Agent; className?: string }) {
  return (
    <span className={cn("font-sans text-[13.5px] font-semibold text-ink", className)} style={member.kind === "agent" ? { color: agentInk(member) } : undefined}>
      {member.name}
    </span>
  )
}

export const PRESENCE_LABEL: Record<Presence, string> = {
  "en-linea": "en línea",
  ausente: "ausente",
  pensando: "pensando…",
  publicando: "archivando una ficha",
}

/** Tinta del agente: la versión legible de su color, para su nombre. */
export function agentInk(agent: Agent) {
  return figureParams(agent.figureSeed ?? agent.id, agent.figureColor).ink
}
