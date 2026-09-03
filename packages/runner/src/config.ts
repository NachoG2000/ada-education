import { lstatSync, mkdirSync } from "node:fs"
import { basename, resolve } from "node:path"

/** Hosted choices. The scripted implementation remains a direct test harness. */
export type RunnerRuntime = "claude" | "codex"

export type RunnerConfig = {
  server: string
  communityId: string
  agentId: string
  token: string
  cwd: string
  materialsDir: string
  runtime: RunnerRuntime
  model?: string
  timeoutMs: number
}

type Env = Record<string, string | undefined>

function value(argv: string[], name: string, envName: string, env: Env): string | undefined {
  const flag = `--${name}`
  const index = argv.indexOf(flag)
  if (index !== -1) {
    const next = argv[index + 1]
    if (next && !next.startsWith("--")) return next
    return undefined
  }
  return env[envName]
}

function required(value: string | undefined, flag: string): string {
  if (!value?.trim()) throw new ConfigError(`ada-runner: ${flag} is required.`)
  return value.trim()
}

function ensureDirectory(path: string, flag: string): void {
  try {
    const existing = lstatSync(path)
    if (existing.isSymbolicLink() || !existing.isDirectory()) throw new ConfigError(`ada-runner: ${flag} must be a directory.`)
  } catch (error) {
    if (error instanceof ConfigError) throw error
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new ConfigError(`ada-runner: couldn't inspect ${flag}.`)
    try {
      mkdirSync(path, { recursive: true })
      const created = lstatSync(path)
      if (created.isSymbolicLink() || !created.isDirectory()) throw new ConfigError(`ada-runner: ${flag} must be a directory.`)
    } catch (createError) {
      if (createError instanceof ConfigError) throw createError
      throw new ConfigError(`ada-runner: couldn't create ${flag}.`)
    }
  }
}

function positiveSeconds(raw: string | undefined): number {
  const seconds = Number(raw ?? "180")
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 3_600) {
    throw new ConfigError("ada-runner: --timeout must be between 1 and 3600 seconds.")
  }
  return Math.round(seconds * 1_000)
}

function httpServer(raw: string): string {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new ConfigError("ada-runner: --server must be an http(s) URL.")
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ConfigError("ada-runner: --server must be an http(s) URL.")
  }
  if (parsed.username || parsed.password || [...parsed.searchParams.keys()].some((key) => /token|secret|auth|credential/i.test(key))) {
    throw new ConfigError("ada-runner: --server must not contain credentials or auth query parameters.")
  }
  return raw.replace(/\/+$/, "")
}

export class ConfigError extends Error {
  readonly code = "invalid_config"
}

/** Parse runner settings without ever including the Ada token in diagnostics. */
export function parseRunnerConfig(argv: string[] = process.argv.slice(2), env: Env = process.env): RunnerConfig {
  const cwd = resolve(required(value(argv, "cwd", "ADA_AGENT_CWD", env), "--cwd"))
  ensureDirectory(cwd, "--cwd")

  const server = httpServer(value(argv, "server", "ADA_SERVER", env) ?? "http://localhost:8787")
  const communityId = required(value(argv, "community", "ADA_COMMUNITY_ID", env), "--community")
  const agentId = required(value(argv, "agent", "ADA_AGENT_ID", env), "--agent")
  const token = required(value(argv, "token", "ADA_AGENT_TOKEN", env), "--token")
  if (token.length < 20) throw new ConfigError("ada-runner: --token must be at least 20 characters.")
  // With the standard generated layout (`.ada/agents/<agentId>`), raw course
  // material lives beside agents at `.ada/communities/<communityId>/raw`.
  // Preserve the seeded local layout's historical `<course>/raw` default.
  const agentsRoot = resolve(cwd, "..")
  const adaRoot = resolve(agentsRoot, "..")
  const defaultMaterials = basename(agentsRoot) === "agents" && basename(adaRoot) === ".ada"
    ? resolve(adaRoot, "communities", communityId, "raw")
    : resolve(cwd, "../..", "raw")
  const materialsDir = resolve(value(argv, "materials", "ADA_MATERIALS", env) ?? defaultMaterials)
  ensureDirectory(materialsDir, "--materials")
  const runtimeRaw = value(argv, "runtime", "ADA_RUNTIME", env) ?? "claude"
  if (runtimeRaw !== "claude" && runtimeRaw !== "codex") {
    throw new ConfigError(`ada-runner: runtime "${runtimeRaw}" isn't supported; use claude or codex.`)
  }
  const modelValue = value(argv, "model", "ADA_MODEL", env)
  const model = modelValue && modelValue !== "default" ? modelValue : undefined
  return {
    server,
    communityId,
    agentId,
    token,
    cwd,
    materialsDir,
    runtime: runtimeRaw,
    ...(model ? { model } : {}),
    timeoutMs: positiveSeconds(value(argv, "timeout", "ADA_TIMEOUT", env)),
  }
}
