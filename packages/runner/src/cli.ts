#!/usr/bin/env node
/* ada-runner: the process that turns a folder into a member of the course.

   One agent = one identity (the token) + one folder (`--cwd`, with CLAUDE.md,
   wiki/ and log.md) + this runner. It connects OUTBOUND to the community
   server with the agent's token, receives scoped `work`, runs the provider's
   unmodified provider binary (`claude -p` or `codex exec`) with cwd in the agent's folder,
   publishes whatever changed in wiki/ as cards, converts `[[path]]` citations
   into cite blocks, and posts the answer. The server never runs a model; this
   process never handles provider credentials (they stay with the binary).

   Usage:
     ada-runner --server http://localhost:8787 --community <id> --agent <id>
                --token <token> --cwd <agent-folder> --materials <raw-folder>
                [--runtime claude|codex] [--model <id>] [--timeout 180]
   The deterministic scripted runtime is a direct test harness only
   (`npm run check:scripted -w @ada/runner`).
   Env fallbacks: ADA_SERVER, ADA_COMMUNITY_ID, ADA_AGENT_ID, ADA_AGENT_TOKEN,
   ADA_AGENT_CWD, ADA_MATERIALS, ADA_RUNTIME, ADA_MODEL, ADA_TIMEOUT. */

import { spawn } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { basename, dirname, join, relative, resolve, sep } from "node:path"
import WebSocket from "ws"
import { runnerClientFrameSchema, runnerServerFrameSchema } from "@ada/protocol"
import type { CardType, CommunityMember, Member, Message, MessageBlock, Presence, RunnerWork } from "@ada/protocol"
import { parseRunnerConfig, type RunnerConfig } from "./config.js"
import { runProvider } from "./runtimes/providers.js"
import type { Mention } from "./runtimes/scripted.js"
import { createBootstrapFile, ensureWorkspaceDirectory, safeWorkspacePath } from "./workspace.js"

/* ---- Arguments ------------------------------------------------------------- */

let config: RunnerConfig
try {
  config = parseRunnerConfig()
} catch (error) {
  console.error(error instanceof Error ? error.message : "ada-runner: invalid configuration.")
  process.exit(2)
}

const { server, communityId, agentId, token, cwd, materialsDir: rawDir, runtime, model, timeoutMs } = config
const agentName = agentId
const wikiDir = join(cwd, "wiki")
const stateDir = join(cwd, ".ada")
const cardMapFile = join(stateDir, "cards.json")

ensureWorkspaceDirectory(wikiDir, "wiki")
ensureWorkspaceDirectory(stateDir, ".ada")

const BOOTSTRAP_AGENTS = "# Agent workspace rules\n\n- Read this file and `wiki/index.md` before answering.\n- Treat `wiki/` as the agent's durable card memory. Write or update a markdown card when you learn something worth keeping.\n- Keep card frontmatter accurate, including `type`, `title`, `sources`, and optional `supersedes`.\n- Cite cards in answers with `[[path relative to wiki/]]`.\n- Never write to the course material directory; it is read-only context.\n- Keep answers concise and factual. Do not invent a citation for a card that does not exist.\n"
const BOOTSTRAP_CLAUDE = "# Ada agent instructions\n\nRead `AGENTS.md` and `wiki/index.md` first. Follow the card-memory rules there. Work only in this agent workspace; course materials are read-only. When useful knowledge is learned, maintain a markdown card in `wiki/` and cite it as `[[path]]` in the answer.\n"
const BOOTSTRAP_INDEX = "# Card index\n\nThis file lists the durable cards in this agent's wiki. Keep it readable and update it when adding or removing cards.\n\nCards are markdown files with frontmatter. Keep `type`, `title`, and `sources` accurate; use `supersedes` only for a prior card path. Cite a card with `[[path relative to wiki/]]`.\n"

createBootstrapFile(join(cwd, "AGENTS.md"), BOOTSTRAP_AGENTS)
createBootstrapFile(join(cwd, "CLAUDE.md"), BOOTSTRAP_CLAUDE)
createBootstrapFile(join(wikiDir, "index.md"), BOOTSTRAP_INDEX)

const log = (...parts: unknown[]) => console.log(
  `[${agentName}]`,
  ...parts.map((part) => typeof part === "string" ? part.split(token).join("[redacted]") : part),
)

/** Resolve a server-controlled material path without following a symlink out
    of the explicitly supplied materials root. The nearest existing parent is
    checked too, because a download target may not exist yet. */
function safeMaterialPath(rootInput: string, relativePath: string): string | undefined {
  const root = resolve(rootInput)
  const candidate = resolve(root, relativePath)
  if (candidate === root || !candidate.startsWith(root + sep)) return undefined
  if (!existsSync(root)) return candidate
  let probe = candidate
  while (!existsSync(probe)) {
    const parent = dirname(probe)
    if (parent === probe) break
    probe = parent
  }
  try {
    const realRoot = realpathSync(root)
    const realProbe = realpathSync(probe)
    if (realProbe !== realRoot && !realProbe.startsWith(realRoot + sep)) return undefined
    if (existsSync(candidate)) {
      const realCandidate = realpathSync(candidate)
      if (realCandidate !== realRoot && !realCandidate.startsWith(realRoot + sep)) return undefined
    }
  } catch {
    return undefined
  }
  return candidate
}

/* ---- Local card map: wiki path → what the server knows about it ------------- */

type CardRef = { cardId: string; title: string; publishedAt: string }
function loadCardMap(): Record<string, CardRef> {
  try {
    return JSON.parse(readFileSync(cardMapFile, "utf8")) as Record<string, CardRef>
  } catch {
    return {}
  }
}
function saveCardMap(map: Record<string, CardRef>) {
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(cardMapFile, JSON.stringify(map, null, 2) + "\n")
}
const cardMap = loadCardMap()

function resolveCardId(reference: string): string | undefined {
  const normalized = reference.replace(/^wiki[\\/]/, "")
  return cardMap[normalized]?.cardId
    ?? Object.values(cardMap).find((card) => card.cardId === reference)?.cardId
}

/* ---- Wiki snapshot: which .md files changed during a run -------------------- */

const NOT_CARDS = new Set(["index.md", "log.md"])

function safeWikiPath(relativePath: string): string | undefined {
  return safeWorkspacePath(wikiDir, relativePath)
}

function listWiki(): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (dir: string) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        const rel = relative(wikiDir, full)
        if (NOT_CARDS.has(rel)) continue
        const safe = safeWikiPath(rel)
        if (!safe) continue
        out.set(rel, createHash("sha1").update(readFileSync(safe)).digest("hex"))
      }
    }
  }
  walk(wikiDir)
  return out
}

/* ---- Frontmatter (the small subset the card rules use) ---------------------- */

/* Frontmatter `type` (agent-wiki spec) → the client's CardType. */
const CARD_TYPES: Record<string, CardType> = {
  topic: "note", note: "note", difficulty: "note",
  question: "answer", answer: "answer",
  decision: "decision", assignment: "assignment", submission: "submission",
}

function parseCard(path: string): { title: string; type: CardType; visibility: "channel" | "only-me"; sources: string[]; supersedes?: string; channel?: string; body: string } {
  const safe = safeWikiPath(path)
  if (!safe) throw new Error(`refusing card outside wiki: ${path}`)
  const text = readFileSync(safe, "utf8")
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  const meta: Record<string, string | string[]> = {}
  if (m) {
    let listKey: string | null = null
    for (const line of m[1].split("\n")) {
      const item = /^\s*-\s+(.*)$/.exec(line)
      if (item && listKey) {
        ;(meta[listKey] as string[]).push(item[1].trim().replace(/^["']|["']$/g, ""))
        continue
      }
      const kv = /^([A-Za-z_]+):\s*(.*)$/.exec(line)
      if (!kv) continue
      const [, key, raw] = kv
      const value = raw.trim()
      if (value === "") {
        meta[key] = []
        listKey = key
      } else if (value.startsWith("[") && value.endsWith("]")) {
        meta[key] = value.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
        listKey = null
      } else {
        meta[key] = value.replace(/^["']|["']$/g, "")
        listKey = null
      }
    }
  }
  const body = m ? text.slice(m[0].length).trim() : text.trim()
  const firstHeading = /^#\s+(.+)$/m.exec(body)?.[1]
  const title = (typeof meta.title === "string" && meta.title) || firstHeading || basename(path, ".md")
  const typeRaw = typeof meta.type === "string" ? meta.type : "topic"
  const type = CARD_TYPES[typeRaw] ?? "note"
  const visibility = meta.visibility === "only-me" ? "only-me" : "channel"
  const sources = Array.isArray(meta.sources) ? meta.sources : typeof meta.sources === "string" ? [meta.sources] : []
  const supersedes = typeof meta.supersedes === "string" ? meta.supersedes : undefined
  // `channel:` in the frontmatter says where the card belongs (a module's
  // channel, for material ingested from #teachers); otherwise the mention's.
  const channel = typeof meta.channel === "string" && meta.channel ? meta.channel : undefined
  return { title, type, visibility, sources, supersedes, channel, body }
}

/* ---- Answer text → message blocks ------------------------------------------- */

const CITE = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g

function inlineBlocks(text: string): MessageBlock[] {
  const blocks: MessageBlock[] = []
  let last = 0
  for (const m of text.matchAll(CITE)) {
    const start = m.index ?? 0
    if (start > last) blocks.push({ kind: "text", text: text.slice(last, start) })
    const path = m[1].trim()
    const ref = cardMap[path]
    if (ref) blocks.push({ kind: "cite", text: m[2]?.trim() || ref.title, cite: { cardId: ref.cardId } })
    else blocks.push({ kind: "text", text: m[2]?.trim() || path })
    last = start + m[0].length
  }
  if (last < text.length) blocks.push({ kind: "text", text: text.slice(last) })
  return blocks.length ? blocks : [{ kind: "text", text }]
}

function toParagraphs(answer: string): MessageBlock[][] {
  const out: MessageBlock[][] = []
  const parts = answer.replace(/\r\n/g, "\n").split(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g)
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      out.push([{ kind: "code", text: part.replace(/\n$/, "") }])
      return
    }
    for (const para of part.split(/\n\s*\n/)) {
      // Chat messages are plain text blocks, not markdown: list items become
      // their own paragraphs and emphasis marks are dropped.
      const lines = para.split("\n").map((l) => l.trim()).filter(Boolean)
      const isList = lines.length > 1 && lines.every((l) => /^([-*•]|\d+[.)])\s+/.test(l))
      const chunks = isList ? lines.map((l) => l.replace(/^([-*•]|\d+[.)])\s+/, "– ")) : [lines.join(" ")]
      for (const chunk of chunks) {
        const text = chunk
          .replace(/^#{1,6}\s+/, "")
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1$2")
          .replace(/`([^`\n]+)`/g, "$1")
          .trim()
        if (text) out.push(inlineBlocks(text))
      }
    }
  })
  return out.length ? out : [[{ kind: "text", text: answer.trim() || "(no answer)" }]]
}

function citedCardIds(paragraphs: MessageBlock[][]): string[] {
  const ids: string[] = []
  for (const p of paragraphs) for (const b of p) if (b.kind === "cite" && !ids.includes(b.cite.cardId)) ids.push(b.cite.cardId)
  return ids
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.max(1, Math.round(ms / 60000))
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? "1 day ago" : `${days} days ago`
}

/* ---- Prompt ----------------------------------------------------------------- */

function messageText(m: Message): string {
  return m.paragraphs.map((p) => p.map((b) => (b.kind === "code" ? `\`\`\`\n${b.text}\n\`\`\`` : b.text)).join("")).join("\n\n")
}

function materialPrompt(): string {
  const root = resolve(rawDir)
  const sources: Array<{ name: string; path: string }> = []
  const walk = (dir: string, relativeDir: string, depth: number) => {
    if (depth > 8 || sources.length >= 20) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const relativePath = relativeDir ? join(relativeDir, entry.name) : entry.name
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full, relativePath, depth + 1)
      else if (entry.isFile() && /\.(?:md|markdown|txt)$/i.test(entry.name)) sources.push({ name: entry.name, path: relativePath })
      if (sources.length >= 20) return
    }
  }
  walk(root, "", 0)
  if (sources.length === 0) return ""
  const excerpts: string[] = []
  let remaining = 80_000
  for (const material of sources) {
    const file = safeMaterialPath(root, material.path)
    if (!file) continue
    try {
      const text = readFileSync(file, "utf8").slice(0, Math.min(40_000, remaining))
      remaining -= text.length
      excerpts.push(`Material ${material.name} (read-only context):\n${text}`)
      if (remaining <= 0) break
    } catch {
      // A provider should not fail solely because a local excerpt is absent.
    }
  }
  return excerpts.length ? `Course material excerpts (do not edit these files):\n${excerpts.join("\n\n")}` : ""
}

function buildPrompt(payload: { channelId: string; threadId?: string; message: Message; from: Member; context: Message[] }) {
  const context = payload.context
    .filter((m) => m.id !== payload.message.id)
    .map((m) => `- ${m.authorId}: ${messageText(m).replace(/\s+/g, " ").slice(0, 400)}`)
    .join("\n")
  return [
    `${payload.from.name} mentioned you in the course channel #${payload.channelId}${payload.threadId ? " (inside a thread)" : ""}.`,
    context ? `Recent conversation, oldest first:\n${context}` : "There is no earlier conversation in this context.",
    `Their message:\n${messageText(payload.message)}`,
    "Course materials are supplied only as bounded, read-only excerpts below. Do not look for or modify their source files.",
    `If you create or update a card from this request, record the triggering message id in its frontmatter exactly as: sources: [${payload.message.id}]`,
    agentInstructions ? `Managed agent instructions (from the authenticated agent record):\n${agentInstructions.split(token).join("[redacted]")}` : "",
    materialPrompt(),
    "Follow the rules in AGENTS.md and CLAUDE.md: read wiki/index.md first, answer from the cards when they already cover it, write or update a card in wiki/ when you learned something worth keeping, and cite cards with [[path]] (path relative to wiki/). Reply with the answer only, as a short chat message: plain sentences, no preamble, no headings, no bold or bullet lists (the channel renders plain text), code only in fenced blocks.",
  ].filter(Boolean).join("\n\n")
}

/* ---- Runtime adapters ------------------------------------------------------- */

async function runModel(prompt: string): Promise<string> {
  if (runtime !== "claude" && runtime !== "codex") throw new Error(`unsupported model runtime: ${runtime}`)
  // Treat all server/user/material text as untrusted: even if somebody has
  // pasted the bearer into a message or local file, it must not reach a model
  // prompt. The provider also receives the secret for error redaction only.
  const safePrompt = prompt.split(token).join("[redacted]")
  if (process.send) {
    await new Promise<void>((resolveGrant, rejectGrant) => {
      const onMessage = (message: unknown) => {
        if (message && typeof message === "object" && "type" in message && message.type === "run.granted") {
          process.off("message", onMessage)
          resolveGrant()
        }
      }
      process.on("message", onMessage)
      process.send!({ type: "run.acquire" }, (error) => { if (error) { process.off("message", onMessage); rejectGrant(error) } })
    })
  }
  try {
    return await runProvider(runtime, { cwd, prompt: safePrompt, timeoutMs, ...(model ? { model } : {}), secrets: [token] })
  } finally { if (process.connected) process.send?.({ type: "run.release" }) }

}

/* ---- git: one commit per run (the wiki's version history) ------------------- */

function git(argsList: string[]): Promise<{ code: number | null; out: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn("git", argsList, { cwd, stdio: ["ignore", "pipe", "ignore"] })
    let out = ""
    child.stdout.on("data", (d) => (out += d))
    child.on("error", () => resolvePromise({ code: null, out }))
    child.on("close", (code) => resolvePromise({ code, out: out.trim() }))
  })
}
/* The wiki's history: one commit per run. A standalone agent folder (the
   teacher's machine) gets its own repository; a folder that already lives
   inside a repository (this monorepo's data/) is versioned by that one — a
   nested .git there would hide the seeded cards from the outer repo. */
let commitMode: "own" | "enclosing" | "init" | null = null
async function commitRun(summary: string) {
  if (commitMode === null) {
    if (existsSync(join(cwd, ".git"))) commitMode = "own"
    else {
      const inside = await git(["rev-parse", "--is-inside-work-tree"])
      commitMode = inside.code === 0 && inside.out === "true" ? "enclosing" : "init"
      if (commitMode === "enclosing") log("the folder is inside a repository: runs aren't committed separately")
    }
  }
  if (commitMode === "enclosing") return
  if (commitMode === "init") {
    await git(["init", "-q"])
    commitMode = "own"
  }
  // A missing pathspec makes `git add` fail whole, staging nothing — and
  // log.md only exists once a run appended to it. Stage what's there.
  const paths = ["wiki", "log.md"].filter((path) => existsSync(join(cwd, path)))
  if (paths.length === 0) return
  await git(["add", "-A", ...paths])
  await git(["commit", "-q", "-m", summary])
}

/* ---- Connection ------------------------------------------------------------- */

const wsUrl = `${server.replace(/^http/, "ws")}/ws/runner`
let ws: WebSocket | null = null
let attempts = 0
let authenticated = false
let terminal = false
let authTimer: ReturnType<typeof setTimeout> | undefined
const pending = new Map<string, { resolve: (ack: RunnerAck) => void; reject: (e: Error) => void }>()
const queue: Array<() => Promise<void>> = []
let busy = false
let agentInstructions = ""
type RunnerRequest = {
  type: "message.create" | "card.publish"
  ref: string
  payload: Record<string, unknown>
}

type RunnerAck = { ok: true; messageId?: string; cardId?: string }

function send(msg: Record<string, unknown>) {
  const parsed = runnerClientFrameSchema.safeParse(msg)
  if (!parsed.success) {
    log("refusing to send an invalid runner protocol frame")
    return
  }
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(parsed.data))
}
function sendAuth() {
  // The token is sent only in this first shared-protocol frame. It is never
  // placed in the URL, provider prompt, or runner logs. The server binds the
  // community and agent from the token and returns them in `ready`.
  send({ type: "auth", token })
}
function presence(p: Presence) {
  send({ type: "presence", payload: { presence: p === "away" ? "offline" : p, runtime, ...(model ? { model } : {}) } })
}
function request(msg: RunnerRequest): Promise<RunnerAck> {
  return new Promise((resolvePromise, reject) => {
    pending.set(msg.ref, { resolve: resolvePromise, reject })
    send(msg)
    setTimeout(() => {
      if (pending.delete(msg.ref)) reject(new Error(`no ack for ${msg.type} ${msg.ref}`))
    }, 10000)
  })
}

function toLegacyMember(member: CommunityMember): Member {
  return {
    kind: "person",
    id: member.id,
    name: member.displayName,
    initials: member.initials,
    tone: "card",
    role: member.role,
    presence: member.presence === "offline" ? "away" : member.presence,
  }
}

function hostedWorkMention(payload: RunnerWork["payload"]): Mention | undefined {
  if (payload.communityId !== communityId || payload.agentId !== agentId) {
    log("server dispatched work for a different community or agent")
    terminal = true
    ws?.close(4403, "runner identity mismatch")
    return undefined
  }
  if (payload.message.authorId === agentId) return undefined
  return {
    channelId: payload.channelId,
    ...(payload.threadId ? { threadId: payload.threadId } : {}),
    message: payload.message,
    from: toLegacyMember(payload.from),
    context: payload.context,
  }
}

async function handleMention(payload: Mention) {
  log(`mention from ${payload.from.name} in #${payload.channelId}${payload.intent ? ` (${payload.intent}${payload.moduleId ? ` ${payload.moduleId}` : ""})` : ""}`)
  presence("thinking")
  const before = listWiki()
  let answer: string
  try {
    answer = await runModel(buildPrompt(payload))
  } catch (e) {
    log("run failed:", (e as Error).message)
    await request({
      type: "message.create",
      ref: randomUUID(),
      payload: { communityId, agentId, channelId: payload.channelId, threadId: payload.threadId, paragraphs: [[{ kind: "text", text: "I could not answer this time. Please try again. If this keeps happening, ask your administrator to check the shared agent connection." }]] },
    }).catch(() => {})
    presence("online")
    return
  }

  // Cards come from the filesystem, not from the model's words (design.md §6).
  const after = listWiki()
  const changed = [...after.keys()].filter((p) => before.get(p) !== after.get(p)).sort()
  if (changed.length) presence("publishing")
  for (const path of changed) {
    try {
      const card = parseCard(path)
      const replacesCardId = card.supersedes ? resolveCardId(card.supersedes) : undefined
      const ack = await request({
        type: "card.publish",
        ref: randomUUID(),
        payload: {
          communityId,
          agentId,
          channelId: card.channel ?? payload.channelId,
          path,
          title: card.title,
          type: card.type,
          body: card.body,
          sourceMessageIds: card.sources.length ? card.sources : [payload.message.id],
          ...(replacesCardId ? { replacesCardId } : {}),
        },
      })
      if (ack.cardId) {
        // Hosted runner acknowledgements intentionally contain no card body;
        // the card id is enough to resolve future [[path]] citations.
        cardMap[path] = { cardId: ack.cardId, title: card.title, publishedAt: new Date().toISOString() }
        log(`published ${path} → ${ack.cardId}`)
      }
    } catch (e) {
      log(`couldn't publish ${path}:`, (e as Error).message)
    }
  }
  if (changed.length) saveCardMap(cardMap)

  const paragraphs = toParagraphs(answer)
  const cited = citedCardIds(paragraphs)
  // "From the file": nothing changed in wiki/ and the answer cites a card.
  const fromCard = !changed.length && cited.length
    ? (() => {
        const ref = Object.values(cardMap).find((r) => r.cardId === cited[0])
        return ref ? { cardId: ref.cardId, ago: ago(ref.publishedAt) } : undefined
      })()
    : undefined
  try {
    await request({
      type: "message.create",
      ref: randomUUID(),
      payload: { communityId, agentId, channelId: payload.channelId, threadId: payload.threadId, paragraphs },
    })
    log(`answered (${paragraphs.length} paragraphs, ${cited.length} citations${fromCard ? ", from the file" : ""})`)
  } catch (e) {
    log("couldn't post the answer:", (e as Error).message)
  }
  await commitRun(`${agentName}: answer in #${payload.channelId}${changed.length ? ` (+${changed.length} cards)` : ""}`)
  presence("online")
}

function enqueue(job: () => Promise<void>) {
  queue.push(job)
  if (busy) return
  busy = true
  void (async () => {
    while (queue.length) {
      const next = queue.shift()!
      try {
        await next()
      } catch (e) {
        log("job failed:", (e as Error).message)
      }
    }
    busy = false
  })()
}

function connect() {
  ws = new WebSocket(wsUrl)
  ws.on("open", () => {
    attempts = 0
    authenticated = false
    log(`connected to ${server} as runtime ${runtime}${model ? ` (${model})` : ""}; folder ${cwd}`)
    sendAuth()
    authTimer = setTimeout(() => {
      if (!authenticated) {
        log("server did not acknowledge runner authentication")
        ws?.close(4401, "runner authentication timeout")
      }
    }, 10_000)
  })
  ws.on("message", (raw) => {
    let data: unknown
    try {
      data = JSON.parse(String(raw))
    } catch {
      return
    }
    const msg = data as { type?: string; ref?: string }
    const hostedFrame = runnerServerFrameSchema.safeParse(data)
    if (!hostedFrame.success) {
      log("server sent an invalid hosted runner frame")
      terminal = true
      ws?.close(4403, "invalid runner frame")
      return
    }
    if (!authenticated) {
      if (msg.type === "ready") {
        const readyFrame = runnerServerFrameSchema.parse(data)
        if (readyFrame.type !== "ready") return
        const ready = readyFrame.payload
        agentInstructions = ready.agent.instructions.split(token).join("[redacted]")
        if (ready.agent.id !== agentId || ready.agent.communityId !== communityId) {
          log("server returned a different runner identity than requested")
          terminal = true
          ws?.close(4403, "runner identity mismatch")
          return
        }
        authenticated = true
        if (authTimer) clearTimeout(authTimer)
        presence("online")
      } else if (msg.type === "error") {
        log("server rejected runner authentication")
        ws?.close(4401, "invalid runner credentials")
      }
      return
    }
    if (msg.type === "ack" && msg.ref) {
      if (!hostedFrame.success || hostedFrame.data.type !== "ack") {
        log("server sent an invalid hosted runner acknowledgement")
        terminal = true
        ws?.close(4403, "invalid runner acknowledgement")
        return
      }
      const ack = hostedFrame.data
      const p = pending.get(msg.ref)
      if (!p) return
      pending.delete(msg.ref)
      if (ack.ok) p.resolve({ ok: true, messageId: ack.messageId, cardId: ack.cardId })
      else p.reject(new Error(ack.error))
      return
    }
    if (msg.type === "error") {
      if (!hostedFrame.success || hostedFrame.data.type !== "error") {
        log("server sent an invalid hosted runner error")
        terminal = true
        ws?.close(4403, "invalid runner error")
        return
      }
      const detail = hostedFrame.data.payload.message
      for (const [ref, pendingRequest] of pending) {
        pending.delete(ref)
        pendingRequest.reject(new Error(detail.slice(0, 1_200)))
      }
      return
    }
    if (msg.type === "work") {
      const frame = runnerServerFrameSchema.parse(data)
      if (frame.type !== "work") return
      const work = hostedWorkMention(frame.payload)
      if (!work) return
      enqueue(() => {
        if (frame.payload.instructions !== undefined) agentInstructions = frame.payload.instructions.split(token).join("[redacted]")
        return handleMention(work)
      })
    }
  })
  ws.on("close", (code) => {
    authenticated = false
    if (authTimer) clearTimeout(authTimer)
    if (terminal || code === 4403) {
      console.error("ada-runner: the server returned an incompatible runner identity (4403). Check --community and --agent.")
      process.exit(1)
    }
    if (code === 4401) {
      console.error("ada-runner: the server rejected runner authentication (4401). Check --community, --agent, and --token.")
      process.exit(1)
    }
    const wait = Math.min(1000 * 2 ** attempts, 15000)
    attempts++
    log(`disconnected (${code}); retrying in ${wait / 1000}s`)
    setTimeout(connect, wait)
  })
  ws.on("error", (e) => {
    if (attempts === 0) log("connection error:", e.message)
  })
}

// If the host dies, terminate the worker group including the active provider.
if (process.send) process.once("disconnect", () => {
  if (process.platform !== "win32") { try { process.kill(-process.pid, "SIGTERM") } catch { /* exiting below */ } }
  process.exit(0)
})
log(`starting: wiki ${wikiDir}, raw ${rawDir}`)
connect()
