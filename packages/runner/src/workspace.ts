import { lstatSync, mkdirSync, realpathSync, writeFileSync } from "node:fs"
import { resolve, sep } from "node:path"

/** Create a workspace directory without accepting a symlink or replacing a file. */
export function ensureWorkspaceDirectory(path: string, label: string): void {
  try {
    const stat = lstatSync(path)
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`${label} must be a directory`)
  } catch (error) {
    if (error instanceof Error && error.message === `${label} must be a directory`) throw error
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error(`couldn't inspect ${label}`)
    mkdirSync(path, { recursive: true })
    const created = lstatSync(path)
    if (created.isSymbolicLink() || !created.isDirectory()) throw new Error(`${label} must be a directory`)
  }
}

/** Create a managed file only when absent. `wx` also protects against races. */
export function createBootstrapFile(path: string, contents: string): void {
  try {
    const existing = lstatSync(path)
    if (existing.isSymbolicLink() || !existing.isFile()) throw new Error("bootstrap path must be a regular file")
    return
  } catch (error) {
    if (error instanceof Error && error.message === "bootstrap path must be a regular file") throw error
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  try {
    writeFileSync(path, contents, { encoding: "utf8", flag: "wx" })
  } catch (error) {
    // A concurrently-created file (or a dangling symlink) is never replaced.
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
  }
}

/** Return a path only when its resolved target remains inside the root. */
export function safeWorkspacePath(rootInput: string, relativePath: string): string | undefined {
  const root = resolve(rootInput)
  const candidate = resolve(root, relativePath)
  if (candidate === root || !candidate.startsWith(root + sep)) return undefined
  try {
    const realRoot = realpathSync(root)
    const realCandidate = realpathSync(candidate)
    if (!realCandidate.startsWith(realRoot + sep)) return undefined
    return candidate
  } catch {
    return undefined
  }
}
