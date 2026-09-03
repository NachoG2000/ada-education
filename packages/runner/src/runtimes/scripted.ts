/* Scripted runtime: answers mentions without a model.

   Same protocol, same folder, same wiki → card pipeline as the `claude`
   runtime; only the "thinking" is different. Every answer is a template filled
   with live community state (module titles, material headings, the student's
   feedback gaps, the difficulty the teacher set), so the demo reads as a
   member of the course and not as a canned string. What it can't fill from
   state it says it can't (`DECISIONS.md` §18).

   It never fabricates a citation: a `[[path]]` is only written for a card that
   exists in the wiki or that this run just wrote. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve, sep } from "node:path"
import type {
  Assignment,
  Card,
  CommunitySnapshot,
  Feedback,
  Member,
  Message,
  Module,
  ModuleSuggestInput,
  ReportCreateInput,
} from "@ada/protocol"

/* ---- Types ------------------------------------------------------------------ */

export type Mention = {
  channelId: string
  threadId?: string
  message: Message
  from: Member
  context: Message[]
  intent?: "ingest" | "plan" | "question"
  moduleId?: string
}

export type ScriptedJob = {
  mention: Mention
  snapshot: CommunitySnapshot
  /** the agent's id (folder name) */
  agentId: string
  /** the agent's display name */
  agentName: string
  wikiDir: string
  rawDir: string
  now: Date
}

/** Things to do once the answer and the cards it wrote are on the server. */
export type AfterAction =
  | { type: "module.suggest"; payload: ModuleSuggestInput }
  | { type: "report.create"; payload: ReportCreateInput }
  | { type: "message"; channelId: string; text: string }

export type ScriptedResult = {
  intent: "ingest" | "plan" | "question"
  /** chat text; `[[wiki/path.md|label]]` become citations */
  answer: string
  /** wiki paths written by this run (relative to wiki/) */
  wrote: string[]
  /** computed after publishing, with the card ids the server assigned to what was written */
  after: (published: Record<string, string>) => AfterAction[]
}

/* ---- Small helpers ------------------------------------------------------------ */

export function messageText(m: Message): string {
  return m.paragraphs.map((p) => p.map((b) => b.text).join("")).join("\n\n")
}

/** Deterministic 1.2–2.5 s "thinking" delay per message, so reruns look the same. */
export function thinkingDelay(seed: string): number {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const unit = ((h >>> 0) % 1000) / 1000
  return Math.round(1200 + unit * 1300)
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "section"
}

function firstSentence(markdown: string): string {
  const plain = markdown
    .replace(/^#+\s.*$/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
  const m = /^(.+?[.!?])(\s|$)/.exec(plain)
  return (m ? m[1] : plain.slice(0, 140)).trim()
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9σ'′\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
}

function teacherOf(snapshot: CommunitySnapshot): Member | undefined {
  return snapshot.members.find((m) => m.kind === "person" && m.role === "teacher")
}

function teachersChannel(snapshot: CommunitySnapshot, agentId: string): string | undefined {
  const teacher = teacherOf(snapshot)
  const named = snapshot.channels.find((c) => c.name === "teachers" || c.id === "teachers")
  if (named) return named.id
  if (!teacher) return undefined
  return snapshot.channels.find(
    (c) => c.group === "course" && c.memberIds.includes(teacher.id) && c.memberIds.includes(agentId) && c.memberIds.every((id) => id === teacher.id || id === agentId),
  )?.id
}

/** Cards of a module: the agent's cards in the module's channel, oldest first, base documents excluded. */
function moduleCards(snapshot: CommunitySnapshot, module: Module): Card[] {
  return snapshot.cards
    .filter((c) => c.channelId === module.channelId && !c.base && c.path)
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
}

function cite(card: Card): string {
  return `[[${card.path}|${card.title}]]`
}

/** The module a message talks about: by id, by index ("03"), by slug, by title words, or by channel. */
function findModule(snapshot: CommunitySnapshot, text: string, hint?: string, channelId?: string): Module | undefined {
  const modules = snapshot.modules
  if (hint) {
    const byHint = modules.find((m) => m.id === hint)
    if (byHint) return byHint
  }
  const lower = text.toLowerCase()
  for (const m of modules) {
    if (lower.includes(m.id.toLowerCase())) return m
  }
  for (const m of modules) {
    if (new RegExp(`\\b${m.slug.toLowerCase()}\\b`).test(lower)) return m
    if (new RegExp(`\\bmodule\\s*0?${m.index}\\b`).test(lower) || new RegExp(`\\b0?${m.index}-`).test(lower)) return m
  }
  for (const m of modules) {
    const titleWords = words(m.title)
    if (titleWords.length && titleWords.every((w) => lower.includes(w))) return m
  }
  if (channelId) {
    const byChannel = modules.find((m) => m.channelId === channelId)
    if (byChannel) return byChannel
  }
  return undefined
}

function latestFeedback(snapshot: CommunitySnapshot, studentId: string): Feedback | undefined {
  return [...snapshot.feedback].filter((f) => f.studentId === studentId).sort((a, b) => b.at.localeCompare(a.at))[0]
}

function assignmentOf(snapshot: CommunitySnapshot, id?: string): Assignment | undefined {
  return id ? snapshot.assignments.find((a) => a.id === id) : undefined
}

/* ---- Intent ------------------------------------------------------------------- */

const PLAN = /\b(get ahead|advance|prioriti[sz]e|priorit|plan|catch up|improve|what should i (do|study|read)|how (do|can|should) i)\b/i

export function detectIntent(job: ScriptedJob): { intent: ScriptedResult["intent"]; module?: Module } {
  const { mention, snapshot } = job
  const text = messageText(mention.message)
  const stripped = text.replace(/@\w+/g, " ").trim()
  if (mention.intent === "ingest" || /^\s*ingest\b/i.test(stripped) || /\bingest\b/i.test(stripped)) {
    return { intent: "ingest", module: findModule(snapshot, stripped, mention.moduleId, mention.channelId) }
  }
  const privateChannel = snapshot.channels.find((c) => c.id === mention.channelId)?.group === "private"
  const named = findModule(snapshot, stripped, mention.moduleId)
  if (mention.intent === "plan" || (PLAN.test(stripped) && (named || privateChannel))) {
    const fb = latestFeedback(snapshot, mention.from.id)
    const fromGap = fb?.gaps[0] ? snapshot.modules.find((m) => m.id === fb.gaps[0].moduleId) : undefined
    return { intent: "plan", module: named ?? fromGap }
  }
  return { intent: "question", module: named ?? findModule(snapshot, "", undefined, mention.channelId) }
}

/* ---- Wiki writing --------------------------------------------------------------- */

function writeCard(job: ScriptedJob, path: string, meta: { title: string; type: string; channel: string; sources: string[]; published: string }, body: string): string {
  const full = join(job.wikiDir, path)
  mkdirSync(dirname(full), { recursive: true })
  const front = [
    "---",
    `title: ${meta.title}`,
    `type: ${meta.type}`,
    `channel: ${meta.channel}`,
    `published: ${meta.published}`,
    "sources:",
    ...meta.sources.map((s) => `  - ${s}`),
    "---",
  ].join("\n")
  writeFileSync(full, `${front}\n${body.trim()}\n`)
  return path
}

function appendLog(job: ScriptedJob, line: string) {
  const file = join(job.wikiDir, "log.md")
  const stamp = job.now.toISOString().slice(0, 10)
  const prev = existsSync(file) ? readFileSync(file, "utf8").replace(/\s+$/, "") : "# Log"
  writeFileSync(file, `${prev}\n- ${stamp} · ${line}\n`)
}

function addToIndex(job: ScriptedJob, entries: Array<{ path: string; title: string; summary: string }>) {
  const file = join(job.wikiDir, "index.md")
  const prev = existsSync(file) ? readFileSync(file, "utf8").replace(/\s+$/, "") : "# Index"
  const lines = entries.filter((e) => !prev.includes(e.path)).map((e) => `- ${e.path} — ${e.title}: ${e.summary}`)
  if (lines.length) writeFileSync(file, `${prev}\n${lines.join("\n")}\n`)
}

/* ---- Ingest: material → topic cards ---------------------------------------------- */

type Section = { heading: string; body: string }

function splitSections(markdown: string): Section[] {
  const text = markdown.replace(/\r\n/g, "\n").replace(/^#\s+.*\n/, "")
  const parts = text.split(/^##\s+/m)
  const sections: Section[] = []
  for (const part of parts.slice(1)) {
    const nl = part.indexOf("\n")
    const heading = (nl === -1 ? part : part.slice(0, nl)).trim()
    const body = (nl === -1 ? "" : part.slice(nl + 1)).trim()
    if (heading && body.length > 40) sections.push({ heading, body })
  }
  if (sections.length) return sections.slice(0, 4)
  // No headings: three cards out of the paragraphs, in reading order.
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 40)
  const names = ["What it is", "How it works", "Where it breaks"]
  const per = Math.max(1, Math.ceil(paras.length / 3))
  return names
    .map((heading, i) => ({ heading, body: paras.slice(i * per, (i + 1) * per).join("\n\n") }))
    .filter((s) => s.body)
}

function levelFor(markdown: string, sections: Section[]): { level: ModuleSuggestInput["difficulty"]["level"]; why: string } {
  const advanced = (markdown.match(/\b(proof|theorem|lemma|jacobian|hessian|tensor|convergence|eigen)/gi) ?? []).length
  const core = (markdown.match(/\b(derivative|gradient|matrix|matrices|vector|chain rule|partial|backprop)/gi) ?? []).length
  const wordsCount = markdown.split(/\s+/).length
  if (advanced >= 3) return { level: "advanced", why: `it leans on ${advanced} formal notions (proofs, Jacobians or tensors) across ${sections.length} sections` }
  if (core >= 4 || wordsCount > 1400) return { level: "core", why: `it assumes derivatives and matrix notation from the first section and runs ${wordsCount} words over ${sections.length} sections` }
  return { level: "intro", why: `it stays with one idea per section and needs no calculus beyond what the course already used` }
}

function cohortEvidence(snapshot: CommunitySnapshot, module: Module): string[] {
  const students = snapshot.members.filter((m) => m.kind === "person" && m.role === "student")
  const gaps = snapshot.feedback.filter((f) => f.gaps.some((g) => g.moduleId === module.id))
  const out: string[] = []
  if (gaps.length && students.length) {
    const assignment = assignmentOf(snapshot, gaps[0].assignmentId)
    const note = gaps[0].gaps.find((g) => g.moduleId === module.id)?.note ?? "the same step"
    out.push(`${gaps.length} of ${students.length} students slipped on "${firstSentence(note)}" in ${assignment?.title ?? "the last assignment"}`)
  }
  const prev = snapshot.modules.find((m) => m.index === module.index - 1)
  if (prev) out.push(`Module ${String(prev.index).padStart(2, "0")} (${prev.title}) is marked ${prev.difficulty.level}; this one builds on it`)
  return out
}

function runIngest(job: ScriptedJob, module: Module | undefined): ScriptedResult {
  const { mention, snapshot } = job
  if (!module) {
    return {
      intent: "ingest",
      answer: `I can ingest material, but I don't know which module this is for. Mention me in the module's channel or say the module id (for example "ingest into 03-backprop").`,
      wrote: [],
      after: () => [],
    }
  }
  const text = messageText(mention.message)
  const named = module.materials.find((m) => text.includes(m.name))
  const material = named ?? [...module.materials].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0]
  if (!material) {
    return {
      intent: "ingest",
      answer: `#${module.id} has no material yet. Drop a file on the module in Modules and I'll compile the cards from it.`,
      wrote: [],
      after: () => [{ type: "module.suggest", payload: { moduleId: module.id, status: "empty", difficulty: { level: module.difficulty.level, rationale: "No material to read yet.", evidence: [] } } }],
    }
  }
  // Same resolve+prefix guard the sync applies: `material.path` comes from
  // the server's snapshot, which is a different trust domain.
  const rawRoot = resolve(job.rawDir)
  const file = resolve(job.rawDir, material.path)
  if (!file.startsWith(rawRoot + sep)) {
    return {
      intent: "ingest",
      answer: `I can't read ${material.name}: its path points outside the course's raw folder.`,
      wrote: [],
      after: () => [],
    }
  }
  const markdown = existsSync(file) ? readFileSync(file, "utf8") : `# ${material.name}\n\n${material.name} was uploaded but I couldn't read it as text.`
  const sections = splitSections(markdown)
  const published = job.now.toISOString()
  const wrote: string[] = []
  const entries: Array<{ path: string; title: string; summary: string }> = []
  const existing = new Set(moduleCards(snapshot, module).map((c) => c.path))
  for (const s of sections) {
    let path = `modules/${module.id}/${slugify(s.heading)}.md`
    if (existing.has(path)) path = `modules/${module.id}/${slugify(s.heading)}-${slugify(material.name.replace(/\.[a-z]+$/i, ""))}.md`
    const body = `${s.body}\n\n## In one line\n\n${firstSentence(s.body)}`
    writeCard(job, path, { title: s.heading, type: "topic", channel: module.channelId, sources: [`raw/${material.path}`], published }, body)
    wrote.push(path)
    entries.push({ path, title: s.heading, summary: firstSentence(s.body) })
  }
  addToIndex(job, entries)
  appendLog(job, `ingested ${material.name} into ${module.id}: ${wrote.length} cards`)

  const { level, why } = levelFor(markdown, sections)
  const evidence = cohortEvidence(snapshot, module)
  const rationale = `Reading ${material.name}, ${why}.`
  // One card per line: inline pills separated by commas read badly in the channel.
  const list = wrote.map((p, i) => `${wrote.length > 1 ? "- " : ""}[[${p}|${sections[i].heading}]]`).join("\n")
  const keep = module.difficulty.setBy ? ` You set it to ${module.difficulty.level} by hand, so I left that alone.` : ""
  const answer = [
    `Filed ${wrote.length} ${wrote.length === 1 ? "card" : "cards"} from ${material.name} into #${module.id}:`,
    list,
    `Difficulty: I'd mark this module ${level} — ${why}.${evidence.length ? ` Cohort signal: ${evidence[0]}.` : ""}${keep} You can change it in Modules → ${module.title}.`,
  ].join("\n\n")

  return {
    intent: "ingest",
    answer,
    wrote,
    after: () => [
      {
        type: "module.suggest",
        payload: { moduleId: module.id, status: "ready", difficulty: { level, rationale, evidence } },
      },
    ],
  }
}

/* ---- Plan: feedback + module cards → prioritized steps ---------------------------- */

function runPlan(job: ScriptedJob, module: Module | undefined): ScriptedResult {
  const { mention, snapshot } = job
  const student = mention.from
  const teacher = teacherOf(snapshot)
  const fb = latestFeedback(snapshot, student.id)
  if (!module) {
    const known = snapshot.modules.map((m) => `#${m.id}`).join(", ")
    return {
      intent: "plan",
      answer: `Happy to plan it with you — which module? I have ${known}.${fb?.gaps[0] ? ` Your last feedback points at #${fb.gaps[0].moduleId}, if that's the one.` : ""}`,
      wrote: [],
      after: () => [],
    }
  }
  const cards = moduleCards(snapshot, module)
  const gap = fb?.gaps.find((g) => g.moduleId === module.id) ?? fb?.gaps[0]
  const assignment = assignmentOf(snapshot, fb?.assignmentId)
  const gapCard =
    (gap?.cardId && cards.find((c) => c.id === gap.cardId)) ||
    (gap && cards.find((c) => words(gap.note).some((w) => c.title.toLowerCase().includes(w)))) ||
    cards[0]
  const rest = cards.filter((c) => c.id !== gapCard?.id)
  const afterGap = gapCard ? cards.slice(cards.indexOf(gapCard) + 1) : rest
  const second = afterGap[0] ?? rest[0]
  const third = afterGap[1] ?? rest[1]

  if (!cards.length) {
    return {
      intent: "plan",
      answer: `#${module.id} has no cards yet, so there's nothing to order. Ask ${teacher?.name ?? "the teacher"} to drop the material on the module and I'll file the cards first.`,
      wrote: [],
      after: () => [],
    }
  }

  const gapLine = (gap ? firstSentence(gap.note) : `the parts of ${module.title} you haven't used yet`).replace(/[.:]$/, "")
  const steps: string[] = []
  if (gapCard) steps.push(`Reread ${cite(gapCard)} first — ${gap ? `that's exactly where ${assignment?.title ?? "your last assignment"} slipped: ${gapLine}` : "it's the card the rest of the module leans on"}.`)
  if (second) steps.push(`Then work ${cite(second)} by hand, with numbers, before touching any matrix form${module.difficulty.level !== "intro" ? ` — this module is marked ${module.difficulty.level}, so the by-hand pass is the step people skip and regret` : ""}.`)
  if (third) steps.push(`Only then ${cite(third)}: it reads as a summary once the two above are yours.`)
  steps.push(
    assignment
      ? `Redo the exercise from ${assignment.title} that went wrong and compare with your submission. If the numbers match, you're ahead of the module, not behind it.`
      : `Pick one exercise from the module and redo it end to end; that's the check that you're ahead.`,
  )
  const intro = fb
    ? `You asked how to get ahead in ${module.title}. Your feedback on ${assignment?.title ?? "your last assignment"} says ${fb.strengths[0] ? `${fb.strengths[0].replace(/\.$/, "").toLowerCase()} and ` : ""}the slip was ${gapLine.replace(/\.$/, "").toLowerCase()} — so the plan starts there, not at the top of the module.`
    : `You asked how to get ahead in ${module.title}. I don't have feedback from you on file yet, so this is the module's own order.`
  const closing = teacher
    ? `I shared a summary of this plan with ${teacher.name}, so the module can improve too — what I recommended, not your messages.`
    : `I filed this plan as a card so you can come back to it.`
  const answer = [intro, ...steps.map((s, i) => `${i + 1}. ${s}`), closing].join("\n\n")

  // The plan itself becomes a card in the private channel: citable, versioned.
  const path = `questions/plan-${student.id}-${module.id}.md`
  const body = [
    `## Why this order`,
    ``,
    intro,
    ``,
    ...steps.map((s, i) => `${i + 1}. ${s.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "**$1**")}`),
    ``,
    `## Check`,
    ``,
    `If the redone exercise matches the card's numbers, the gap is closed. If not, the difference is the next question to ask in #questions.`,
  ].join("\n")
  writeCard(job, path, { title: `Plan for ${student.name}: get ahead in ${module.title}`, type: "question", channel: mention.channelId, sources: [mention.message.id], published: job.now.toISOString() }, body)
  appendLog(job, `plan for ${student.name} in ${module.id} (gap: ${gap ? firstSentence(gap.note) : "none on file"})`)

  const mentionsDerivative = gap ? /σ|sigma|derivative|′|'/.test(gap.note) : false
  const recommendations = mentionsDerivative && gapCard
    ? [
        { id: "r1", text: `Add a worked scalar example before the vectorized form in "${gapCard.title}"` },
        { id: "r2", text: `State the derivative of the activation explicitly (σ′(z), not σ(z)) and call out the slip by name` },
        { id: "r3", text: `List partial derivatives as a prerequisite of ${module.id} and point at the refresher` },
      ]
    : [
        { id: "r1", text: gapCard ? `Add a worked example on "${gapLine.replace(/\.$/, "")}" to "${gapCard.title}"` : `Add a worked example at the start of ${module.title}` },
        { id: "r2", text: gapCard ? `Give "${gapCard.title}" a short "where this goes wrong" section` : `Add a "where this goes wrong" card to ${module.id}` },
        { id: "r3", text: `Mark the prerequisites of ${module.id} explicitly on the module` },
      ]
  const told = `${student.name} asked how to get ahead in ${module.title}. I pointed at ${gapCard ? `"${gapCard.title}"` : "the module's first card"} first${gap ? ` — that's where ${assignment?.title ?? "the last assignment"} slipped ("${gapLine}")` : ""} — then ${second ? `"${second.title}" by hand` : "the next card"}${third ? `, then "${third.title}"` : ""}, and to redo the exercise that went wrong as the check.`
  const teachers = teachersChannel(snapshot, job.agentId)

  return {
    intent: "plan",
    answer,
    wrote: [path],
    after: (published) => {
      const planId = published[path]
      const actions: AfterAction[] = [
        {
          type: "report.create",
          payload: {
            studentId: student.id,
            moduleId: module.id,
            ...(assignment ? { assignmentId: assignment.id } : {}),
            told,
            recommendations,
            cardIds: [planId, gapCard?.id].filter((id): id is string => Boolean(id)),
          },
        },
      ]
      if (teachers && teacher) {
        actions.push({
          type: "message",
          channelId: teachers,
          text: `I just wrote ${student.name} a plan to get ahead in #${module.id}: ${gapCard ? `"${gapCard.title}" first` : "the first card"}, then by hand, then the summary card, then redo the exercise. Filed as [[${path}|Plan for ${student.name}]]. For the module itself I'd ${recommendations[0].text.charAt(0).toLowerCase()}${recommendations[0].text.slice(1)} — it's in Modules → ${module.title} → Reports, with two more suggestions, whenever you want to decide.`,
        })
      }
      return actions
    },
  }
}

/* ---- Question: find the card that already covers it ---------------------------------- */

function runQuestion(job: ScriptedJob, module: Module | undefined): ScriptedResult {
  const { mention, snapshot } = job
  const text = messageText(mention.message).replace(/@\w+/g, " ")
  const pool = (module ? moduleCards(snapshot, module) : snapshot.cards.filter((c) => !c.base && c.path)).filter((c) => c.authorId === job.agentId)
  const query = words(text)
  const scored = pool
    .map((c) => {
      const hay = `${c.title} ${c.body}`.toLowerCase()
      const title = c.title.toLowerCase()
      const score = query.reduce((n, w) => n + (title.includes(w) ? 3 : hay.includes(w) ? 1 : 0), 0)
      return { c, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  if (!scored.length) {
    const checked = module ? `#${module.id}` : snapshot.modules.map((m) => `#${m.id}`).join(", ") || "the card file"
    return {
      intent: "question",
      answer: `I checked ${checked} and don't have a card on that yet. Ask with the module name or a card title and I'll look again, or ask ${teacherOf(snapshot)?.name ?? "the teacher"} to add material and I'll file it.`,
      wrote: [],
      after: () => [],
    }
  }
  const [best, next] = scored
  const lines = [`This is in the card file: ${cite(best.c)} — ${firstSentence(best.c.body)}`]
  if (next && next.score >= Math.max(2, best.score / 2)) lines.push(`${cite(next.c)} has the rest.`)
  return { intent: "question", answer: lines.join(" "), wrote: [], after: () => [] }
}

/* ---- Entry ------------------------------------------------------------------------ */

export function runScripted(job: ScriptedJob): ScriptedResult {
  const { intent, module } = detectIntent(job)
  if (intent === "ingest") return runIngest(job, module)
  if (intent === "plan") return runPlan(job, module)
  return runQuestion(job, module)
}
