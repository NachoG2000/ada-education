/** Real Pi file tools and signed-out CLI, without subscription calls. */
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, linkSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent"
import { DefaultResourceLoader, SettingsManager } from "@earendil-works/pi-coding-agent"
import adaWorkspace from "../src/runtimes/pi-extension.js"
import { ProviderError, runPi } from "../src/runtimes/providers.js"

const scratch = mkdtempSync(join(tmpdir(), "ada-pi-check-"))
const cwd = process.cwd()
try {
  const workspace = join(scratch, "agent")
  mkdirSync(join(workspace, "wiki"), { recursive: true })
  writeFileSync(join(workspace, "AGENTS.md"), "Read wiki/index.md first.")
  writeFileSync(join(workspace, "wiki/index.md"), "# Index")
  process.chdir(workspace)
  const loader = new DefaultResourceLoader({
    cwd: workspace, agentDir: join(scratch, "pi-auth"), settingsManager: SettingsManager.inMemory(),
    noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    additionalExtensionPaths: [fileURLToPath(new URL("../src/runtimes/pi-extension.ts", import.meta.url))],
  })
  await loader.reload({ resolveProjectTrust: async () => false })
  assert.deepEqual(loader.getExtensions().errors, [], "the actual Pi loader loads Ada's extension")
  assert.equal(loader.getExtensions().extensions.length, 1)
  assert.deepEqual([...loader.getExtensions().extensions[0]!.tools.keys()], ["ada_read", "ada_write", "ada_edit"])
  assert.deepEqual(loader.getAgentsFiles().agentsFiles, [], "parent and global context are not loaded")
  const tools: ToolDefinition[] = []
  adaWorkspace({ registerTool: (tool: ToolDefinition) => tools.push(tool) } as unknown as ExtensionAPI)
  assert.deepEqual(tools.map((tool) => tool.name), ["ada_read", "ada_write", "ada_edit"])
  const execute = (name: string, input: Record<string, unknown>) => tools.find((tool) => tool.name === name)!.execute("check", input, new AbortController().signal, undefined, {} as never)
  const first = await execute("ada_read", { path: "AGENTS.md" })
  assert(first.content.some((part) => part.type === "text" && part.text.includes("Read wiki")))
  const card = "---\ntype: topic\ntitle: Learning\nsources: [message-1]\n---\nPractice helps.\n"
  await execute("ada_write", { path: "wiki/topics/learning.md", content: card })
  await execute("ada_edit", { path: "wiki/topics/learning.md", edits: [{ oldText: "Practice helps.", newText: "Spaced practice helps." }] })
  assert(readFileSync(join(workspace, "wiki/topics/learning.md"), "utf8").includes("Spaced practice helps."))
  await execute("ada_write", { path: "log.md", content: "Learned from message-1." })
  const outside = join(scratch, "outside.md")
  writeFileSync(outside, "private material")
  symlinkSync(outside, join(workspace, "wiki/link.md"))
  symlinkSync(scratch, join(workspace, "wiki/linked-dir"))
  linkSync(outside, join(workspace, "wiki/hardlink.md"))
  for (const path of [outside, "../outside.md", "wiki/link.md", "wiki/hardlink.md", "wiki/linked-dir/outside.md", "~/.pi/agent/auth.json", ".ada/cards.json"]) {
    await assert.rejects(() => execute("ada_read", { path }))
    await assert.rejects(() => execute("ada_write", { path, content: "must not write" }))
  }
  for (const path of ["AGENTS.md", "CLAUDE.md", "wiki/.pi/extension.md", "wiki/program.ts", "wiki/linked-dir/new.md"]) {
    await assert.rejects(() => execute("ada_write", { path, content: "must not write" }))
  }
  assert.equal(readFileSync(outside, "utf8"), "private material")
  assert.equal(readFileSync(join(workspace, "AGENTS.md"), "utf8"), "Read wiki/index.md first.")
  // This exercises actual Pi argument parsing and extension loading using a
  // fresh auth directory. Never read or alter the developer's Pi credentials.
  await assert.rejects(() => runPi({
    cwd: workspace, prompt: "Read wiki/index.md.", timeoutMs: 20_000,
    binary: fileURLToPath(new URL("./bundle/cli.js", import.meta.resolve("@earendil-works/pi-coding-agent"))),
    env: { PI_CODING_AGENT_DIR: join(scratch, "pi-auth"), ADA_PROVIDER_AUTH: "subscription" },
  }), (error: unknown) => error instanceof ProviderError && error.code === "auth" && error.message.includes("/login"))
  console.log("Pi OK: real read/write/edit tools, citations preserved, file boundaries, and actual signed-out CLI.")
} finally {
  process.chdir(cwd)
  rmSync(scratch, { recursive: true, force: true })
}
