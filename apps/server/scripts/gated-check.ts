/* Membership gating end to end (DECISIONS.md §20): a throwaway copy of the
   course, a gated server (owner token + rotated agent token), and the REAL
   scripted runner working from a folder that does NOT share the server's disk:

   1. the doors: /health and /api/course answer; /api/community without a
      token is 401 and leaks nothing;
   2. owner claim: wrong token 401, right token binds the teacher;
   3. invites: teacher mints, student joins by name, reuse is 410, a student
      can't mint, and member.joined reaches an authenticated WS;
   4. token-derived authorship: writing as someone else is 403;
   5. WS gating: /ws without a token closes 4401, with one it streams;
   6. remote material sync: the runner downloads the uploaded material into
      its own raw/ before ingesting — cards get published anyway.

   Run: `npm run check:gated -w @ada/server`. Never touches the demo DB. */

import { spawn, type ChildProcess } from "node:child_process"
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { WebSocket } from "ws"
import type { CommunitySnapshot, Module } from "@ada/protocol"
import { repoRoot } from "../src/db.js"
import { makeHarness, runTsx, serverUp, stopChild, tsxBin, until } from "./lib.js"

// 8799 is smoke's, 8798 is the e2e flow's: a distinct port so the three can run back to back (or at once).
const port = Number(process.env.GATED_PORT ?? "8797")
const base = `http://localhost:${port}`
const OWNER_TOKEN = "gated-check-owner-token"
const AGENT_TOKEN = "gated-check-agent-token"
const { check, failures } = makeHarness()

type Json = Record<string, unknown>
async function req(method: string, path: string, body?: unknown, token?: string): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Json }
}

function wsCloseCode(url: string): Promise<number> {
  return new Promise((resolvePromise) => {
    const socket = new WebSocket(url)
    socket.on("close", (code) => resolvePromise(code))
    socket.on("error", () => {})
    setTimeout(() => socket.close(), 4000)
  })
}

async function main(): Promise<void> {
  const scratch = mkdtempSync(join(tmpdir(), "ada-gated-"))
  const courseDir = join(scratch, "course")
  cpSync(resolve(repoRoot, "data/neural-networks-2026"), courseDir, { recursive: true })
  // The runner's own home: agent folder copied, raw/ EMPTY — nothing shared
  // with the server's disk, so ingest only works if the sync pulls the file.
  const runnerCourse = join(scratch, "runner-course")
  mkdirSync(join(runnerCourse, "raw"), { recursive: true })
  cpSync(join(courseDir, "agents"), join(runnerCourse, "agents"), { recursive: true })

  const env = {
    ...process.env,
    ADA_COURSE: courseDir,
    ADA_DB: join(scratch, "gated.db"),
    PORT: String(port),
    ADA_REQUIRE_MEMBERSHIP: "1",
    ADA_OWNER_TOKEN: OWNER_TOKEN,
    ADA_AGENT_TOKEN: AGENT_TOKEN,
  }
  let server: ChildProcess | undefined
  let runner: ChildProcess | undefined
  try {
    if ((await runTsx(["apps/server/src/seed.ts"], env)) !== 0) throw new Error("seed failed")
    server = spawn(tsxBin, ["apps/server/src/index.ts"], { cwd: repoRoot, env, stdio: ["ignore", "ignore", "inherit"] })
    await serverUp(base)

    // 1. The doors.
    check((await req("GET", "/health")).json.ok === true, "GET /health answers without auth")
    const course = await req("GET", "/api/course")
    check(course.status === 200 && course.json.name === "Neural Networks 2026" && course.json.requireMembership === true, "GET /api/course shows only the course's public face")
    const closed = await req("GET", "/api/community")
    check(closed.status === 401 && !("members" in closed.json), "GET /api/community without a token is 401 and leaks nothing")

    // 2. Owner claim.
    check((await req("POST", "/api/claim", { token: "wrong" })).status === 401, "claim with a wrong owner token is 401")
    const claimed = await req("POST", "/api/claim", { token: OWNER_TOKEN })
    const teacherToken = claimed.json.personToken as string
    check(claimed.status === 200 && claimed.json.personId === "martin" && typeof teacherToken === "string" && teacherToken.length > 20, "claim binds the course's teacher and mints a person token")
    const reclaimed = await req("POST", "/api/claim", { token: OWNER_TOKEN })
    check(reclaimed.status === 200 && reclaimed.json.personId === "martin" && reclaimed.json.personToken !== teacherToken, "re-claim rotates the teacher token without duplicating people")
    const rotatedTeacherToken = reclaimed.json.personToken as string
    const snapshotAs = async (token: string): Promise<CommunitySnapshot> => (await req("GET", "/api/community", undefined, token)).json as unknown as CommunitySnapshot
    check((await req("GET", "/api/community", undefined, teacherToken)).status === 401, "the pre-rotation token stops working")
    check((await snapshotAs(rotatedTeacherToken)).members.some((m) => m.id === "martin"), "the teacher's token reads the community")
    check((await req("GET", "/api/community", undefined, AGENT_TOKEN)).status === 200, "the rotated agent token reads the community (runner snapshot fetch)")

    // 3. WS gating.
    check((await wsCloseCode(`${base.replace(/^http/, "ws")}/ws`)) === 4401, "/ws without a token closes 4401")
    const events: Array<{ type: string; payload?: Record<string, unknown> }> = []
    const ws = new WebSocket(`${base.replace(/^http/, "ws")}/ws?token=${encodeURIComponent(rotatedTeacherToken)}`)
    ws.on("message", (raw) => events.push(JSON.parse(String(raw)) as { type: string }))
    await new Promise<void>((resolveOpen, rejectOpen) => {
      ws.on("open", () => resolveOpen())
      ws.on("close", () => rejectOpen(new Error("authorized /ws closed")))
    })
    check(true, "/ws with the teacher's token stays open")

    // 4. Invites and joins.
    const invite = await req("POST", "/api/invites", {}, rotatedTeacherToken)
    check(invite.status === 200 && typeof invite.json.token === "string" && (invite.json.joinHash as string).startsWith("#join?token="), "teacher mints a single-use invite")
    const joined = await req("POST", "/api/join", { token: invite.json.token, name: "Nina Torres" })
    const ninaToken = joined.json.personToken as string
    check(joined.status === 200 && joined.json.personId === "nina-torres" && typeof ninaToken === "string", "an invite plus a name becomes a student")
    check((await req("POST", "/api/join", { token: invite.json.token, name: "Second Try" })).status === 410, "a used invite is 410")
    check((await req("POST", "/api/invites", {}, ninaToken)).status === 403, "a student can't mint invites")
    const nina = (await snapshotAs(rotatedTeacherToken)).members.find((m) => m.id === "nina-torres")
    check(nina?.kind === "person" && nina.role === "student", "the new member is a student in the snapshot")
    check((await snapshotAs(ninaToken)).channels.some((c) => c.id === "questions" && c.memberIds.includes("nina-torres")), "the new student is in the open channels")
    const ninaSnapshot = await snapshotAs(ninaToken)
    check(!ninaSnapshot.channels.some((c) => c.id === "teachers"), "the new student cannot see #teachers")
    check(!ninaSnapshot.messages.some((message) => message.channelId === "teachers"), "the new student cannot see #teachers messages")
    await until("member.joined over WS", async () =>
      events.some((e) => e.type === "member.joined" && (e.payload as { member?: { id?: string } } | undefined)?.member?.id === "nina-torres") ? true : undefined)
    check(true, "member.joined reached the authenticated WS")

    // 5. Token-derived authorship.
    const hello = { paragraphs: [[{ kind: "text", text: "hello from the gated check" }]] }
    check((await req("POST", "/api/channels/questions/messages", { ...hello, authorId: "nina-torres" })).status === 401, "writing without a token is 401")
    check((await req("POST", "/api/channels/questions/messages", { ...hello, authorId: "martin" }, ninaToken)).status === 403, "writing as someone else is 403")
    check((await req("POST", "/api/channels/questions/messages", { ...hello, authorId: "nina-torres" }, ninaToken)).status === 200, "writing as yourself lands")

    // 6. Remote material sync: runner on its own disk, gated server.
    runner = spawn(
      tsxBin,
      ["packages/runner/src/cli.ts", "--cwd", join(runnerCourse, "agents/ada"), "--token", AGENT_TOKEN, "--server", base, "--runtime", "scripted"],
      { cwd: repoRoot, env: { ...env, ADA_RUNTIME: "scripted" }, stdio: ["ignore", "ignore", "inherit"] },
    )
    await until("runner online", async () =>
      (await snapshotAs(rotatedTeacherToken)).members.find((m) => m.id === "ada")?.presence === "online" ? true : undefined)
    // Section bodies must clear the scripted runtime's 40-char floor to become cards.
    const material = "# Attention\n\n## Attention as a weighted lookup\n\nQueries, keys and values; softmax over scores weighs the values. A worked 3-token example makes the lookup visible.\n\n## Why softmax instead of a plain average\n\nA plain average ignores the query; the softmax sharpens or blends depending on the score spread, scaled by the key dimension.\n\n## Why attention parallelizes\n\nEvery row of scores comes from the same matrices in one multiplication; recurrence walks the sequence step by step.\n"
    const uploaded = await req("POST", "/api/modules/04-attention/materials", { name: "attention.md", kind: "markdown", size: material.length, text: material, authorId: "martin" }, rotatedTeacherToken)
    check(uploaded.status === 200 && (uploaded.json as unknown as Module).status === "compiling", "teacher uploads material with their token")
    const ready = await until("module 04 ready with cards (remote runner)", async () => {
      const m = (await snapshotAs(rotatedTeacherToken)).modules.find((x) => x.id === "04-attention")
      return m && m.status === "ready" && m.cardIds.length >= 3 ? m : undefined
    }, 30000)
    check(ready.cardIds.length >= 3, "ingest published cards from a runner that doesn't share the server's disk")
    check(existsSync(join(runnerCourse, "raw/martin/modules/04-attention/attention.md")), "the runner synced the material into its own raw/")

    ws.close()
  } finally {
    await Promise.all([stopChild(runner), stopChild(server)])
    rmSync(scratch, { recursive: true, force: true })
  }
  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed`)
    process.exit(1)
  }
  console.log("\nGated flow OK")
}

main().catch((error) => {
  console.error(`Gated check failed: ${(error as Error).message}`)
  process.exit(1)
})
