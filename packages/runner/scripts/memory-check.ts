import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, existsSync, symlinkSync, linkSync, rmSync, readFileSync, realpathSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { memoryToolPath } from "../src/runtimes/pi-memory-extension.js"
import { runMemoryWork } from "../src/memory-run.js"
import { runProvider } from "../src/runtimes/providers.js"
import type { MemoryWork } from "@ada/protocol"

const directory = mkdtempSync(join(tmpdir(), "ada-memory-tools-check-"))
try {
  mkdirSync(join(directory, "memory"))
  writeFileSync(join(directory, "memory/index.json"), "{}")
  assert.equal(memoryToolPath(directory, "memory/index.json", false), join(realpathSync(directory), "memory/index.json"))
  assert.throws(() => memoryToolPath(directory, "../other-user/memory/index.json", false))
  assert.throws(() => memoryToolPath(directory, "wiki/private.md", false))
  assert.throws(() => memoryToolPath(directory, "memory/index.json", true))
  assert.throws(() => memoryToolPath(directory, "result.json", false))
  const outside = join(directory, "secret.json")
  writeFileSync(outside, "never-read")
  symlinkSync(outside, join(directory, "memory/symlink.json"))
  linkSync(outside, join(directory, "memory/hardlink.json"))
  assert.throws(() => memoryToolPath(directory, "memory/symlink.json", false), /links/)
  assert.throws(() => memoryToolPath(directory, "memory/hardlink.json", false), /links/)
  symlinkSync(outside, join(directory, "result.json"))
  assert.throws(() => memoryToolPath(directory, "result.json", true), /links/)
  const work: MemoryWork["payload"] = { communityId: "course-one", agentId: "ada-one", instructions: "help the learner", requester: { id: "alex", name: "Alex", role: "student" }, request: "What is recursion?", view: { runId: "run-one", purpose: "respond", scope: { kind: "learner", learnerId: "alex" }, records: [], sources: [] } }
  let invocationDirectory = ""
  const result = await runMemoryWork(work, async (options) => {
    invocationDirectory = options.cwd
    assert(options.governedMemory)
    assert(!existsSync(join(options.cwd, "wiki")))
    const index = JSON.parse(readFileSync(join(options.cwd, "memory/index.json"), "utf8"))
    assert.deepEqual(index.records, [])
    writeFileSync(join(options.cwd, "result.json"), JSON.stringify({ answer: "A function calls itself.", proposals: [] }))
    return "Done"
  })
  assert.equal(result.answer, "A function calls itself.")
  assert(!existsSync(invocationDirectory), "temporary views are removed on success")
  await assert.rejects(runMemoryWork(work, async (options) => { invocationDirectory = options.cwd; throw new Error("provider failed") }), /provider failed/)
  assert(!existsSync(invocationDirectory), "temporary views are removed on failure")
  for (const provider of ["claude", "codex"] as const) await assert.rejects(runProvider(provider, { cwd: directory, prompt: "private input", timeoutMs: 1000, governedMemory: true, binary: "/must-not-run" }), /requires Pi/)
  const silentPi = join(directory, "silent-pi")
  writeFileSync(silentPi, '#!/usr/bin/env node\nrequire("node:fs").writeFileSync("result.json", JSON.stringify({answer:"A scoped file is the response.",proposals:[]}))\n')
  chmodSync(silentPi, 0o755)
  const silentResult = await runMemoryWork(work, (options) => runProvider("pi", { ...options, binary: silentPi, timeoutMs: 5000 }))
  assert.equal(silentResult.answer, "A scoped file is the response.", "tool-only completion is valid even with empty stdout")
  console.log("Memory runner OK: invocation isolation, tool boundaries, links, output validation, cleanup, and fail-closed unsupported providers.")
} finally { rmSync(directory, { recursive: true, force: true }) }
