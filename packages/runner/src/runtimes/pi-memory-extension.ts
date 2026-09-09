import { createReadToolDefinition, createWriteToolDefinition, type ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { lstatSync, realpathSync } from "node:fs"
import { relative, resolve, sep } from "node:path"

export function memoryToolPath(cwd: string, input: string, write: boolean): string {
  const root = realpathSync(cwd)
  const path = resolve(root, input)
  const local = relative(root, path)
  if (write ? local !== "result.json" : !/^memory\/[A-Za-z0-9_-]+\.json$/.test(local)) throw new Error("This execution can read its supplied memory files and write result.json only")
  let current = root
  for (const part of local.split(sep)) {
    current = resolve(current, part)
    try {
      const stat = lstatSync(current)
      if (stat.isSymbolicLink() || !stat.isDirectory() && (!stat.isFile() || stat.nlink !== 1)) throw new Error("Memory tools do not follow links or special files")
    } catch (error) {
      if (!write || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
  }
  return path
}

export default function memoryExtension(pi: ExtensionAPI): void {
  const cwd = process.cwd()
  const read = createReadToolDefinition(cwd)
  const write = createWriteToolDefinition(cwd)
  pi.registerTool({ ...read, name: "ada_memory_read", execute(id, input, signal, onUpdate, context) {
    return read.execute(id, { ...input, path: memoryToolPath(cwd, input.path, false) }, signal, onUpdate, context)
  } })
  pi.registerTool({ ...write, name: "ada_memory_write", execute(id, input, signal, onUpdate, context) {
    if (input.content.length > 500000) throw new Error("Memory results must be smaller than 500,000 characters")
    return write.execute(id, { ...input, path: memoryToolPath(cwd, input.path, true) }, signal, onUpdate, context)
  } })
}
