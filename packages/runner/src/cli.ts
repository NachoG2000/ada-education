#!/usr/bin/env node
/* ada-runner: the process that turns a folder into a member of the course.

   One agent = one identity (the token) + one folder (`--cwd`, with CLAUDE.md,
   wiki/ and log.md) + this runner. It connects OUTBOUND to the community
   server with the agent's token, receives `agent.mention`, runs the provider's
   unmodified binary (`claude -p` today) with cwd in the agent's folder,
   publishes whatever changed in wiki/ as cards, converts `[[path]]` citations
   into cite blocks, and posts the answer. The server never runs a model; this
   process never handles credentials (they live with the binary).

   Usage:
     ada-runner --cwd data/<course>/agents/<agent> --token <token>
                [--server http://localhost:8787] [--runtime claude|scripted]
                [--model <id>] [--timeout 180]
   `scripted` answers from templates filled with live community state and
   needs no model (the demo default; see runtimes/scripted.ts).
   Env fallbacks: ADA_SERVER, ADA_AGENT_TOKEN, ADA_AGENT_CWD, ADA_RUNTIME, ADA_MODEL. */

import { spawn } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { basename, join, relative, resolve } from "node:path"
import WebSocket from "ws"
import type { Card, CardType, CommunitySnapshot, Member, Message, MessageBlock, Presence, Report, RunnerClientMessage } from "@ada/protocol"
import { runScripted, thinkingDelay, type Mention, type ScriptedResult } from "./runtimes/scripted.js"

/* ---- Arguments ------------------------------------------------------------- */

function arg(name: string, env: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1]
  return process.env[env] ?? fallback
}

const server = (arg("server", "ADA_SERVER", "http://localhost:8787") as string).replace(/\/+$/, "")
const token = arg("token", "ADA_AGENT_TOKEN")
const cwdArg = arg("cwd", "ADA_AGENT_CWD")
const runtime = arg("runtime", "ADA_RUNTIME", "claude") as string
const model = arg("model", "ADA_MODEL")
const timeoutMs = Number(arg("timeout", "ADA_TIMEOUT", "180")) * 1000

if (!token || !cwdArg) {
  console.error("ada-runner: --token and --cwd are required (or ADA_AGENT_TOKEN / ADA_AGENT_CWD).")
  process.exit(2)
}
const cwd = resolve(cwdArg)
if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
  console.error(`ada-runner: --cwd ${cwd} isn't a directory.`)
  process.exit(2)
}
if (runtime !== "claude" && runtime !== "scripted") {
  // codex / pi adapters share this interface but aren't wired yet (design.md §8).
  console.error(`ada-runner: runtime "${runtime}" isn't implemented yet; only "claude" and "scripted" are.`)
  process.exit(2)
}
const agentName = basename(cwd)
const wikiDir = join(cwd, "wiki")
const courseDir = resolve(cwd, "../..")
const rawDir = join(courseDir, "raw")
const stateDir = join(cwd, ".ada")
const cardMapFile = join(stateDir, "cards.json")

const log = (...parts: unknown[]) => console.log(`[${agentName}]`, ...parts)

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

/* ---- Wiki snapshot: which .md files changed during a run -------------------- */

const NOT_CARDS = new Set(["index.md", "log.md"])

function listWiki(): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (dir: string) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith(".md")) {
        const rel = relative(wikiDir, full)
        if (NOT_CARDS.has(rel)) continue
        out.set(rel, createHash("sha1").update(readFileSync(full)).digest("hex"))
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
  const text = readFileSync(join(wikiDir, path), "utf8")
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

function buildPrompt(payload: { channelId: string; threadId?: string; message: Message; from: Member; context: Message[] }, names: Map<string, string>) {
  const who = (id: string) => names.get(id) ?? id
  const context = payload.context
    .filter((m) => m.id !== payload.message.id)
    .map((m) => `- ${who(m.authorId)}: ${messageText(m).replace(/\s+/g, " ").slice(0, 400)}`)
    .join("\n")
  return [
    `${payload.from.name} mentioned you in the course channel #${payload.channelId}${payload.threadId ? " (inside a thread)" : ""}.`,
    context ? `Recent conversation, oldest first:\n${context}` : "There is no earlier conversation in this context.",
    `Their message:\n${messageText(payload.message)}`,
    "Follow the rules in CLAUDE.md: read wiki/index.md first, answer from the cards when they already cover it, write or update a card in wiki/ when you learned something worth keeping, and cite cards with [[path]] (path relative to wiki/). Reply with the answer only, as a short chat message: plain sentences, no preamble, no headings, no bold or bullet lists (the channel renders plain text), code only in fenced blocks.",
  ].join("\n\n")
}

/* ---- Runtime: claude -p ----------------------------------------------------- */

function runClaude(prompt: string): Promise<string> {
  const args = [
    "-p", prompt,
    "--output-format", "json",
    "--permission-mode", "acceptEdits",
    "--allowedTools", "Read,Write,Edit,MultiEdit,Glob,Grep",
    "--add-dir", rawDir,
  ]
  if (model) args.push("--model", model)
  // The binary is spawned as-is: credentials are its business, never ours.
  // CLAUDE* vars are stripped so a runner launched from inside Claude Code
  // doesn't inherit a session it isn't part of.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("CLAUDE")))
  return new Promise((resolvePromise, reject) => {
    const child = spawn("claude", args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    let err = ""
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      reject(new Error(`claude took longer than ${timeoutMs / 1000}s`))
    }, timeoutMs)
    child.stdout.on("data", (d) => (out += d))
    child.stderr.on("data", (d) => (err += d))
    child.on("error", (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      if (code !== 0) return reject(new Error(`claude exited ${code}: ${err.trim().slice(0, 400)}`))
      try {
        const parsed = JSON.parse(out) as { result?: string; is_error?: boolean; model?: string }
        if (parsed.is_error) return reject(new Error(`claude reported an error: ${parsed.result ?? ""}`))
        resolvePromise((parsed.result ?? "").trim())
      } catch {
        resolvePromise(out.trim())
      }
    })
  })
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
  await git(["add", "-A", "wiki", "log.md"])
  await git(["commit", "-q", "-m", summary])
}

/* ---- Connection ------------------------------------------------------------- */

const wsUrl = `${server.replace(/^http/, "ws")}/ws/runner?token=${encodeURIComponent(token)}`
let ws: WebSocket | null = null
let attempts = 0
const pending = new Map<string, { resolve: (ack: { ok: true; card?: Card; message?: Message; report?: Report }) => void; reject: (e: Error) => void }>()
const queue: Array<() => Promise<void>> = []
let busy = false
let members = new Map<string, string>()
/** The last snapshot the server handed us: what the scripted runtime fills its templates from. */
let snapshot: CommunitySnapshot | null = null

function send(msg: RunnerClientMessage) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}
function presence(p: Presence) {
  send({ type: "presence", payload: { presence: p, runtime, ...(model ? { model } : {}) } })
}
function request(msg: Exclude<RunnerClientMessage, { type: "presence" }>): Promise<{ ok: true; card?: Card; message?: Message; report?: Report }> {
  return new Promise((resolvePromise, reject) => {
    pending.set(msg.ref, { resolve: resolvePromise, reject })
    send(msg)
    setTimeout(() => {
      if (pending.delete(msg.ref)) reject(new Error(`no ack for ${msg.type} ${msg.ref}`))
    }, 10000)
  })
}

async function refreshSnapshot() {
  try {
    const res = await fetch(`${server}/api/community`)
    const data = (await res.json()) as CommunitySnapshot
    members = new Map(data.members.map((m) => [m.id, m.name]))
    snapshot = {
      ...data,
      modules: data.modules ?? [],
      assignments: data.assignments ?? [],
      feedback: data.feedback ?? [],
      reports: data.reports ?? [],
    }
    // Seeded cards carry their wiki path: a `[[path]]` in an answer resolves
    // to them even though this process never published them.
    for (const c of data.cards) {
      if (c.authorId === agentName && c.path && !cardMap[c.path]) cardMap[c.path] = { cardId: c.id, title: c.title, publishedAt: c.publishedAt }
    }
  } catch {
    /* names fall back to ids; the scripted runtime answers from what it has */
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function handleMention(payload: Mention) {
  log(`mention from ${payload.from.name} in #${payload.channelId}${payload.intent ? ` (${payload.intent}${payload.moduleId ? ` ${payload.moduleId}` : ""})` : ""}`)
  presence("thinking")
  const before = listWiki()
  let answer: string
  let followUp: ScriptedResult["after"] | null = null
  try {
    if (runtime === "scripted") {
      if (!snapshot) throw new Error("no community snapshot yet")
      // The pause is the only "thinking" there is: long enough to read as work.
      await sleep(thinkingDelay(payload.message.id))
      const result = runScripted({ mention: payload, snapshot, agentId: agentName, agentName: members.get(agentName) ?? agentName, wikiDir, rawDir, now: new Date() })
      log(`scripted intent: ${result.intent}${result.wrote.length ? ` (+${result.wrote.length} cards)` : ""}`)
      answer = result.answer
      followUp = result.after
    } else {
      answer = await runClaude(buildPrompt(payload, members))
    }
  } catch (e) {
    log("run failed:", (e as Error).message)
    await request({
      type: "message.create",
      ref: randomUUID(),
      payload: { channelId: payload.channelId, threadId: payload.threadId, paragraphs: [[{ kind: "text", text: `I couldn't answer this time (${(e as Error).message.split("\n")[0]}). Try mentioning me again.` }]] },
    }).catch(() => {})
    presence("online")
    return
  }

  // Cards come from the filesystem, not from the model's words (design.md §6).
  const after = listWiki()
  const changed = [...after.keys()].filter((p) => before.get(p) !== after.get(p)).sort()
  if (changed.length) presence("publishing")
  const published: Record<string, string> = {}
  for (const path of changed) {
    try {
      const card = parseCard(path)
      const ack = await request({
        type: "card.publish",
        ref: randomUUID(),
        payload: {
          channelId: card.channel ?? payload.channelId,
          path,
          title: card.title,
          type: card.type,
          visibility: card.visibility,
          sources: card.sources.map((s) => ({ kind: "message" as const, ref: s, label: s })),
          ...(card.supersedes ? { replaces: card.supersedes } : {}),
          body: card.body,
        },
      })
      if (ack.card) {
        cardMap[path] = { cardId: ack.card.id, title: ack.card.title, publishedAt: ack.card.publishedAt }
        published[path] = ack.card.id
        log(`published ${path} → ${ack.card.id} (v${ack.card.version})`)
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
      payload: { channelId: payload.channelId, threadId: payload.threadId, paragraphs, ...(fromCard ? { fromCard } : {}) },
    })
    log(`answered (${paragraphs.length} paragraphs, ${cited.length} citations${fromCard ? ", from the file" : ""})`)
  } catch (e) {
    log("couldn't post the answer:", (e as Error).message)
  }
  // What the runtime wants done once the answer is on the server: a difficulty
  // suggestion for the module it compiled, a report to the teacher, a note in
  // #teachers. Each is its own request; one failing doesn't stop the others.
  for (const action of followUp ? followUp(published) : []) {
    try {
      if (action.type === "module.suggest") {
        await request({ type: "module.suggest", ref: randomUUID(), payload: action.payload })
        log(`suggested ${action.payload.difficulty.level} for ${action.payload.moduleId}`)
      } else if (action.type === "report.create") {
        const ack = await request({ type: "report.create", ref: randomUUID(), payload: action.payload })
        log(`filed a report about ${action.payload.studentId} on ${action.payload.moduleId}${ack.report ? ` (${ack.report.id})` : ""}`)
      } else {
        await request({ type: "message.create", ref: randomUUID(), payload: { channelId: action.channelId, paragraphs: toParagraphs(action.text) } })
        log(`posted in #${action.channelId}`)
      }
    } catch (e) {
      log(`after-action ${action.type} failed:`, (e as Error).message)
    }
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
    log(`connected to ${server} as runtime ${runtime}${model ? ` (${model})` : ""}; folder ${cwd}`)
    presence("online")
    void refreshSnapshot()
  })
  ws.on("message", (raw) => {
    let data: unknown
    try {
      data = JSON.parse(String(raw))
    } catch {
      return
    }
    const msg = data as { type?: string; ref?: string; ok?: boolean; error?: string; payload?: unknown; card?: Card; message?: Message }
    if (msg.type === "ack" && msg.ref) {
      const p = pending.get(msg.ref)
      if (!p) return
      pending.delete(msg.ref)
      if (msg.ok) p.resolve({ ok: true, card: msg.card, message: msg.message })
      else p.reject(new Error(msg.error ?? "rejected by the server"))
      return
    }
    if (msg.type === "agent.mention") {
      const payload = msg.payload as Parameters<typeof handleMention>[0]
      // The folder name is the agent's id (data/<course>/agents/<id>/). An answer
      // that says "mention me with @ada" would otherwise come straight back as a
      // mention and the agent would talk to itself forever.
      if (payload.message.authorId === agentName) {
        log("ignoring a mention in my own message")
        return
      }
      enqueue(async () => {
        await refreshSnapshot()
        await handleMention(payload)
      })
    }
  })
  ws.on("close", (code) => {
    if (code === 4401) {
      console.error("ada-runner: the server rejected the token (4401). Check --token against the course's community.json.")
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

log(`starting: wiki ${wikiDir}, raw ${rawDir}`)
connect()
