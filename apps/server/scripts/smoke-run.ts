/* `npm run smoke`: the WS/REST smoke test against a throwaway copy of the course.

   smoke.ts writes into whatever it talks to (a material file, a report, a
   decision card, a difficulty change), so it must never run against the demo's
   DB or data folder. This wrapper copies data/<course> to a temp dir, seeds a
   temp DB, starts the server on a spare port, runs smoke.ts against it, and
   tears everything down — pass or fail. */

import { spawn, type ChildProcess } from "node:child_process"
import { cpSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { repoRoot } from "../src/db.js"
import { runTsx, serverUp, tsxBin } from "./lib.js"

const course = process.env.ADA_COURSE ?? "data/neural-networks-2026"
const port = Number(process.env.SMOKE_PORT ?? "8799")

async function main(): Promise<number> {
  const scratch = mkdtempSync(join(tmpdir(), "ada-smoke-"))
  const courseDir = join(scratch, "course")
  const dbPath = join(scratch, "smoke.db")
  cpSync(resolve(repoRoot, course), courseDir, { recursive: true })
  const env = { ...process.env, ADA_COURSE: courseDir, ADA_DB: dbPath, PORT: String(port) }
  let server: ChildProcess | undefined
  try {
    const seeded = await runTsx(["apps/server/src/seed.ts"], env, "inherit")
    if (seeded !== 0) throw new Error(`seed exited ${seeded}`)
    server = spawn(tsxBin, ["apps/server/src/index.ts"], { cwd: repoRoot, env, stdio: ["ignore", "inherit", "inherit"] })
    const url = `http://localhost:${port}`
    await serverUp(url)
    return await runTsx(["apps/server/scripts/smoke.ts"], { ...env, ADA_SERVER_URL: url }, "inherit")
  } finally {
    server?.kill("SIGTERM")
    rmSync(scratch, { recursive: true, force: true })
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`Smoke run failed: ${(error as Error).message}`)
    process.exit(1)
  },
)
