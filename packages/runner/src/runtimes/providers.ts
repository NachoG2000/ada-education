import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"

export type ProviderName = "claude" | "codex"

export type ProviderOptions = {
  cwd: string
  prompt: string
  timeoutMs: number
  model?: string
  /** Test-only command overrides. Production defaults stay on PATH. */
  binary?: string
  env?: NodeJS.ProcessEnv
  /** Secrets that must never appear in provider errors or captured output. */
  secrets?: readonly string[]
}

const MAX_STDOUT = 4 * 1024 * 1024
const MAX_STDERR = 64 * 1024

export class ProviderError extends Error {
  readonly code: "missing_binary" | "auth" | "timeout" | "exit" | "invalid_output"

  constructor(
    message: string,
    code: "missing_binary" | "auth" | "timeout" | "exit" | "invalid_output",
  ) {
    super(message)
    this.code = code
    this.name = "ProviderError"
  }
}

function redact(value: string, secrets: readonly string[] = []): string {
  let result = value
  for (const secret of secrets) {
    if (secret) result = result.split(secret).join("[redacted]")
  }
  // Do not leak common provider or Ada bearer values if a subprocess echoes its
  // environment in an error. This is intentionally conservative and bounded.
  return result
    .replace(/(ADA_AGENT_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY)\s*[=:]\s*[^\s,]+/gi, "$1=[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
}

function secretsFor(options: ProviderOptions): string[] {
  const env = { ...process.env, ...options.env }
  return [
    ...(options.secrets ?? []),
    env.OPENAI_API_KEY,
    env.ANTHROPIC_API_KEY,
    env.ANTHROPIC_AUTH_TOKEN,
  ].filter((secret): secret is string => Boolean(secret))
}

function boundedAppend(current: string, chunk: Buffer, limit: number): string {
  if (current.length >= limit) return current
  const text = chunk.toString("utf8")
  return (current + text).slice(0, limit)
}

function authFailure(provider: ProviderName, text: string): boolean {
  return provider === "codex"
    ? /(not logged in|not authenticated|run\s+codex\s+login|authentication required|login required|unauthorized)/i.test(text)
    : /(not logged in|not authenticated|authentication required|login required|unauthorized|could not authenticate)/i.test(text)
}

function commandHint(provider: ProviderName): string {
  return provider === "codex" ? "Run `codex login` in this terminal, then start ada-runner again." : "Run `claude` in this terminal to finish sign-in, then start ada-runner again."
}

type ChildResult = { code: number | null; stdout: string; stderr: string; spawnError?: NodeJS.ErrnoException }

function runChild(binary: string, args: string[], options: ProviderOptions, provider: ProviderName): Promise<ChildResult> {
  const env = { ...process.env, ...options.env }
  // Ada bearer credentials are transport-only. Never pass them to a provider,
  // even when this runner was launched from another Ada process.
  for (const key of Object.keys(env)) {
    if (/^ADA_.*(?:TOKEN|SECRET|CODE|KEY)$/i.test(key)) delete env[key]
    // This development runner is explicitly subscription-backed. Provider API
    // keys would silently switch billing away from the user's CLI login.
    if (["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"].includes(key)) delete env[key]
    // Avoid inheriting a parent agent session while preserving user-selected
    // config locations that may contain the CLI's normal login state.
    if (provider === "claude" && key === "CLAUDECODE") delete env[key]
    if (provider === "codex" && ["CODEX_CI", "CODEX_SESSION_ID", "CODEX_THREAD_ID", "CODEX_MANAGED_BY_NPM", "CODEX_MANAGED_PACKAGE_ROOT"].includes(key)) delete env[key]
  }
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: options.cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    let timedOut = false
    let settled = false
    let killTimer: ReturnType<typeof setTimeout> | undefined
    const finish = (result: ChildResult) => {
      if (settled) return
      settled = true
      if (killTimer) clearTimeout(killTimer)
      resolve(result)
    }
    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGTERM")
      killTimer = setTimeout(() => child.kill("SIGKILL"), 500)
    }, options.timeoutMs)
    child.stdout.on("data", (chunk: Buffer) => { stdout = boundedAppend(stdout, chunk, MAX_STDOUT) })
    child.stderr.on("data", (chunk: Buffer) => { stderr = boundedAppend(stderr, chunk, MAX_STDERR) })
    child.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      if (error.code === "ENOENT") {
        reject(new ProviderError(`${provider} executable "${binary}" was not found on PATH. ${commandHint(provider)}`, "missing_binary"))
      } else {
        reject(new ProviderError(`${provider} could not start: ${redact(error.message, secretsFor(options))}`, "exit"))
      }
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      if (timedOut) {
        reject(new ProviderError(`${provider} took longer than ${Math.ceil(options.timeoutMs / 1_000)} seconds and was stopped.`, "timeout"))
        return
      }
      finish({ code, stdout, stderr })
    })
    // Prompts are assembled from server messages, agent instructions, and
    // local files. Redact transport/provider secrets at this final boundary as
    // well, so an accidental pasted bearer cannot reach a child process.
    child.stdin.end(redact(options.prompt, secretsFor(options)))
  })
}

function nonZeroError(provider: ProviderName, result: ChildResult, options: ProviderOptions): ProviderError {
  const detail = redact(`${result.stderr}\n${result.stdout}`.trim(), secretsFor(options)).slice(0, 1_200)
  if (authFailure(provider, detail)) return new ProviderError(`${provider} is not signed in. ${commandHint(provider)}`, "auth")
  return new ProviderError(`${provider} exited with code ${result.code ?? "unknown"}${detail ? `: ${detail}` : "."}`, "exit")
}

function claudeAnswer(raw: string, options: ProviderOptions): string {
  const trimmed = raw.trim()
  if (!trimmed) throw new ProviderError("claude returned an empty answer.", "invalid_output")
  try {
    const parsed = JSON.parse(trimmed) as { result?: unknown; is_error?: unknown; error?: unknown }
    if (parsed.is_error) {
      const detail = typeof parsed.error === "string" ? parsed.error : typeof parsed.result === "string" ? parsed.result : "provider error"
      if (authFailure("claude", detail)) throw new ProviderError(`claude is not signed in. ${commandHint("claude")}`, "auth")
      throw new ProviderError(`claude reported an error: ${redact(detail, secretsFor(options)).slice(0, 1_200)}`, "exit")
    }
    if (typeof parsed.result === "string" && parsed.result.trim()) return parsed.result.trim()
  } catch (error) {
    if (error instanceof ProviderError) throw error
    // Older Claude versions may emit plain text despite --output-format json.
  }
  return trimmed
}

export async function runClaude(options: ProviderOptions): Promise<string> {
  const args = [
    "-p",
    "--output-format", "json",
    "--permission-mode", "acceptEdits",
    "--allowedTools", "Read,Write,Edit,MultiEdit,Glob,Grep",
  ]
  if (options.model) args.push("--model", options.model)
  const result = await runChild(options.binary ?? "claude", args, options, "claude")
  if (result.code !== 0) throw nonZeroError("claude", result, options)
  return claudeAnswer(result.stdout, options)
}

export async function runCodex(options: ProviderOptions): Promise<string> {
  const outputDir = await mkdtemp(join(tmpdir(), "ada-codex-output-"))
  const outputPath = join(outputDir, "last-message.txt")
  try {
    const args = [
      "exec",
      "--cd", options.cwd,
      "--sandbox", "workspace-write",
      "--ephemeral",
      "--skip-git-repo-check",
      "--output-last-message", outputPath,
    ]
    if (options.model) args.push("--model", options.model)
    // There is deliberately no --add-dir here. Codex treats additional roots
    // as writable; Ada supplies read-only material context in the prompt and
    // keeps all model writes inside the agent workspace.
    const result = await runChild(options.binary ?? "codex", args, options, "codex")
    if (result.code !== 0) throw nonZeroError("codex", result, options)
    let answer = ""
    try { answer = (await readFile(outputPath, "utf8")).trim() } catch { /* fall back to stdout for older/fake CLIs */ }
    if (!answer) answer = result.stdout.trim()
    if (!answer) throw new ProviderError("codex returned an empty answer.", "invalid_output")
    return answer
  } finally {
    await rm(outputDir, { recursive: true, force: true }).catch(() => {})
  }
}

export async function runProvider(provider: ProviderName, options: ProviderOptions): Promise<string> {
  return provider === "claude" ? runClaude(options) : runCodex(options)
}

export const providerTestLimits = { maxStdout: MAX_STDOUT, maxStderr: MAX_STDERR }
