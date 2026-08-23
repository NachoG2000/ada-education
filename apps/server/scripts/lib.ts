/* Shared harness for the check scripts in this folder: a pass/fail collector,
   a spawn-and-wait wrapper for tsx scripts, and a poll-until helper. */

import { spawn, type StdioOptions } from "node:child_process"
import { resolve } from "node:path"
import { repoRoot } from "../src/db.js"

export const tsxBin = resolve(repoRoot, "node_modules/.bin/tsx")

export function makeHarness() {
  const failures: string[] = []
  const check = (ok: boolean, what: string) => {
    if (!ok) failures.push(what)
    console.log(`${ok ? "ok " : "FAIL"} ${what}`)
  }
  const finish = (okMessage: string) => {
    if (failures.length) {
      console.error(`\n${failures.length} check(s) failed`)
      process.exit(1)
    }
    console.log(`\n${okMessage}`)
  }
  return { check, finish, failures }
}

/** Run a script with tsx and resolve its exit code (never rejects). */
export function runTsx(args: string[], env: NodeJS.ProcessEnv, stdio: StdioOptions = ["ignore", "ignore", "inherit"]): Promise<number> {
  return new Promise((resolvePromise) => {
    const child = spawn(tsxBin, args, { cwd: repoRoot, env, stdio })
    child.on("close", (code) => resolvePromise(code ?? 1))
    child.on("error", () => resolvePromise(1))
  })
}

/** Poll `probe` until it returns a value or the timeout passes. */
export async function until<T>(what: string, probe: () => Promise<T | undefined>, timeoutMs = 15000): Promise<T> {
  const start = Date.now()
  for (;;) {
    const value = await probe()
    if (value !== undefined) return value
    if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 300))
  }
}

/** True once GET /api/community answers ok. */
export async function serverUp(base: string): Promise<true> {
  return until("server up", async () => {
    try {
      return (await fetch(`${base}/api/community`)).ok ? (true as const) : undefined
    } catch {
      return undefined
    }
  }, 12000)
}
