/* Provider adapter contract checks. These use fake local binaries only: no
   Claude/Codex process, subscription, API key, or network is involved. */
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ProviderError, runClaude, runCodex, providerTestLimits } from "../src/runtimes/providers.js"
import { parseRunnerConfig } from "../src/config.js"
import { createBootstrapFile, safeWorkspacePath } from "../src/workspace.js"

const failures: string[] = []
const check = (ok: boolean, what: string) => {
  if (!ok) failures.push(what)
  console.log(`${ok ? "ok " : "FAIL"} ${what}`)
}

const scratch = mkdtempSync(join(tmpdir(), "ada-provider-check-"))
const agent = join(scratch, "agent folder with spaces")
const binaryDir = join(scratch, "fake binaries with spaces")
const logFile = join(scratch, "invocation.json")
writeFileSync(join(scratch, "agent-placeholder"), "")
// The adapter only needs an existing cwd; creating it through the shell would
// make this test less portable, so use the filesystem API here.
mkdirSync(agent, { recursive: true })
mkdirSync(binaryDir, { recursive: true })

const fake = join(binaryDir, "fake provider.js")
writeFileSync(fake, `#!/usr/bin/env node
const fs = require('node:fs')
const args = process.argv.slice(2)
const input = fs.readFileSync(0, 'utf8')
const log = process.env.ADA_FAKE_LOG
if (log) fs.writeFileSync(log, JSON.stringify({ args, cwd: process.cwd(), input, hasAdaToken: Object.keys(process.env).some((key) => /^ADA_.*(?:TOKEN|SECRET|CODE|KEY)$/i.test(key)), hasProviderApiKey: Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) }))
if (process.env.ADA_FAKE_MODE === 'auth') {
  process.stderr.write(process.env.FAKE_TOKEN + ' Please run codex login\\n')
  process.exit(9)
}
if (process.env.ADA_FAKE_MODE === 'nonzero') {
  process.stderr.write(process.env.FAKE_TOKEN + ' ' + 'x'.repeat(100000) + '\\n')
  process.exit(7)
}
if (process.env.ADA_FAKE_MODE === 'timeout') setTimeout(() => {}, 60000)
if (process.env.ADA_FAKE_MODE === 'codex') {
  const output = args[args.indexOf('--output-last-message') + 1]
  fs.writeFileSync(output, 'codex answer from output file')
} else {
  process.stdout.write(JSON.stringify({ result: 'claude answer from stdin' }))
}
`)
chmodSync(fake, 0o755)

const base = { cwd: agent, prompt: "hello from Ada", timeoutMs: 2_000, binary: fake, env: { ADA_FAKE_LOG: logFile, ADA_OWNER_TOKEN: "owner-secret", ADA_AGENT_SECRET: "agent-secret", OPENAI_API_KEY: "must-not-pass", ANTHROPIC_API_KEY: "must-not-pass" } }
const claude = await runClaude(base)
const claudeCall = JSON.parse(readFileSync(logFile, "utf8")) as { args: string[]; cwd: string; input: string; hasAdaToken: boolean; hasProviderApiKey: boolean }
check(claude === "claude answer from stdin", "Claude adapter returns the JSON result")
check(claudeCall.cwd === realpathSync(agent) && claudeCall.input === base.prompt && !claudeCall.hasAdaToken && !claudeCall.hasProviderApiKey, "Claude receives the prompt on stdin, runs in the agent cwd, and gets no Ada or provider API token")
check(claudeCall.args[0] === "-p" && claudeCall.args.includes("--output-format") && !claudeCall.args.includes(base.prompt), "Claude uses noninteractive flags without putting the prompt in argv")

await runClaude({ ...base, prompt: "do not forward ada-secret to the provider", secrets: ["ada-secret"] })
const redactedPromptCall = JSON.parse(readFileSync(logFile, "utf8")) as { input: string }
check(!redactedPromptCall.input.includes("ada-secret") && redactedPromptCall.input.includes("[redacted]"), "provider stdin redacts Ada secrets pasted into prompt context")

const codex = await runCodex({ ...base, env: { ADA_FAKE_LOG: logFile, ADA_OWNER_TOKEN: "owner-secret", ADA_INVITE_CODE: "invite-secret", ADA_AGENT_SECRET: "agent-secret", ADA_FAKE_MODE: "codex" }, model: "gpt-5.6" })
const codexCall = JSON.parse(readFileSync(logFile, "utf8")) as { args: string[]; cwd: string; input: string; hasAdaToken: boolean; hasProviderApiKey: boolean }
check(codex === "codex answer from output file", "Codex adapter reads --output-last-message")
check(codexCall.cwd === realpathSync(agent) && codexCall.input === base.prompt && !codexCall.hasAdaToken && !codexCall.hasProviderApiKey, "Codex receives the prompt on stdin, runs in the agent cwd, and gets no Ada or provider API token")
check(codexCall.args.slice(0, 2).join(" ") === "exec --cd" && codexCall.args.includes(agent) && codexCall.args.includes("--sandbox") && codexCall.args.includes("workspace-write"), "Codex uses exec, --cd, and workspace-write")
check(codexCall.args.includes("--ephemeral") && codexCall.args.includes("--skip-git-repo-check") && codexCall.args.includes("--model") && codexCall.args.includes("gpt-5.6") && !codexCall.args.includes("--add-dir"), "Codex is ephemeral, supports fresh folders, model override, and has no writable materials root")

await runCodex({ ...base, env: { ADA_FAKE_LOG: logFile, ADA_AGENT_TOKEN: "ada-secret", FAKE_TOKEN: "ada-secret", ADA_FAKE_MODE: "auth" }, secrets: ["ada-secret"] }).then(
  () => check(false, "signed-out Codex failure is rejected"),
  (error: unknown) => check(error instanceof ProviderError && error.code === "auth" && /sign|login/i.test(String(error)) && !String(error).includes("ada-secret"), "signed-out provider errors are actionable and redact the Ada token"),
)

await runCodex({ ...base, env: { ADA_FAKE_LOG: logFile, ADA_AGENT_TOKEN: "ada-secret", FAKE_TOKEN: "ada-secret", ADA_FAKE_MODE: "nonzero" }, secrets: ["ada-secret"] }).then(
  () => check(false, "non-zero provider failure is rejected"),
  (error: unknown) => check(error instanceof ProviderError && error.code === "exit" && String(error).length < 2_000 && !String(error).includes("ada-secret"), "non-zero provider output is bounded and redacted"),
)

await runCodex({ ...base, env: { ADA_FAKE_LOG: logFile, ADA_FAKE_MODE: "timeout" }, timeoutMs: 50 }).then(
  () => check(false, "provider timeout is rejected"),
  (error: unknown) => check(error instanceof ProviderError && error.code === "timeout", "provider timeout stops the child and reports a bounded error"),
)

await runClaude({ ...base, binary: join(binaryDir, "missing provider") }).then(
  () => check(false, "missing provider binary is rejected"),
  (error: unknown) => check(error instanceof ProviderError && error.code === "missing_binary" && /PATH/.test(String(error)), "missing provider binary gives an actionable PATH error"),
)

const parsed = parseRunnerConfig(
  ["--server", "https://ada.example/", "--community", "community one", "--agent", "agent one", "--token", "secret-token-with-more-than-twenty-chars", "--cwd", agent, "--materials", join(scratch, "materials folder"), "--runtime", "codex", "--model", "gpt-5.6", "--timeout", "12"],
  {},
)
check(parsed.server === "https://ada.example" && parsed.communityId === "community one" && parsed.agentId === "agent one" && parsed.runtime === "codex" && parsed.timeoutMs === 12_000, "CLI config accepts explicit tenant, runtime, model, timeout, and paths with spaces")
check(parsed.token === "secret-token-with-more-than-twenty-chars", "config retains the token only for the socket auth frame")
const defaultModel = parseRunnerConfig(["--server", "https://ada.example", "--community", "c", "--agent", "a", "--token", "secret-token-with-more-than-twenty-chars", "--cwd", agent, "--model", "default"], {})
check(defaultModel.model === undefined, "model default is omitted from provider configuration")
const newAgent = join(scratch, "new agent folder")
const newMaterials = join(scratch, "new materials folder")
parseRunnerConfig(["--server", "https://ada.example", "--community", "c", "--agent", "a", "--token", "secret-token-with-more-than-twenty-chars", "--cwd", newAgent, "--materials", newMaterials], {})
check(existsSync(newAgent) && existsSync(newMaterials), "first-use configuration creates missing agent and materials directories")
const standardAgent = join(scratch, ".ada", "agents", "standard-agent")
const standard = parseRunnerConfig(["--server", "https://ada.example", "--community", "community one", "--agent", "standard-agent", "--token", "secret-token-with-more-than-twenty-chars", "--cwd", standardAgent], {})
check(standard.materialsDir === join(scratch, ".ada", "communities", "community one", "raw") && existsSync(standard.materialsDir), "standard .ada layout defaults materials beside agent folders")
const preserved = join(scratch, "preserved.md")
writeFileSync(preserved, "user content")
createBootstrapFile(preserved, "must not replace")
check(readFileSync(preserved, "utf8") === "user content", "bootstrap files never overwrite existing user content")
const bootstrapRoot = join(scratch, "bootstrap")
const bootstrapWiki = join(bootstrapRoot, "wiki")
mkdirSync(bootstrapWiki, { recursive: true })
createBootstrapFile(join(bootstrapRoot, "AGENTS.md"), "agents")
createBootstrapFile(join(bootstrapRoot, "CLAUDE.md"), "claude")
createBootstrapFile(join(bootstrapWiki, "index.md"), "index")
check([join(bootstrapRoot, "AGENTS.md"), join(bootstrapRoot, "CLAUDE.md"), join(bootstrapWiki, "index.md")].every(existsSync), "first-use bootstrap creates the agent rules and wiki index")
const wikiRoot = join(scratch, "wiki")
const outside = join(scratch, "outside.md")
mkdirSync(wikiRoot, { recursive: true })
writeFileSync(outside, "outside card")
symlinkSync(outside, join(wikiRoot, "escape.md"))
check(safeWorkspacePath(wikiRoot, "escape.md") === undefined, "wiki symlink targets outside the workspace are refused")
const bootstrapLink = join(scratch, "bootstrap-link.md")
symlinkSync(outside, bootstrapLink)
try {
  createBootstrapFile(bootstrapLink, "must not follow")
  check(false, "bootstrap symlinks are refused")
} catch {
  check(readFileSync(outside, "utf8") === "outside card", "bootstrap symlinks are refused without touching their target")
}
try {
  parseRunnerConfig(["--server", "https://ada.example/?token=secret-token", "--community", "c", "--agent", "a", "--token", "secret-token-with-more-than-twenty-chars", "--cwd", agent], {})
  check(false, "server URL credentials are rejected")
} catch (error: unknown) {
  check(/must not contain credentials/.test(String(error)) && !String(error).includes("secret-token"), "server URL credentials are rejected without echoing them")
}

check(providerTestLimits.maxStdout >= 1024 * 1024 && providerTestLimits.maxStderr <= 128 * 1024, "provider capture limits are finite")

rmSync(scratch, { recursive: true, force: true })
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log("\nProvider adapters OK")
