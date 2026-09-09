import { lstatSync, realpathSync } from "node:fs"
import { relative, resolve, sep } from "node:path"

/** Pi has no OS sandbox. Its only Ada tools validate every file operation. */
export function piWorkspacePath(cwd: string, input: string, write: boolean): string {
  const root = realpathSync(cwd)
  const candidate = resolve(root, input)
  const path = relative(root, candidate)
  const parts = path.split(sep)
  const isWiki = parts[0] === "wiki" && parts.length > 1 && path.endsWith(".md")
  const isLog = path === "log.md"
  const isInstructions = !write && ["AGENTS.md", "CLAUDE.md"].includes(path)
  if ((!isWiki && !isLog && !isInstructions) || parts.some((part) => !part || part.startsWith("."))) {
    throw new Error("Ada file tools allow wiki markdown and log.md; agent instructions are read-only.")
  }
  let current = root
  for (const part of parts) {
    current = resolve(current, part)
    try {
      const stat = lstatSync(current)
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()) || (stat.isFile() && stat.nlink > 1)) {
        throw new Error("Ada file tools do not follow links or special files.")
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" || !write) throw error
    }
  }
  return candidate
}
