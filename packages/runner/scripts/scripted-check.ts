/* Checks the scripted runtime against a synthetic snapshot: the three intents,
   what they write, what they cite and what they ask the server to do after.
   Run: `npm run check:scripted -w @ada/runner` (no server needed). */

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { CommunitySnapshot, Member, Message } from "@ada/protocol"
import { detectIntent, runScripted, thinkingDelay, type ScriptedJob } from "../src/runtimes/scripted.js"

const failures: string[] = []
const check = (ok: boolean, what: string) => {
  if (!ok) failures.push(what)
  console.log(`${ok ? "ok " : "FAIL"} ${what}`)
}

const scratch = mkdtempSync(join(tmpdir(), "ada-scripted-"))
const wikiDir = join(scratch, "wiki")
const rawDir = join(scratch, "raw")
mkdirSync(join(rawDir, "martin/modules/04-attention"), { recursive: true })
writeFileSync(
  join(rawDir, "martin/modules/04-attention/attention.md"),
  "# Attention\n\n## Attention as a weighted lookup\n\nEach token produces a query, a key and a value; the dot product of query and key gives a score and the softmax over scores weighs the values. This is the whole mechanism in one line.\n\n## Why softmax instead of a plain average\n\nA plain average ignores the query. The softmax turns scores into a distribution that is sharp when one score dominates and flat when they are close, which is what makes the same layer act as a lookup or as a blend.\n\n## Why attention parallelizes\n\nA recurrent network walks the sequence one step at a time; attention computes every row of scores from the same matrices in one matrix multiplication, at a cost quadratic in the sequence length.\n",
)

const martin: Member = { kind: "person", id: "martin", name: "Martin", initials: "M", tone: "seal-soft", role: "teacher", presence: "online" }
const sofia: Member = { kind: "person", id: "sofia", name: "Sofia", initials: "S", tone: "cardstock", role: "student", presence: "online" }
const ada: Member = { kind: "agent", id: "ada", name: "Ada", scope: "community", createdBy: "martin", instructions: "", provider: { mode: "subscription", model: "Claude" }, channelIds: [], presence: "online" }
const card = (id: string, channelId: string, path: string, title: string, body: string, publishedAt: string) => ({
  id, channelId, title, type: "note" as const, authorId: "ada", version: 1, visibility: "channel" as const, sources: [], publishedAt, body, path,
})
const snapshot: CommunitySnapshot = {
  id: "c", name: "Course", subtitle: "", initial: "C",
  members: [martin, sofia, ada],
  channels: [
    { id: "03-backprop", name: "03-backprop", group: "course", memberIds: ["martin", "sofia", "ada"] },
    { id: "04-attention", name: "04-attention", group: "course", memberIds: ["martin", "sofia", "ada"] },
    { id: "teachers", name: "teachers", group: "course", memberIds: ["martin", "ada"] },
    { id: "sofia-ada", name: "Sofia · Ada", group: "private", memberIds: ["sofia", "ada"] },
  ],
  cards: [
    card("c1", "03-backprop", "modules/03-backprop/chain-rule.md", "Chain rule through the activation", "The derivative of the activation, σ'(z), multiplies the upstream gradient.", "2026-08-14T10:00:00Z"),
    card("c2", "03-backprop", "modules/03-backprop/scalar-walkthrough.md", "A scalar walkthrough of backprop", "Two layers, one number each. Follow the gradient back by hand.", "2026-08-14T10:01:00Z"),
    card("c3", "03-backprop", "modules/03-backprop/vectorized.md", "The vectorized form of backprop", "The same steps with matrices.", "2026-08-14T10:02:00Z"),
  ],
  messages: [], threads: [],
  modules: [
    { id: "03-backprop", index: 3, slug: "backprop", title: "Backpropagation", summary: "", channelId: "03-backprop", objectives: [], difficulty: { level: "core", setBy: "martin" }, status: "ready", materials: [], cardIds: ["c1", "c2", "c3"] },
    { id: "04-attention", index: 4, slug: "attention", title: "Attention", summary: "", channelId: "04-attention", objectives: [], difficulty: { level: "core" }, status: "compiling", materials: [{ id: "m1", name: "attention.md", kind: "markdown", path: "martin/modules/04-attention/attention.md", uploadedAt: "2026-08-23T08:00:00Z" }], cardIds: [] },
  ],
  assignments: [{ id: "assignment-2", moduleId: "03-backprop", channelId: "work-2", title: "Assignment 2 · Backprop by hand", due: "2026-08-20", status: "submitted" }],
  feedback: [{ id: "f1", assignmentId: "assignment-2", studentId: "sofia", agentId: "ada", at: "2026-08-21T10:00:00Z", score: { got: 6, of: 10 }, summary: "", strengths: ["The forward pass was correct."], gaps: [{ moduleId: "03-backprop", note: "In layer 2 you multiplied by σ(z) instead of σ′(z): the chain rule through the activation needs the derivative.", cardId: "c1" }], nextSteps: [] }],
  reports: [],
}

const msg = (id: string, channelId: string, authorId: string, text: string): Message => ({ id, channelId, authorId, at: "2026-08-23T08:00:00Z", paragraphs: [[{ kind: "text", text }]] })
const job = (mention: ScriptedJob["mention"]): ScriptedJob => ({ mention, snapshot, agentId: "ada", agentName: "Ada", wikiDir, rawDir, now: new Date("2026-08-23T08:05:00Z") })

// Thinking delay: deterministic and within the 1.2–2.5 s window.
const d1 = thinkingDelay("m-1")
check(d1 === thinkingDelay("m-1") && d1 >= 1200 && d1 <= 2500, `thinking delay is deterministic and in range (${d1} ms)`)

// Ingest: one card per heading, published into the module channel, a difficulty suggestion after.
const ingest = runScripted(job({ channelId: "04-attention", message: msg("m-1", "04-attention", "martin", "@ada ingest attention.md into 04-attention"), from: martin, context: [], intent: "ingest", moduleId: "04-attention" }))
check(ingest.intent === "ingest", "ingest intent detected from the hint")
check(ingest.wrote.length === 3 && ingest.wrote.every((p) => p.startsWith("modules/04-attention/") && existsSync(join(wikiDir, p))), `ingest wrote one card per heading (${ingest.wrote.length})`)
const front = readFileSync(join(wikiDir, ingest.wrote[0]), "utf8")
check(/^---\ntitle: Attention as a weighted lookup\ntype: topic\nchannel: 04-attention\n/.test(front), "ingest cards carry title/type/channel frontmatter")
check(ingest.wrote.every((p) => ingest.answer.includes(`[[${p}|`)), "ingest answer cites every card it wrote")
const suggest = ingest.after({}).find((a) => a.type === "module.suggest")
check(suggest?.type === "module.suggest" && suggest.payload.moduleId === "04-attention" && suggest.payload.status === "ready" && suggest.payload.difficulty.rationale.includes("attention.md"), "ingest suggests a difficulty for the module with a rationale naming the material")

// Plan: starts from the feedback gap, cites ≥2 module cards, files a report and a #teachers note, ends with the sharing line.
const plan = runScripted(job({ channelId: "sofia-ada", message: msg("m-2", "sofia-ada", "sofia", "How do I get ahead in 03-backprop?"), from: sofia, context: [] }))
check(plan.intent === "plan", "plan intent detected from a student's question in her private channel")
const cites = [...plan.answer.matchAll(/\[\[([^\]|]+)\|/g)].map((m) => m[1])
check(cites.filter((p) => p.startsWith("modules/03-backprop/")).length >= 2, `plan cites at least two module cards (${cites.length})`)
check(plan.answer.indexOf("Chain rule through the activation") < plan.answer.indexOf("A scalar walkthrough"), "plan puts the gap card first")
check(/the slip was in layer 2 you multiplied/i.test(plan.answer), "plan names the feedback gap")
check(/I shared a summary of this plan with Martin/.test(plan.answer), "plan ends with the sharing line")
check(plan.wrote.length === 1 && plan.wrote[0] === "questions/plan-sofia-03-backprop.md", "plan writes the plan card")
const after = plan.after({ "questions/plan-sofia-03-backprop.md": "plan-card-id" })
const report = after.find((a) => a.type === "report.create")
check(report?.type === "report.create" && report.payload.studentId === "sofia" && report.payload.moduleId === "03-backprop" && report.payload.recommendations.length === 3 && report.payload.cardIds.includes("plan-card-id"), "plan files a report with three recommendations and the plan card")
const note = after.find((a) => a.type === "message")
check(note?.type === "message" && note.channelId === "teachers" && note.text.includes("[[questions/plan-sofia-03-backprop.md|"), "plan posts a note in #teachers citing the plan card")
check(!/σ\(z\) instead of σ′\(z\):\s*the chain rule through the activation needs the derivative\.\./.test(plan.answer), "no doubled period after the gap")

// Question: answers from the best card, or says what it checked.
const q = runScripted(job({ channelId: "03-backprop", message: msg("m-3", "03-backprop", "sofia", "@ada what does the derivative of the activation do in the chain rule?"), from: sofia, context: [] }))
check(q.intent === "question" && q.answer.includes("[[modules/03-backprop/chain-rule.md|"), "question answers with the matching card")
const miss = runScripted(job({ channelId: "03-backprop", message: msg("m-4", "03-backprop", "sofia", "@ada tell me about transformers and positional encodings"), from: sofia, context: [] }))
check(miss.intent === "question" && !miss.answer.includes("[[") && /don't have a card/.test(miss.answer), "unknown question gets an honest miss without an invented citation")
check(detectIntent(job({ channelId: "03-backprop", message: msg("m-5", "03-backprop", "sofia", "@ada how do I get ahead in backprop?"), from: sofia, context: [] })).intent === "plan", "plan intent also detected by module slug in a course channel")

rmSync(scratch, { recursive: true, force: true })
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log("\nScripted runtime OK")
