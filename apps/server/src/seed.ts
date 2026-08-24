import { readFileSync, readdirSync } from "node:fs"
import { relative, resolve } from "node:path"
import {
  addChannelMember,
  getCardByPath,
  getCardById,
  openDatabase,
  repoRoot,
  seedCommunity,
  upsertAgent,
  upsertAssignment,
  upsertBaseCard,
  upsertCard,
  upsertChannel,
  upsertFeedback,
  upsertModule,
  upsertPerson,
  upsertReport,
  upsertSeedMessage,
  type SeedAgent,
  type SeedChannel,
  type SeedFeedback,
  type SeedMaterial,
  type SeedPerson,
  type SeedReport,
} from "./db.js"
import type { CardType, Difficulty, MessageBlock, ModuleStatus, WorkStatus } from "@ada/protocol"
import type { DatabaseSync } from "node:sqlite"

interface ModuleConfig {
  id: string
  index: number
  slug: string
  title: string
  summary: string
  channelId: string
  objectives: string[]
  difficulty: Difficulty
  status: ModuleStatus
  materials?: SeedMaterial[]
  revision?: string
}

interface AssignmentConfig {
  id: string
  moduleId: string
  channelId: string
  title: string
  due: string
  status: WorkStatus
}

interface AgoOrAt {
  at?: string
  ago?: string
}

interface FeedbackConfig extends AgoOrAt {
  id: string
  assignmentId: string
  studentId: string
  agentId: string
  score: { got: number; of: number }
  summary: string
  strengths: string[]
  gaps: Array<{ moduleId: string; note: string; cardId?: string }>
  nextSteps: Array<{ text: string; cardId?: string }>
}

interface ReportConfig extends AgoOrAt {
  id: string
  agentId: string
  studentId: string
  moduleId: string
  assignmentId?: string
  told: string
  recommendations: Array<{ id: string; text: string }>
  cardIds: string[]
  status: "new" | "reconciled"
  reconciled?: AgoOrAt & { by: string; accepted: string[]; note: string; cardId: string }
}

interface MessageConfig extends AgoOrAt {
  id: string
  channelId: string
  authorId: string
  text: string
  threadId?: string
  fromCard?: { cardPath: string; ago: string }
}

interface CourseConfig {
  id?: string
  name: string
  subtitle?: string
  initial?: string
  channels: Array<SeedChannel>
  people?: Array<SeedPerson & { channelIds?: string[] }>
  persons?: Array<SeedPerson & { channelIds?: string[] }>
  agents?: Array<SeedAgent>
  baseDocs?: Array<{
    channelId: string
    path: string
    title: string
    type: CardType
    authorId?: string
    sources?: Array<{ kind: "message" | "file"; ref: string; label: string }>
  }>
  modules?: ModuleConfig[]
  assignments?: AssignmentConfig[]
  feedback?: FeedbackConfig[]
  reports?: ReportConfig[]
  messages?: MessageConfig[]
  wikiCards?: boolean
}

export interface SeedOptions {
  courseDir?: string
  dbPath?: string
}

export function seedCourse(options: SeedOptions = {}): void {
  const courseDir = resolve(repoRoot, options.courseDir ?? process.env.ADA_COURSE ?? "data/neural-networks-2026")
  const config = JSON.parse(readFileSync(resolve(courseDir, "community.json"), "utf8")) as CourseConfig
  const database = openDatabase(options.dbPath)
  const seedTime = new Date()
  try {
    const channelIds = config.channels.map((channel) => channel.id)
    seedCommunity(database, {
      id: config.id ?? courseDir.split("/").pop() ?? "course",
      name: config.name,
      subtitle: config.subtitle ?? "Course community",
      initial: config.initial ?? config.name.slice(0, 1).toUpperCase(),
    })
    // Memberships are added after inserting all members (FKs are active).
    for (const channel of config.channels) upsertChannel(database, { ...channel, memberIds: [] })
    const people = config.people ?? config.persons ?? []
    // A channel that lists its members is authoritative (a private channel, #teachers);
    // a person with no `channelIds` joins only the channels that don't.
    const openChannelIds = config.channels.filter((c) => !c.memberIds?.length).map((c) => c.id)
    for (const person of people) {
      upsertPerson(database, person)
      for (const channelId of person.channelIds ?? openChannelIds) addChannelMember(database, channelId, person.id)
    }
    // A deploy rotates the committed demo token by env: with exactly one agent
    // in the course, ADA_AGENT_TOKEN wins over the JSON (deploy/README.md).
    const agentTokenOverride = process.env.ADA_AGENT_TOKEN
    const agents = config.agents ?? []
    if (agentTokenOverride && agents.length > 1) console.warn("ADA_AGENT_TOKEN is set but the course has several agents; ignoring the override.")
    for (const agent of agents) {
      upsertAgent(database, agentTokenOverride && agents.length === 1 ? { ...agent, token: agentTokenOverride } : agent)
    }
    for (const channel of config.channels) {
      for (const memberId of channel.memberIds ?? []) addChannelMember(database, channel.id, memberId)
    }
    for (const doc of config.baseDocs ?? []) {
      const authorId = doc.authorId ?? doc.path.split("/")[0]
      const body = readFileSync(resolve(courseDir, "raw", doc.path), "utf8")
      upsertBaseCard(database, {
        channelId: doc.channelId,
        authorId,
        path: doc.path,
        title: doc.title,
        type: doc.type,
        visibility: "channel",
        sources: doc.sources ?? [{ kind: "file", ref: `raw/${doc.path}`, label: doc.title }],
        body,
      }, { id: `card:${authorId}:${doc.path}` })
    }

    for (const module of config.modules ?? []) upsertModule(database, module)
    for (const assignment of config.assignments ?? []) upsertAssignment(database, assignment)

    if (config.wikiCards) ingestWikiCards(database, courseDir, seedTime, new Set(channelIds))

    for (const feedback of config.feedback ?? []) {
      upsertFeedback(database, {
        ...feedback,
        at: resolveAt(feedback, seedTime),
        gaps: feedback.gaps.map((gap) => ({
          ...gap,
          cardId: gap.cardId ? resolveCardRef(database, gap.cardId, `feedback "${feedback.id}" gap`) : undefined,
        })),
        nextSteps: feedback.nextSteps.map((step) => ({
          ...step,
          cardId: step.cardId ? resolveCardRef(database, step.cardId, `feedback "${feedback.id}" next step`) : undefined,
        })),
      } satisfies SeedFeedback)
    }

    for (const report of config.reports ?? []) {
      const reconciled = report.reconciled
        ? {
          at: resolveAt(report.reconciled, seedTime),
          by: report.reconciled.by,
          accepted: report.reconciled.accepted,
          note: report.reconciled.note,
          cardId: resolveCardRef(database, report.reconciled.cardId, `report "${report.id}" reconciled.cardId`),
        }
        : undefined
      upsertReport(database, {
        ...report,
        at: resolveAt(report, seedTime),
        cardIds: report.cardIds.map((ref) => resolveCardRef(database, ref, `report "${report.id}" cardIds`)),
        reconciled,
      } satisfies SeedReport)
    }

    for (const message of config.messages ?? []) {
      upsertSeedMessage(database, {
        id: message.id,
        channelId: message.channelId,
        authorId: message.authorId,
        at: resolveAt(message, seedTime),
        threadId: message.threadId,
        paragraphs: paragraphsFromText(database, message.text),
        fromCard: message.fromCard
          ? { cardId: resolveCardRef(database, message.fromCard.cardPath, `message "${message.id}" fromCard`), ago: message.fromCard.ago }
          : undefined,
      })
    }

    console.log(`Seed complete: ${config.name} (${config.channels.length} channels, ${people.length + (config.agents ?? []).length} members). Repeatable without duplicating.`)
  } finally {
    database.close()
  }
}

/* ---- Shared timestamp shorthand ("2d" | "3h" | "15m") --------------------- */

function resolveAt(entry: AgoOrAt, seedTime: Date): string {
  // A shorthand written under `at` by mistake still reads as "ago".
  const shorthand = entry.ago ?? (entry.at && /^\d+[dhm]$/.test(entry.at) ? entry.at : undefined)
  if (entry.at && !shorthand) return entry.at
  if (shorthand) {
    const match = /^(\d+)(d|h|m)$/.exec(shorthand)
    if (!match) throw new Error(`Invalid "ago" shorthand: ${shorthand}`)
    const amount = Number(match[1])
    const unitMs = match[2] === "d" ? 86_400_000 : match[2] === "h" ? 3_600_000 : 60_000
    return new Date(seedTime.getTime() - amount * unitMs).toISOString()
  }
  return seedTime.toISOString()
}

/* ---- Card reference resolution (wiki path or already-an-id) --------------- */

function resolveCardRef(database: DatabaseSync, ref: string, context: string): string {
  if (getCardById(database, ref)) return ref
  const byPath = getCardByPath(database, "ada", ref)
  if (byPath) return byPath.id
  throw new Error(`${context}: dangling card reference "${ref}"`)
}

/* ---- Message text -> paragraphs of blocks, with [[path]]/[[path|label]] cites -- */

const CITE_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

function blocksFromParagraph(database: DatabaseSync, paragraph: string): MessageBlock[] {
  const blocks: MessageBlock[] = []
  let lastIndex = 0
  for (const match of paragraph.matchAll(CITE_PATTERN)) {
    const index = match.index ?? 0
    if (index > lastIndex) blocks.push({ kind: "text", text: paragraph.slice(lastIndex, index) })
    const path = (match[1] ?? "").trim()
    const label = match[2]?.trim()
    const card = getCardByPath(database, "ada", path)
    if (card) {
      blocks.push({ kind: "cite", text: label ?? card.title, cite: { cardId: card.id } })
    } else {
      console.warn(`ada seed: unresolved cite [[${path}]] left as plain text`)
      blocks.push({ kind: "text", text: label ?? path })
    }
    lastIndex = index + match[0].length
  }
  if (lastIndex < paragraph.length) blocks.push({ kind: "text", text: paragraph.slice(lastIndex) })
  return blocks.length > 0 ? blocks : [{ kind: "text", text: paragraph }]
}

function paragraphsFromText(database: DatabaseSync, text: string): MessageBlock[][] {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => blocksFromParagraph(database, paragraph))
}

/* ---- Wiki cards: every markdown file under agents/ada/wiki/ (except index.md/log.md) --------- */

const WIKI_TYPE_TO_CARD_TYPE: Record<string, CardType> = {
  topic: "note",
  note: "note",
  difficulty: "note",
  question: "answer",
  answer: "answer",
  decision: "decision",
  assignment: "assignment",
  submission: "submission",
}

function mapWikiCardType(fmType: string, path: string): CardType {
  const type = WIKI_TYPE_TO_CARD_TYPE[fmType]
  if (!type) throw new Error(`Wiki card "${path}" has an unknown frontmatter type: ${fmType}`)
  return type
}

function defaultChannelForPath(path: string): string {
  const segments = path.split("/")
  if (segments[0] === "modules" && segments[1]) return segments[1]
  if (segments[0] === "questions") return "questions"
  return "general"
}

/** Minimal frontmatter parser for the controlled shape documented in the agent's CLAUDE.md:
    flat `key: value` lines plus one level of `key:` followed by `- item` list lines. */
function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  if (!match) return { frontmatter: {}, body: raw }
  const [, yaml, body] = match
  const frontmatter: Record<string, unknown> = {}
  let currentKey: string | undefined
  let currentList: string[] | undefined
  for (const line of (yaml ?? "").split(/\r?\n/)) {
    const listItem = /^\s*-\s+(.*)$/.exec(line)
    if (listItem && currentKey) {
      currentList = currentList ?? []
      currentList.push(listItem[1].trim().replace(/^["']|["']$/g, ""))
      frontmatter[currentKey] = currentList
      continue
    }
    const keyValue = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line)
    if (keyValue) {
      const [, key, value] = keyValue
      currentKey = key
      currentList = undefined
      frontmatter[key] = value.trim().length > 0 ? value.trim().replace(/^["']|["']$/g, "") : undefined
    }
  }
  return { frontmatter, body: (body ?? "").trim() }
}

function walkMarkdownFiles(dir: string, base = dir): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(full, base))
    } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "index.md" && entry.name !== "log.md") {
      files.push(relative(base, full))
    }
  }
  return files.sort()
}

function sourcesFromFrontmatter(list: unknown): Array<{ kind: "file"; ref: string; label: string }> {
  if (!Array.isArray(list)) return []
  return list.map((item) => {
    const ref = String(item)
    return { kind: "file" as const, ref, label: ref.split("/").pop() ?? ref }
  })
}

/** Upserts every `agents/ada/wiki/**\/*.md` file (except index.md/log.md) as a card authored by "ada".
    Processes files in dependency order so a `supersedes` target is always written first, however the
    files happen to sort; a target that never resolves fails loudly, naming the offending path. */
function ingestWikiCards(database: DatabaseSync, courseDir: string, seedTime: Date, channelIds: Set<string>): void {
  const wikiDir = resolve(courseDir, "agents/ada/wiki")
  let files: string[]
  try {
    files = walkMarkdownFiles(wikiDir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return
    throw error
  }
  const parsedByPath = new Map<string, { frontmatter: Record<string, unknown>; body: string }>()
  for (const path of files) {
    const raw = readFileSync(resolve(wikiDir, path), "utf8")
    parsedByPath.set(path, parseFrontmatter(raw))
  }
  const defaultPublishedAt = new Date(seedTime.getTime() - 7 * 86_400_000).toISOString()
  const pending = new Set(parsedByPath.keys())
  let progressed = true
  while (pending.size > 0 && progressed) {
    progressed = false
    for (const path of [...pending]) {
      const parsed = parsedByPath.get(path)
      if (!parsed) continue
      const { frontmatter, body } = parsed
      const supersedes = typeof frontmatter.supersedes === "string" ? frontmatter.supersedes : undefined
      if (supersedes && pending.has(supersedes)) continue // its target hasn't been written yet this run

      if (typeof frontmatter.title !== "string") throw new Error(`Wiki card "${path}" is missing frontmatter "title"`)
      if (typeof frontmatter.type !== "string") throw new Error(`Wiki card "${path}" is missing frontmatter "type"`)
      const type = mapWikiCardType(frontmatter.type, path)
      const channelId = typeof frontmatter.channel === "string" ? frontmatter.channel : defaultChannelForPath(path)
      if (!channelIds.has(channelId)) throw new Error(`Wiki card "${path}" points at an unknown channel: ${channelId}`)
      if (supersedes && !getCardByPath(database, "ada", supersedes)) {
        throw new Error(`Wiki card "${path}" supersedes an unknown card: ${supersedes}`)
      }
      const visibility = frontmatter.visibility === "only-me" ? "only-me" : "channel"
      const publishedAt = typeof frontmatter.published === "string" ? frontmatter.published : defaultPublishedAt

      upsertCard(database, {
        channelId,
        authorId: "ada",
        path,
        title: frontmatter.title,
        type,
        visibility,
        sources: sourcesFromFrontmatter(frontmatter.sources),
        replaces: supersedes,
        body,
      }, { id: `card:ada:${path}`, publishedAt, bumpVersion: false })
      pending.delete(path)
      progressed = true
    }
  }
  if (pending.size > 0) {
    const [first] = pending
    const frontmatter = parsedByPath.get(first)?.frontmatter
    throw new Error(`Wiki card "${first}" has a dangling supersedes reference: ${String(frontmatter?.supersedes)}`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) seedCourse()
