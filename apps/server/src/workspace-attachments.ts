import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"
import type { DatabaseSync } from "node:sqlite"
import { WorkspaceError } from "./workspace-errors.js"

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENT_NAME_BYTES = 255
export const MAX_ATTACHMENT_MIME_BYTES = 255
export const ATTACHMENT_TOO_LARGE_STATUS = 413

export interface AttachmentUploadInput {
  channelId: string
  uploaderId: string
  name: string
  mime: string
  bytes: Uint8Array
  id?: string
  createdAt?: string
}

export interface AttachmentRecord {
  id: string
  channelId: string
  uploaderId: string
  name: string
  mime: string
  size: number
  storagePath: string
  createdAt: string
  messageId?: string
}

export interface AttachmentDownload extends AttachmentRecord {
  absolutePath: string
  bytes: Buffer
}

/** Stable 413 failure for the upload boundary. */
export class AttachmentTooLargeError extends WorkspaceError {
  override readonly status = ATTACHMENT_TOO_LARGE_STATUS

  constructor(size: number) {
    super("invalid_input", `Attachment is ${size} bytes; the maximum is ${MAX_ATTACHMENT_BYTES} bytes`, "file")
    this.name = "AttachmentTooLargeError"
  }
}

export function isAttachmentTooLargeError(error: unknown): error is AttachmentTooLargeError {
  return error instanceof AttachmentTooLargeError
}

function invalidInput(message: string, field: string): WorkspaceError {
  return new WorkspaceError("invalid_input", message, field)
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8")
}

function truncateUtf8(value: string, maximumBytes: number): string {
  let output = ""
  for (const character of value) {
    const next = output + character
    if (byteLength(next) > maximumBytes) break
    output = next
  }
  return output
}

/** Convert a channel identifier into one safe, non-empty path segment. */
export function sanitizeChannelSegment(channelId: string): string {
  const value = channelId.normalize("NFKC")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^\.+/, "")
    .replace(/-+/g, "-")
  return value && value !== "." && value !== ".." ? truncateUtf8(value, 120) : "channel"
}

/** Sanitize only the filesystem name; the original name remains metadata. */
export function sanitizeDisplayName(name: string): string {
  const value = name.normalize("NFKC")
    .replace(/[\\/]+/g, "-")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+/, "")
  return truncateUtf8(replaceControlCharacters(value || "file"), 200) || "file"
}

function replaceControlCharacters(value: string): string {
  let output = ""
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0
    output += codePoint < 32 || codePoint === 127 ? "-" : character
  }
  return output
}

export function validateAttachmentInput(input: Pick<AttachmentUploadInput, "name" | "mime" | "bytes">): void {
  if (!input.name.trim()) throw invalidInput("Attachment name is required", "name")
  if (input.name.includes("\0")) throw invalidInput("Attachment name contains a NUL byte", "name")
  if (byteLength(input.name) > MAX_ATTACHMENT_NAME_BYTES) {
    throw invalidInput(`Attachment name exceeds ${MAX_ATTACHMENT_NAME_BYTES} bytes`, "name")
  }
  if (!input.mime.trim()) throw invalidInput("Attachment MIME type is required", "mime")
  if (input.mime.includes("\0")) throw invalidInput("Attachment MIME type contains a NUL byte", "mime")
  if (byteLength(input.mime) > MAX_ATTACHMENT_MIME_BYTES) {
    throw invalidInput(`Attachment MIME type exceeds ${MAX_ATTACHMENT_MIME_BYTES} bytes`, "mime")
  }
  if (input.bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new AttachmentTooLargeError(input.bytes.byteLength)
}

/** Return the generated relative path; callers must still resolve it through the root guard. */
export function attachmentStoragePath(channelId: string, attachmentId: string, displayName: string): string {
  return join("raw", "chat", sanitizeChannelSegment(channelId), `${attachmentId}-${sanitizeDisplayName(displayName)}`)
}

/** Resolve a stored relative path while rejecting traversal outside the course root. */
export function resolveAttachmentPath(courseRoot: string, storagePath: string): string {
  if (!storagePath || storagePath.includes("\0")) throw invalidInput("Invalid attachment storage path", "storagePath")

  const root = resolve(courseRoot)
  const absolutePath = resolve(root, storagePath)
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`
  if (absolutePath !== root && !absolutePath.startsWith(rootPrefix)) {
    throw invalidInput("Attachment storage path escapes the course root", "storagePath")
  }
  return absolutePath
}

function asRecord(row: Record<string, unknown>): AttachmentRecord {
  const id = typeof row.id === "string" ? row.id : ""
  const channelId = typeof row.channel_id === "string" ? row.channel_id : ""
  const uploaderId = typeof row.uploader_id === "string" ? row.uploader_id : ""
  const name = typeof row.name === "string" ? row.name : ""
  const mime = typeof row.mime === "string" ? row.mime : ""
  const size = typeof row.size === "number" ? row.size : Number(row.size)
  const storagePath = typeof row.storage_path === "string" ? row.storage_path : ""
  const createdAt = typeof row.created_at === "string" ? row.created_at : ""
  const messageId = typeof row.message_id === "string" ? row.message_id : undefined
  if (!id || !channelId || !uploaderId || !name || !mime || !Number.isFinite(size) || !storagePath || !createdAt) {
    throw new WorkspaceError("conflict", "Attachment metadata is incomplete")
  }
  return { id, channelId, uploaderId, name, mime, size, storagePath, createdAt, ...(messageId ? { messageId } : {}) }
}

function attachmentRow(database: DatabaseSync, attachmentId: string): AttachmentRecord | undefined {
  const row = database.prepare("SELECT id, channel_id, uploader_id, name, mime, size, storage_path, created_at, message_id FROM attachments WHERE id = ?")
    .get(attachmentId) as Record<string, unknown> | undefined
  return row ? asRecord(row) : undefined
}

function ensureIdentifier(value: string, field: string): void {
  if (!value || value.includes("\0")) throw invalidInput(`${field} is invalid`, field)
}

/** Write bytes exclusively, then insert metadata; a DB failure removes the new file. */
export function storeAttachment(database: DatabaseSync, courseRoot: string, input: AttachmentUploadInput): AttachmentRecord {
  ensureIdentifier(input.channelId, "channelId")
  ensureIdentifier(input.uploaderId, "uploaderId")
  validateAttachmentInput(input)

  const id = input.id ?? randomUUID()
  ensureIdentifier(id, "id")
  const storagePath = attachmentStoragePath(input.channelId, id, input.name)
  const absolutePath = resolveAttachmentPath(courseRoot, storagePath)
  const bytes = Buffer.from(input.bytes)
  const record: AttachmentRecord = {
    id,
    channelId: input.channelId,
    uploaderId: input.uploaderId,
    name: input.name,
    mime: input.mime,
    size: bytes.byteLength,
    storagePath,
    createdAt: input.createdAt ?? new Date().toISOString(),
  }

  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, bytes, { flag: "wx" })
  try {
    database.prepare(`
      INSERT INTO attachments (id, channel_id, uploader_id, message_id, name, mime, size, storage_path, created_at)
      VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)
    `).run(record.id, record.channelId, record.uploaderId, record.name, record.mime, record.size, record.storagePath, record.createdAt)
  } catch (error) {
    // Resolve again rather than trusting the path retained above: all cleanup
    // paths pass through the same root-containment guard as writes.
    const cleanupPath = resolveAttachmentPath(courseRoot, record.storagePath)
    try {
      unlinkSync(cleanupPath)
    } catch {
      // Preserve the DB error; the caller can report the failed insert.
    }
    throw error
  }
  return record
}

/** Read metadata and exact bytes through the guarded absolute path. */
export function getAttachmentDownload(database: DatabaseSync, courseRoot: string, attachmentId: string): AttachmentDownload {
  const record = attachmentRow(database, attachmentId)
  if (!record) throw new WorkspaceError("not_found", "Attachment not found", "attachmentId")
  const absolutePath = resolveAttachmentPath(courseRoot, record.storagePath)
  let bytes: Buffer
  try {
    bytes = readFileSync(absolutePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new WorkspaceError("not_found", "Attachment bytes are missing", "attachmentId")
    }
    throw error
  }
  if (bytes.byteLength !== record.size) throw new WorkspaceError("conflict", "Attachment size does not match metadata")
  return { ...record, absolutePath, bytes }
}

/** Delete only an unattached file, authorized for its uploader or a teacher. */
export function deleteAttachment(
  database: DatabaseSync,
  courseRoot: string,
  attachmentId: string,
  actorId: string,
  actorIsTeacher = false,
): AttachmentRecord {
  const record = attachmentRow(database, attachmentId)
  if (!record) throw new WorkspaceError("not_found", "Attachment not found", "attachmentId")
  if (record.messageId) throw new WorkspaceError("conflict", "Attached files cannot be removed", "attachmentId")
  if (!actorIsTeacher && record.uploaderId !== actorId) throw new WorkspaceError("forbidden", "Only the uploader or a teacher can remove this attachment")

  const absolutePath = resolveAttachmentPath(courseRoot, record.storagePath)
  if (!existsSync(absolutePath)) throw new WorkspaceError("not_found", "Attachment bytes are missing", "attachmentId")
  const bytes = readFileSync(absolutePath)
  let removed = false
  database.exec("BEGIN IMMEDIATE")
  try {
    unlinkSync(absolutePath)
    removed = true
    const result = database.prepare("DELETE FROM attachments WHERE id = ? AND message_id IS NULL").run(attachmentId) as { changes?: number }
    if (result.changes !== 1) throw new WorkspaceError("conflict", "Attachment is no longer unattached", "attachmentId")
    database.exec("COMMIT")
  } catch (error) {
    try {
      database.exec("ROLLBACK")
    } catch {
      // Keep the original operation error.
    }
    if (removed && !existsSync(absolutePath)) {
      try {
        writeFileSync(absolutePath, bytes, { flag: "wx" })
      } catch {
        // Keep the original error; restoration is best effort after an I/O failure.
      }
    }
    throw error
  }
  return record
}

export function attachmentPathIsWithinRoot(courseRoot: string, storagePath: string): boolean {
  try {
    const root = resolve(courseRoot)
    const candidate = resolveAttachmentPath(courseRoot, storagePath)
    const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`
    return candidate !== root && candidate.startsWith(rootPrefix)
  } catch {
    return false
  }
}

export function relativeAttachmentPath(courseRoot: string, absolutePath: string): string {
  const root = resolve(courseRoot)
  const candidate = resolveAttachmentPath(courseRoot, relative(root, absolutePath))
  return relative(root, candidate)
}
