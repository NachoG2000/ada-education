/* End-to-end flow test for the teacher/student demo: a throwaway copy of the
   course, a temp DB, the server on a spare port and the REAL scripted runner
   process — then the exact flows the two screens drive, asserted at the API:

   1. the seeded snapshot the screens render (modules, feedback, history);
   2. teacher uploads material → compiling → cards published → ready + suggestion;
   3. student asks for a plan in her private channel → thinking → plan message
      with citations and the sharing line → report filed → #teachers note;
   4. teacher reconciles → decision card in the module channel + report reconciled.

   Run: `npm run check:e2e -w @ada/server`. Never touches the demo DB or data. */

import { spawn, type ChildProcess } from "node:child_process"
import { cpSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { WebSocket } from "ws"
import type { Card, CommunitySnapshot, Message, Module, Report } from "@ada/protocol"
import { repoRoot } from "../src/db.js"
import { makeHarness, runTsx, serverUp, stopChild, tsxBin, until } from "./lib.js"

const port = Number(process.env.E2E_PORT ?? "8798")
const base = `http://localhost:${port}`
const { check, failures } = makeHarness()

const snapshot = async (): Promise<CommunitySnapshot> => (await fetch(`${base}/api/community`)).json() as Promise<CommunitySnapshot>
async function post(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

const text = (m: Message) => m.paragraphs.map((p) => p.map((b) => b.text).join("")).join("\n")
const cites = (m: Message) => m.paragraphs.flat().filter((b) => b.kind === "cite")

async function main(): Promise<void> {
  const scratch = mkdtempSync(join(tmpdir(), "ada-e2e-"))
  const courseDir = join(scratch, "course")
  cpSync(resolve(repoRoot, "data/neural-networks-2026"), courseDir, { recursive: true })
  const env = { ...process.env, ADA_COURSE: courseDir, ADA_DB: join(scratch, "e2e.db"), PORT: String(port) }
  let server: ChildProcess | undefined
  let runner: ChildProcess | undefined
  try {
    if ((await runTsx(["apps/server/src/seed.ts"], env)) !== 0) throw new Error("seed failed")
    server = spawn(tsxBin, ["apps/server/src/index.ts"], { cwd: repoRoot, env, stdio: ["ignore", "ignore", "inherit"] })
    await serverUp(base)
    runner = spawn(
      tsxBin,
      ["packages/runner/src/cli.ts", "--cwd", join(courseDir, "agents/ada"), "--token", "ada-demo-token", "--server", base, "--runtime", "scripted"],
      { cwd: repoRoot, env: { ...env, ADA_RUNTIME: "scripted" }, stdio: ["ignore", "ignore", "inherit"] },
    )
    const events: Array<{ type: string; payload?: Record<string, unknown> }> = []
    const ws = new WebSocket(`${base.replace(/^http/, "ws")}/ws`)
    ws.on("message", (raw) => events.push(JSON.parse(String(raw)) as { type: string }))
    await until("runner online", async () => ((await snapshot()).members.find((m) => m.id === "ada")?.presence === "online" ? true : undefined))

    // 1. What the two screens render on load (AC-UI-1, AC-UI-3).
    let s = await snapshot()
    const m03 = s.modules.find((m) => m.id === "03-backprop") as Module
    check(!!m03 && m03.status === "ready" && m03.cardIds.length >= 4 && !!m03.difficulty.rationale && (m03.difficulty.evidence?.length ?? 0) > 0, "Modules screen data: 03-backprop ready, cards, difficulty rationale + cohort evidence")
    const fb = s.feedback.find((f) => f.studentId === "sofia")
    check(!!fb && fb.score.got === 6 && fb.gaps[0]?.moduleId === "03-backprop" && !!fb.gaps[0]?.cardId && fb.nextSteps.some((n) => n.cardId), "Study screen data: Sofia's 6/10 feedback with gap card and next-step citations")
    check(s.messages.filter((m) => m.channelId === "sofia-ada").length >= 2 && s.messages.filter((m) => m.channelId === "teachers").length >= 2, "seeded history in sofia-ada and #teachers")

    // 2. Teacher uploads material on the empty module (AC-UI-2).
    const material = "# Attention\n\n## Attention as a weighted lookup\n\nQueries, keys and values; softmax over scores weighs the values. A worked 3-token example makes the lookup visible.\n\n## Why softmax instead of a plain average\n\nA plain average ignores the query; the softmax sharpens or blends depending on the score spread, scaled by the key dimension.\n\n## Why attention parallelizes\n\nEvery row of scores comes from the same matrices in one multiplication; recurrence walks the sequence step by step.\n"
    const uploaded = (await post("/api/modules/04-attention/materials", { name: "attention.md", kind: "markdown", size: material.length, text: material, authorId: "martin" })) as Module
    check(uploaded.status === "compiling" && uploaded.materials.some((x) => x.name === "attention.md"), "upload: material listed and module compiling")
    const ready = await until("module 04 ready with cards", async () => {
      const now = await snapshot()
      const m = now.modules.find((x) => x.id === "04-attention")
      return m && m.status === "ready" && m.cardIds.length >= 3 ? m : undefined
    })
    check(ready.difficulty.suggestedBy === "ada" && !!ready.difficulty.rationale?.includes("attention.md"), "ingest: Ada suggested a difficulty with a rationale naming the material")
    s = await snapshot()
    const ingestAnswer = s.messages.filter((m) => m.channelId === "04-attention" && m.authorId === "ada" && !m.publishes).at(-1)
    check(!!ingestAnswer && cites(ingestAnswer).length >= 3 && /Filed 3 cards/.test(text(ingestAnswer)), "ingest: answer in the channel cites the three new cards")

    // 3. Student presses Enter on the suggested question (AC-UI-4).
    const seenThinking = until("thinking presence", async () =>
      events.some((e) => e.type === "member.presence" && (e.payload as { presence?: string } | undefined)?.presence === "thinking") ? true : undefined)
    await post("/api/channels/sofia-ada/messages", { authorId: "sofia", paragraphs: [[{ kind: "text", text: "How do I get ahead in 03-backprop?" }]] })
    check(await seenThinking, "plan: Ada showed thinking before answering")
    const plan = await until("plan answer", async () => {
      const now = await snapshot()
      return now.messages.find((m) => m.channelId === "sofia-ada" && m.authorId === "ada" && /shared a summary of this plan/.test(text(m)))
    })
    check(cites(plan).length >= 2, "plan: cites at least two cards")
    check(/the slip was in layer 2/i.test(text(plan)), "plan: names Sofia's feedback gap")
    s = await snapshot()
    const report = s.reports.find((r) => r.studentId === "sofia" && r.moduleId === "03-backprop" && r.status === "new") as Report
    check(!!report && report.recommendations.length === 3 && report.told.length > 40, "report: filed for the teacher with three recommendations")
    check(!report.told.includes("How do I get ahead"), "report: carries Ada's summary, not the student's message")
    const teacherNote = s.messages.filter((m) => m.channelId === "teachers" && m.authorId === "ada").at(-1)
    check(!!teacherNote && cites(teacherNote).some((b) => b.kind === "cite"), "report: #teachers note cites the plan card")

    // 4. Teacher reconciles (AC-UI-5).
    const reconciled = (await post(`/api/reports/${report.id}/reconcile`, { accepted: report.recommendations.slice(0, 2).map((r) => r.id), note: "Scalar example first; name σ′(z) on the card.", authorId: "martin" })) as Report
    check(reconciled.status === "reconciled" && reconciled.reconciled?.accepted.length === 2, "reconcile: report marked reconciled with the accepted items")
    s = await snapshot()
    const decision = s.cards.find((c) => c.id === reconciled.reconciled?.cardId) as Card
    check(!!decision && decision.type === "decision" && decision.channelId === "03-backprop" && decision.authorId === "martin" && decision.body.includes("Scalar example first"), "reconcile: decision card by the teacher in the module channel with the note")
    check((s.modules.find((m) => m.id === "03-backprop")?.revision ?? "").includes("2 changes accepted"), "reconcile: module shows the revision line")

    ws.close()
  } finally {
    await Promise.all([stopChild(runner), stopChild(server)])
    rmSync(scratch, { recursive: true, force: true })
  }
  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed`)
    process.exit(1)
  }
  console.log("\nE2E flow OK")
}

main().catch((error) => {
  console.error(`E2E failed: ${(error as Error).message}`)
  process.exit(1)
})
