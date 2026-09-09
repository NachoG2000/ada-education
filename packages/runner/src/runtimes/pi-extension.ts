import {
  createReadToolDefinition,
  createWriteToolDefinition,
  createEditToolDefinition,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent"
import { piWorkspacePath } from "./pi-workspace.js"

/** Explicitly loaded by Ada. No built-ins or discovered extensions are enabled. */
export default function adaWorkspace(pi: ExtensionAPI): void {
  const cwd = process.cwd()
  const read = createReadToolDefinition(cwd)
  const write = createWriteToolDefinition(cwd)
  const edit = createEditToolDefinition(cwd)
  pi.registerTool({
    ...read,
    name: "ada_read",
    async execute(id, input, signal, onUpdate, context) {
      return read.execute(id, { ...input, path: piWorkspacePath(cwd, input.path, false) }, signal, onUpdate, context)
    },
  })
  pi.registerTool({
    ...write,
    name: "ada_write",
    async execute(id, input, signal, onUpdate, context) {
      return write.execute(id, { ...input, path: piWorkspacePath(cwd, input.path, true) }, signal, onUpdate, context)
    },
  })
  pi.registerTool({
    ...edit,
    name: "ada_edit",
    async execute(id, input, signal, onUpdate, context) {
      return edit.execute(id, { ...input, path: piWorkspacePath(cwd, input.path, true) }, signal, onUpdate, context)
    },
  })
}
