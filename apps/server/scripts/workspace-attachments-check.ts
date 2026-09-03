import { deepStrictEqual, equal, ok, rejects } from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openDatabase } from "../src/db.js"
import {
  AttachmentTooLargeError,
  MAX_ATTACHMENT_BYTES,
  deleteAttachment,
  getAttachmentDownload,
  resolveAttachmentPath,
  storeAttachment,
} from "../src/workspace-attachments.js"
import { WorkspaceError } from "../src/workspace-errors.js"

const scratch = mkdtempSync(join(tmpdir(), "ada-workspace-attachments-"))
const database = openDatabase(":memory:")

try {
  database.prepare("INSERT INTO members (id, kind, name) VALUES (?, 'person', ?)").run("martin", "Martin")
  database.prepare("INSERT INTO channels (id, name, group_name) VALUES (?, ?, 'course')").run("questions/../../safe", "Questions")

  const source = Buffer.from([0, 1, 2, 127, 128, 254, 255, 10, 13])
  const stored = storeAttachment(database, scratch, {
    channelId: "questions/../../safe",
    uploaderId: "martin",
    name: "../lesson notes?.pdf",
    mime: "application/pdf",
    bytes: source,
  })
  const download = getAttachmentDownload(database, scratch, stored.id)
  deepStrictEqual(download.bytes, source, "download preserves exact bytes")
  equal(download.size, source.byteLength, "metadata stores actual byte size")
  equal(readFileSync(download.absolutePath).compare(source), 0, "stored file preserves exact bytes")
  ok(download.storagePath.startsWith("raw/chat/"), "storage path is under raw/chat")
  ok(download.storagePath.includes("-"), "storage path includes generated id and sanitized name")
  ok(download.absolutePath.startsWith(scratch), "absolute path remains inside the temp course root")

  const exactBoundary = storeAttachment(database, scratch, {
    channelId: "questions/../../safe",
    uploaderId: "martin",
    name: "exact-boundary.bin",
    mime: "application/octet-stream",
    bytes: Buffer.alloc(MAX_ATTACHMENT_BYTES),
  })
  equal(exactBoundary.size, MAX_ATTACHMENT_BYTES, "exactly 10 MiB is accepted")
  deleteAttachment(database, scratch, exactBoundary.id, "martin")

  await rejects(
    async () => storeAttachment(database, scratch, {
      channelId: "questions",
      uploaderId: "martin",
      name: "too-large.bin",
      mime: "application/octet-stream",
      bytes: Buffer.alloc(MAX_ATTACHMENT_BYTES + 1),
    }),
    (error: unknown) => error instanceof AttachmentTooLargeError && error.status === 413,
    "10 MiB + 1 is rejected as a stable 413 error",
  )

  ok(!resolveAttachmentPathSafe(scratch, "../outside"), "parent traversal is rejected")
  ok(!resolveAttachmentPathSafe(scratch, "raw/chat/../../../outside"), "nested traversal is rejected")

  const deleted = deleteAttachment(database, scratch, stored.id, "martin")
  equal(deleted.id, stored.id, "unattached deletion returns metadata")
  ok(!statExists(download.absolutePath), "unattached deletion removes the file")
  equal(database.prepare("SELECT 1 FROM attachments WHERE id = ?").get(stored.id), undefined, "unattached deletion removes the DB row")

  console.log("Workspace attachments OK")
} finally {
  database.close()
  rmSync(scratch, { recursive: true, force: true })
}

function resolveAttachmentPathSafe(root: string, path: string): string | null {
  try {
    return resolveAttachmentPath(root, path)
  } catch (error) {
    ok(error instanceof WorkspaceError, "containment failures use WorkspaceError")
    return null
  }
}

function statExists(path: string): boolean {
  try {
    statSync(path)
    return true
  } catch {
    return false
  }
}
