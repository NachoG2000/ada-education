import { randomBytes } from "node:crypto"
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve, join } from "node:path"
import concurrently from "concurrently"

const root = resolve(process.env.ADA_HOST_STATE ?? ".ada")
mkdirSync(root, { recursive: true, mode: 0o700 })
chmodSync(root, 0o700)
const tokenFile = join(root, "host-token")
try { writeFileSync(tokenFile, randomBytes(32).toString("base64url"), { flag: "wx", mode: 0o600 }) }
catch (error) { if (error.code !== "EEXIST") throw error }
const token = process.env.ADA_RUNNER_HOST_TOKEN ?? readFileSync(tokenFile, "utf8").trim()
if (token.length < 32) throw new Error("The installation token must be at least 32 characters.")
const shared = { ...process.env, ADA_HOST_STATE: root, ADA_RUNNER_HOST_TOKEN: token,
  ADA_RUNTIME: process.env.ADA_RUNTIME ?? "pi", ADA_MODEL: process.env.ADA_MODEL ?? "gpt-5.6-luna",
  ADA_SERVER: process.env.ADA_SERVER ?? `http://localhost:${process.env.PORT ?? "8787"}` }
const serverEnv = { ...shared }
for (const key of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"]) serverEnv[key] = undefined
const webEnv = { ...serverEnv }
webEnv.ADA_RUNNER_HOST_TOKEN = undefined
const { result } = concurrently([
  { name: "web", command: "npm run dev:web", env: webEnv },
  { name: "server", command: "npm run dev:server", env: serverEnv },
  { name: "agents", command: "npm run runner:host:dev", env: shared },
], { prefix: "name", killOthersOn: ["failure", "success"] })
result.catch(() => { process.exitCode = 1 })
