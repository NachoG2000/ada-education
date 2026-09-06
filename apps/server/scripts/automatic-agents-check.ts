/** Real server + host + workers; fake provider, throwaway data, no model credentials. */
import assert from "node:assert/strict"
import { spawn, type ChildProcess } from "node:child_process"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { randomBytes } from "node:crypto"
import { once } from "node:events"

const scratch = mkdtempSync(join(tmpdir(), "ada-automatic-agents-"))
const binary = join(scratch, "bin")
const state = join(scratch, "host")
const trace = join(scratch, "provider.jsonl")
mkdirSync(binary)
writeFileSync(join(binary, "claude"), `#!/usr/bin/env node
const fs = require('node:fs');
const input = fs.readFileSync(0, 'utf8');
const entry = { pid: process.pid, cwd: process.cwd(), input, secret: Object.keys(process.env).some(k => /^ADA_.*(?:TOKEN|SECRET|CODE|KEY)$/.test(k)), key: !!process.env.ANTHROPIC_API_KEY };
fs.appendFileSync(process.env.ADA_TEST_TRACE, JSON.stringify({ ...entry, event: 'start' }) + '\\n');
const marker = input.includes('RULE_SECOND') ? 'RULE_SECOND' : 'RULE_FIRST';
fs.writeFileSync('memory-check.txt', marker);
const timer = setTimeout(() => {
  fs.appendFileSync(process.env.ADA_TEST_TRACE, JSON.stringify({ pid: process.pid, event: 'end' }) + '\\n');
  console.log(JSON.stringify({ result: marker }));
}, input.includes('SLOW_WORK') ? 30000 : 250);
process.on('SIGTERM', () => { clearTimeout(timer); process.exit(0); });
`, { mode: 0o755 })
process.env.ADA_DB = join(scratch, "test.db")
process.env.PORT = "0"
process.env.ADA_RUNNER_HOST_TOKEN = randomBytes(32).toString("base64url")
delete process.env.ADA_MODEL
delete process.env.ADA_RUNTIME
const { startServer } = await import("../src/index.js")
const running = startServer()
const address = running.server.address()
assert(address && typeof address !== "string")
const server = `http://127.0.0.1:${address.port}`
const repo = resolve(import.meta.dirname, "../../..")
let host: ChildProcess | undefined
let output = ""
async function stopHost() {
  if (!host || host.exitCode !== null) return
  const child = host
  const ended = once(child, "exit")
  child.kill("SIGTERM")
  await ended
  host = undefined
}
function startHost() {
  host = spawn(process.execPath, ["--import", "tsx", "packages/runner/src/host.ts"], {
    cwd: repo,
    env: { ...process.env, PATH: `${binary}:${process.env.PATH}`, ADA_SERVER: server, ADA_HOST_STATE: state,
      ADA_PROVIDER_AUTH: "subscription", ANTHROPIC_API_KEY: "must-be-stripped", ADA_TEST_TRACE: trace },
    stdio: ["ignore", "pipe", "pipe"],
  })
  host.stdout?.on("data", (data) => { output += String(data) })
  host.stderr?.on("data", (data) => { output += String(data) })
}
async function request(path: string, token?: string, body?: unknown, method = body ? "POST" : "GET", expected = body ? 201 : 200): Promise<any> {
  const response = await fetch(`${server}${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  assert.equal(response.status, expected, `${method} ${path}: ${await response.clone().text()}`)
  return response.json()
}
async function until(check: () => Promise<boolean> | boolean, label: string) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (await check()) return
    await new Promise((done) => setTimeout(done, 100))
  }
  throw new Error(`Timed out: ${label}\n${output}`)
}
const entries = (): any[] => existsSync(trace) ? readFileSync(trace, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) : []
try {
  const teacher = await request("/api/users", undefined, { displayName: "Host test teacher" })
  await request("/api/runner-host/enroll", teacher.token, { enrollments: [] }, "POST", 401)
  const created = await request("/api/communities", teacher.token, { name: "Automatic classroom", term: "Test", starterAgents: true })
  const base = `/api/communities/${created.community.id}`
  let agents = await request(`${base}/agents`, teacher.token)
  assert.equal(agents.length, 2)
  const first = agents[0]
  const second = agents[1]
  await request(`${base}/agents/${first.id}`, teacher.token, { instructions: "RULE_FIRST" }, "PATCH", 200)
  startHost()
  await until(async () => (await request(base, teacher.token)).agents.every((agent: any) => agent.presence === "online"), "starter connections")
  const dm = await request(`${base}/dms`, teacher.token, { agentId: first.id })
  const dm2 = await request(`${base}/dms`, teacher.token, { agentId: second.id })
  const send = (channelId: string, text: string) => request(`${base}/channels/${channelId}/messages`, teacher.token, { paragraphs: [[{ kind: "text", text }]] })
  const messages = (channelId: string) => request(`${base}/channels/${channelId}/messages`, teacher.token)
  await Promise.all([send(dm.channel.id, "Hello"), send(dm2.channel.id, "Hello")])
  await until(async () => (await messages(dm.channel.id)).some((m: any) => m.authorId === first.id) && (await messages(dm2.channel.id)).some((m: any) => m.authorId === second.id), "implicit DM replies")
  let inFlight = 0
  for (const entry of entries()) { inFlight += entry.event === "start" ? 1 : -1; assert(inFlight >= 0 && inFlight <= 1, "host serializes provider invocations") }
  assert(entries().filter((entry) => entry.event === "start").every((entry) => !entry.secret && !entry.key), "provider environment excludes transport secrets and API keys")
  const credentials = readFileSync(join(state, "enrollments.json"), "utf8")
  const workspace = entries().find((entry) => entry.event === "start" && entry.cwd.endsWith(first.id)).cwd
  assert(existsSync(join(workspace, "memory-check.txt")))
  await stopHost()
  startHost()
  await until(async () => (await request(base, teacher.token)).agents.every((agent: any) => agent.presence === "online"), "restart connections")
  assert.equal(readFileSync(join(state, "enrollments.json"), "utf8"), credentials, "restart preserves credentials")
  assert(existsSync(join(workspace, "memory-check.txt")), "restart preserves agent files")
  await request(`${base}/agents/${first.id}`, teacher.token, { instructions: "RULE_SECOND", channelIds: [] }, "PATCH", 200)
  await send(dm.channel.id, "Use your new rules")
  await until(async () => (await messages(dm.channel.id)).some((m: any) => m.authorId === first.id && JSON.stringify(m.paragraphs).includes("RULE_SECOND")), "edited rules reach next work")
  const custom = await request(`${base}/agents`, teacher.token, { name: "Custom", instructions: "RULE_FIRST", channelIds: [] })
  await until(async () => (await request(base, teacher.token)).agents.some((agent: any) => agent.id === custom.agent.id && agent.presence === "online"), "new custom agent connection")
  const other = await request("/api/communities", teacher.token, { name: "Second classroom", term: "Test", starterAgents: true })
  const otherAgents = await request(`/api/communities/${other.community.id}/agents`, teacher.token)
  assert(otherAgents.every((agent: any) => !agents.some((existing: any) => existing.id === agent.id)))
  await request(`/api/communities/${other.community.id}/dms`, teacher.token, { agentId: first.id }, "POST", 404)
  await send(dm.channel.id, "SLOW_WORK")
  await until(() => entries().some((entry) => entry.event === "start" && entry.input.includes("SLOW_WORK")), "long invocation started")
  const pid = entries().findLast((entry) => entry.event === "start" && entry.input.includes("SLOW_WORK")).pid
  await request(`${base}/agents/${first.id}`, teacher.token, undefined, "DELETE")
  await until(() => { try { process.kill(pid, 0); return false } catch { return true } }, "deletion terminates provider")
  await request(`${base}/channels/${dm.channel.id}/messages`, teacher.token, { paragraphs: [[{ kind: "text", text: "Cannot send" }]] }, "POST", 409)
  assert((await messages(dm.channel.id)).some((m: any) => m.authorId === first.id), "deleted agent history remains readable")
  agents = await request(`${base}/agents`, teacher.token)
  assert(!JSON.stringify(agents).includes("runnerToken"))
  console.log("Automatic agents OK: templates, enrollment authorization, DMs, rules, concurrency, restart, isolation, custom creation, deletion, and history.")
} finally {
  await stopHost()
  await running.close()
  rmSync(scratch, { recursive: true, force: true })
}
