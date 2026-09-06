#!/usr/bin/env node
import { spawn, type ChildProcess } from "node:child_process"
import { chmodSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { resolve, join } from "node:path"
import { fileURLToPath } from "node:url"
import { runnerHostResponseSchema, type RunnerHostAgent } from "@ada/protocol"

const server = process.env.ADA_SERVER ?? "http://localhost:8787"
const hostToken = process.env.ADA_RUNNER_HOST_TOKEN
if (!hostToken || hostToken.length < 32) throw new Error("Set the installation's ADA_RUNNER_HOST_TOKEN, or use npm run dev.")
const root = resolve(process.env.ADA_HOST_STATE ?? ".ada")
mkdirSync(root, { recursive: true, mode: 0o700 })
chmodSync(root, 0o700)
const lock = join(root, "host.lock")
try {
  const pid = Number(readFileSync(lock, "utf8"))
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error("Invalid host.lock; inspect it before restarting.")
  try { process.kill(pid, 0); throw new Error("An agent host already owns this state directory.") } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error
    unlinkSync(lock)
  }
} catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
writeFileSync(lock, String(process.pid), { flag: "wx", mode: 0o600 })

const stateFile = join(root, "enrollments.json")
let known: RunnerHostAgent[] = []
try {
  const saved = JSON.parse(readFileSync(stateFile, "utf8")) as { server?: string; agents?: unknown }
  if (saved.server === server) known = runnerHostResponseSchema.parse({ agents: saved.agents }).agents
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    unlinkSync(lock)
    throw new Error("Cannot read host enrollments. Restore the state file before restarting.")
  }
}

type Worker = { child: ChildProcess; config: string }
const workers = new Map<string, Worker>()
const retryAt = new Map<string, number>()
const waiting: ChildProcess[] = []
let executing: ChildProcess | undefined
let stopping = false
let failed = false

function grantNext() {
  if (stopping || executing) return
  const child = waiting.shift()
  if (!child) return
  if (!child.connected) { grantNext(); return }
  executing = child
  child.send({ type: "run.granted" }, (error) => { if (error) release(child) })
}

function release(child: ChildProcess) {
  for (let i = waiting.length - 1; i >= 0; i--) if (waiting[i] === child) waiting.splice(i, 1)
  if (executing === child) executing = undefined
  grantNext()
}

async function stopWorker(worker: Worker) {
  const { child } = worker
  if (!child.pid) return
  const signal = (value: NodeJS.Signals) => {
    try {
      if (process.platform === "win32") child.kill(value)
      else process.kill(-child.pid!, value)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === "ESRCH") return
      // concurrently may already be terminating the same group. On macOS a
      // disappearing group can reject group signaling while its child handle
      // is still awaiting the exit event; finish through that handle.
      if (code === "EPERM") { child.kill(value); return }
      throw error
    }
  }
  // The process group includes the provider and any of its child tools.
  signal("SIGTERM")
  await new Promise<void>((done) => {
    const timer = setTimeout(() => { signal("SIGKILL"); done() }, 1_000)
    child.once("exit", () => { clearTimeout(timer); signal("SIGKILL"); done() })
  })
  release(child)
}

function startWorker(agent: RunnerHostAgent) {
  if (![agent.communityId, agent.agentId].every((id) => /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id))) throw new Error("Invalid agent workspace identity")
  const env = { ...process.env }
  delete env.ADA_RUNNER_HOST_TOKEN
  delete env.ADA_HOST_STATE
  const child = spawn(process.execPath, ["--import", "tsx", fileURLToPath(new URL("./cli.ts", import.meta.url))], {
    detached: process.platform !== "win32",
    stdio: ["ignore", "inherit", "inherit", "ipc"],
    env: { ...env, ADA_SERVER: server, ADA_COMMUNITY_ID: agent.communityId, ADA_AGENT_ID: agent.agentId,
      ADA_AGENT_TOKEN: agent.runnerToken, ADA_RUNTIME: agent.runtime, ADA_MODEL: agent.model,
      ADA_AGENT_CWD: join(root, "communities", agent.communityId, "agents", agent.agentId),
      ADA_MATERIALS: join(root, "communities", agent.communityId, "raw") },
  })
  workers.set(agent.agentId, { child, config: JSON.stringify(agent) })
  child.on("message", (message: unknown) => {
    if (!message || typeof message !== "object" || !("type" in message)) return
    if (message.type === "run.acquire" && executing !== child && !waiting.includes(child)) { waiting.push(child); grantNext() }
    if (message.type === "run.release") release(child)
  })
  child.on("error", () => console.error("Agent worker could not start; retrying shortly."))
  child.on("exit", () => {
    if (process.platform !== "win32" && child.pid) { try { process.kill(-child.pid, "SIGKILL") } catch { /* group already gone */ } }
    release(child)
    if (workers.get(agent.agentId)?.child === child) {
      workers.delete(agent.agentId)
      retryAt.set(agent.agentId, Date.now() + 10_000)
    }
  })
}

async function reconcile() {
  const response = await fetch(`${server}/api/runner-host/enroll`, {
    method: "POST", headers: { authorization: `Bearer ${hostToken}`, "content-type": "application/json" },
    body: JSON.stringify({ enrollments: known.map(({ agentId, runnerToken }) => ({ agentId, runnerToken })) }),
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) throw new Error(`Agent host enrollment failed (${response.status}). Check the installation connection.`)
  const { agents } = runnerHostResponseSchema.parse(await response.json())
  if (stopping) return
  const next = new Map(agents.map((agent) => [agent.agentId, agent]))
  for (const [id, worker] of workers) {
    if (JSON.stringify(next.get(id)) !== worker.config) {
      await stopWorker(worker)
      workers.delete(id)
      retryAt.delete(id)
    }
  }
  // Save credentials before launching, so restarting does not rotate them.
  if (JSON.stringify(known) !== JSON.stringify(agents)) {
    writeFileSync(`${stateFile}.tmp`, JSON.stringify({ server, agents }), { mode: 0o600 })
    renameSync(`${stateFile}.tmp`, stateFile)
    known = agents
  }
  for (const agent of agents) if (!stopping && !workers.has(agent.agentId) && (retryAt.get(agent.agentId) ?? 0) <= Date.now()) startWorker(agent)
  if (failed) console.log("Agent host connection restored.")
  failed = false
}

async function shutdown() {
  if (stopping) return
  stopping = true
  await Promise.all([...workers.values()].map(stopWorker))
  unlinkSync(lock)
  process.exit(0)
}
process.once("SIGINT", () => { void shutdown() })
process.once("SIGTERM", () => { void shutdown() })
console.log("Automatic agent host started. Provider access uses this installation's configuration.")
while (!stopping) {
  try { await reconcile() } catch {
    if (!failed) console.error("Agent host cannot connect. Check the server and installation token; retrying automatically.")
    failed = true
  }
  await new Promise((done) => setTimeout(done, 1_000))
}
