import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createApi } from "../src/api.js"
import { openDatabase } from "../src/db.js"

const check = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message)
  console.log(`ok  ${message}`)
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>
}

const database = openDatabase(":memory:")
const courseDir = mkdtempSync(join(tmpdir(), "ada-workspace-api-"))

try {
  database.exec(`
    INSERT INTO community (id, name, subtitle, initial) VALUES ('course', 'Course', 'Test', 'C');
    INSERT INTO members (id, kind, name, initials, tone, role) VALUES
      ('teacher', 'person', 'Teacher', 'T', 'card', 'teacher'),
      ('student', 'person', 'Student', 'S', 'cardstock', 'student');
    INSERT INTO channels (id, name, group_name, visibility, status, created_by) VALUES
      ('questions', 'Questions', 'course', 'open', 'active', 'teacher');
    INSERT INTO channel_members (channel_id, member_id) VALUES
      ('questions', 'teacher'), ('questions', 'student');
    INSERT INTO channels (id, name, group_name, visibility, status, created_by) VALUES
      ('private', 'Private', 'private', 'private', 'active', 'teacher');
    INSERT INTO channel_members (channel_id, member_id) VALUES ('private', 'teacher');
  `)

  const events: string[] = []
  const app = createApi(database, {
    courseDir,
    onChannelCreated: () => events.push("channel.created"),
    onMessageCreated: () => events.push("message.created"),
    onMessageReactionsUpdated: () => events.push("message.reactions.updated"),
  })

  const snapshot = await app.request("/api/community?authorId=student")
  const studentSnapshot = await json(snapshot)
  check(snapshot.status === 200 && Array.isArray(studentSnapshot.channels), "viewer snapshot route returns the workspace")
  check(!(studentSnapshot.channels as Array<{ id: string }>).some((channel) => channel.id === "private"), "student snapshots omit private channels")

  const privateMessage = await app.request("/api/channels/private/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ authorId: "teacher", paragraphs: [[{ kind: "text", text: "private" }]] }),
  })
  const privateMessageBody = await json(privateMessage)
  const privateThread = await app.request("/api/threads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ authorId: "student", rootMessageId: privateMessageBody.id }),
  })
  check(privateThread.status === 403, "nonmembers cannot create private-channel threads")

  const privateUploadForm = new FormData()
  privateUploadForm.set("authorId", "student")
  privateUploadForm.set("file", new File(["private"], "private.txt", { type: "text/plain" }))
  const privateUpload = await app.request("/api/channels/private/attachments", { method: "POST", body: privateUploadForm })
  check(privateUpload.status === 403, "nonmembers cannot upload to private channels")

  database.prepare(`INSERT INTO modules (id, idx, slug, title, summary, channel_id, objectives, difficulty, status)
    VALUES ('private-module', 1, 'private', 'Private', 'Private', 'private', '[]', '{}', 'ready')`).run()
  database.prepare(`INSERT INTO materials (id, module_id, name, kind, size, path, uploaded_at)
    VALUES ('private-material', 'private-module', 'private.md', 'markdown', 7, 'teacher/modules/private-module/private.md', ?)`).run(new Date().toISOString())
  mkdirSync(join(courseDir, "raw/teacher/modules/private-module"), { recursive: true })
  writeFileSync(join(courseDir, "raw/teacher/modules/private-module/private.md"), "private")
  const rawDenied = await app.request("/api/modules/private-module/materials/private-material/raw?authorId=student")
  const rawAllowed = await app.request("/api/modules/private-module/materials/private-material/raw?authorId=teacher")
  check(rawDenied.status === 404 && rawAllowed.status === 200, "raw material access follows channel visibility")

  database.prepare(`INSERT INTO members (id, kind, name, scope, created_by, instructions, provider_mode, provider_model, runtime, model, token)
    VALUES ('agent-private', 'agent', 'Private agent', 'community', 'teacher', '', 'subscription', '', 'scripted', '', 'agent-token')`).run()
  database.prepare("INSERT INTO channel_members (channel_id, member_id) VALUES ('questions', 'agent-private'), ('private', 'agent-private')").run()
  const agentsForStudent = await app.request("/api/agents?authorId=student")
  const visibleAgent = (await agentsForStudent.json() as Array<{ id: string; channelIds: string[] }>).find((agent) => agent.id === "agent-private")
  check(visibleAgent?.channelIds.length === 1 && visibleAgent.channelIds[0] === "questions", "REST agent channel IDs are viewer-redacted")

  const denied = await app.request("/api/channels", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ authorId: "student", name: "Announcements", group: "course", visibility: "open" }),
  })
  check(denied.status === 403 && (await json(denied)).code === "forbidden", "route serializes stable authorization errors")

  const created = await app.request("/api/channels", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ authorId: "teacher", name: "Announcements", group: "course", visibility: "open", memberIds: ["teacher", "student"] }),
  })
  const createdChannel = await json(created)
  check(created.status === 201 && typeof createdChannel.id === "string" && events.includes("channel.created"), "channel creation returns 201 and emits its hook")

  const managedChannelId = String(createdChannel.id)
  const archive = await app.request(`/api/channels/${managedChannelId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ authorId: "teacher", status: "archived" }),
  })
  const archivedCard = await app.request("/api/cards", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ authorId: "teacher", channelId: managedChannelId, path: "teacher/archived.md", title: "Archived", type: "note", visibility: "channel", sources: [], body: "" }),
  })
  check(archive.status === 200 && archivedCard.status === 409 && (await json(archivedCard)).code === "channel_archived", "legacy card writes reject archived channels")

  const archivePrivate = await app.request("/api/channels/private", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ authorId: "teacher", status: "archived" }),
  })
  const failedMaterial = await app.request("/api/modules/private-module/materials", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ authorId: "teacher", name: "failed.md", kind: "markdown", text: "should roll back" }),
  })
  check(archivePrivate.status === 200 && failedMaterial.status === 409
    && database.prepare("SELECT 1 FROM materials WHERE name = 'failed.md'").get() === undefined
    && !existsSync(join(courseDir, "raw/teacher/modules/private-module/failed.md")), "failed material upload rolls back DB rows and file bytes")

  const form = new FormData()
  form.set("authorId", "student")
  form.set("file", new File([new Uint8Array([0, 1, 2, 255])], "notes.bin", { type: "application/octet-stream" }))
  const uploaded = await app.request("/api/channels/questions/attachments", { method: "POST", body: form })
  const attachment = await json(uploaded)
  check(uploaded.status === 201 && attachment.size === 4 && !("storagePath" in attachment), "multipart upload keeps storage paths private")

  const message = await app.request("/api/channels/questions/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      authorId: "student",
      paragraphs: [[{ kind: "text", text: "Hello" }]],
      clientId: "api-check-1",
      attachmentIds: [attachment.id],
    }),
  })
  const createdMessage = await json(message)
  check(message.status === 200 && Array.isArray(createdMessage.attachments) && events.includes("message.created"), "message route associates uploads and emits its hook")

  const retry = await app.request("/api/channels/questions/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ authorId: "student", paragraphs: [[{ kind: "text", text: "Retry" }]], clientId: "api-check-1" }),
  })
  check((await json(retry)).id === createdMessage.id, "message clientId retry is idempotent through REST")

  const reacted = await app.request(`/api/messages/${String(createdMessage.id)}/reactions/${encodeURIComponent("👍")}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ authorId: "teacher" }),
  })
  check(reacted.status === 200 && Array.isArray(await reacted.json()) && events.includes("message.reactions.updated"), "reaction route emits the aggregate update")

  const edited = await app.request(`/api/messages/${String(createdMessage.id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ authorId: "student", paragraphs: [[{ kind: "text", text: "Edited" }]] }),
  })
  const editedSnapshot = await json(await app.request("/api/community?authorId=student"))
  const editedMessage = (editedSnapshot.messages as Array<Record<string, unknown>>).find((item) => item.id === createdMessage.id)
  check(edited.status === 200 && editedMessage?.clientId === "api-check-1" && typeof editedMessage.editedAt === "string"
    && Array.isArray(editedMessage.reactions) && Array.isArray(editedMessage.attachments), "reconnect snapshot preserves v2 message lifecycle, reactions and attachments")
  const deleted = await app.request(`/api/messages/${String(createdMessage.id)}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ authorId: "student" }),
  })
  const deletedSnapshot = await json(await app.request("/api/community?authorId=student"))
  const deletedMessage = (deletedSnapshot.messages as Array<Record<string, unknown>>).find((item) => item.id === createdMessage.id)
  check(deleted.status === 200 && typeof deletedMessage?.deletedAt === "string" && Array.isArray(deletedMessage.paragraphs)
    && (deletedMessage.paragraphs as unknown[]).length === 0, "reconnect snapshot preserves message tombstones")

  const downloaded = await app.request(`/api/attachments/${String(attachment.id)}?authorId=student`)
  const bytes = new Uint8Array(await downloaded.arrayBuffer())
  check(downloaded.status === 200 && bytes.join(",") === "0,1,2,255", "attachment download preserves exact bytes")

  console.log("Workspace API OK")
} finally {
  database.close()
  rmSync(courseDir, { recursive: true, force: true })
}
