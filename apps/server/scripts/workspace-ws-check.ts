import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { WebSocket } from "ws"

const check = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message)
  console.log(`ok  ${message}`)
}

const scratch = mkdtempSync(join(tmpdir(), "ada-workspace-ws-"))
const databasePath = join(scratch, "ws.sqlite")
process.env.ADA_DB = databasePath
process.env.ADA_REQUIRE_MEMBERSHIP = "1"
process.env.PORT = "0"

const { openDatabase } = await import("../src/db.js")
const database = openDatabase(databasePath)
database.exec(`
  INSERT INTO community (id, name, subtitle, initial) VALUES ('course', 'Course', 'Test', 'C');
  INSERT INTO members (id, kind, name, initials, tone, role, token) VALUES
    ('teacher', 'person', 'Teacher', 'T', 'card', 'teacher', 'teacher-token'),
    ('student', 'person', 'Student', 'S', 'cardstock', 'student', 'student-token');
  INSERT INTO channels (id, name, group_name, visibility, status, created_by) VALUES
    ('private', 'Private', 'private', 'private', 'active', 'teacher');
  INSERT INTO channel_members (channel_id, member_id) VALUES ('private', 'teacher'), ('private', 'student');
`)
database.close()

const { startServer } = await import("../src/index.js")
const running = startServer()
let address = running.server.address()
for (let attempt = 0; (!address || typeof address === "string") && attempt < 100; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, 10))
  address = running.server.address()
}
if (!address || typeof address === "string") throw new Error("server did not bind")
const base = `http://127.0.0.1:${address.port}`

type Frame = { type: string; payload?: Record<string, unknown> }
function connect(token: string): Promise<{ socket: WebSocket; events: Frame[] }> {
  return new Promise((resolve, reject) => {
    const events: Frame[] = []
    const socket = new WebSocket(`${base.replace("http", "ws")}/ws?token=${token}`)
    socket.once("open", () => resolve({ socket, events }))
    socket.on("message", (raw) => events.push(JSON.parse(String(raw)) as Frame))
    socket.once("error", reject)
  })
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 3_000
  while (!predicate() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20))
  if (!predicate()) throw new Error("timed out waiting for WS event")
}

try {
  const teacher = await connect("teacher-token")
  const student = await connect("student-token")
  const response = await fetch(`${base}/api/channels/private/members`, {
    method: "PUT",
    headers: { authorization: "Bearer teacher-token", "content-type": "application/json" },
    body: JSON.stringify({ memberIds: ["teacher"], agentIds: [] }),
  })
  check(response.ok, "teacher can remove a private-channel member")
  await waitFor(() => teacher.events.some((event) => event.type === "channel.updated"))
  await waitFor(() => student.events.some((event) => event.type === "channel.deleted"))
  check(!student.events.some((event) => event.type === "channel.updated"), "removed viewer receives no private channel update payload")
  check(student.events.filter((event) => event.type === "channel.deleted").length === 1, "removed viewer receives exactly one channel redaction event")

  teacher.events.length = 0
  student.events.length = 0
  const created = await fetch(`${base}/api/channels`, {
    method: "POST",
    headers: { authorization: "Bearer teacher-token", "content-type": "application/json" },
    body: JSON.stringify({ name: "Visibility", group: "course", visibility: "open" }),
  })
  const createdChannel = await created.json() as { id: string }
  const privatized = await fetch(`${base}/api/channels/${createdChannel.id}`, {
    method: "PATCH",
    headers: { authorization: "Bearer teacher-token", "content-type": "application/json" },
    body: JSON.stringify({ visibility: "private" }),
  })
  check(privatized.ok, "teacher can privatize an open channel")
  await waitFor(() => student.events.some((event) => event.type === "channel.deleted"))
  check(student.events.filter((event) => event.type === "channel.deleted").length === 1, "open-to-private transition redacts the former nonmember")

  const agentOpenResponse = await fetch(`${base}/api/channels`, {
    method: "POST",
    headers: { authorization: "Bearer teacher-token", "content-type": "application/json" },
    body: JSON.stringify({ name: "Agent open", group: "course", visibility: "open" }),
  })
  const agentOpen = await agentOpenResponse.json() as { id: string }
  const agentPrivateResponse = await fetch(`${base}/api/channels`, {
    method: "POST",
    headers: { authorization: "Bearer teacher-token", "content-type": "application/json" },
    body: JSON.stringify({ name: "Agent private", group: "private", visibility: "private" }),
  })
  const agentPrivate = await agentPrivateResponse.json() as { id: string }
  const agentCreated = await fetch(`${base}/api/agents`, {
    method: "POST",
    headers: { authorization: "Bearer teacher-token", "content-type": "application/json" },
    body: JSON.stringify({ authorId: "teacher", name: "Scoped agent", instructions: "", scope: "community", runtime: "scripted", channelIds: [agentOpen.id, agentPrivate.id] }),
  })
  const agent = await agentCreated.json() as { agent: { id: string } }
  student.events.length = 0
  const narrowed = await fetch(`${base}/api/agents/${agent.agent.id}`, {
    method: "PATCH",
    headers: { authorization: "Bearer teacher-token", "content-type": "application/json" },
    body: JSON.stringify({ authorId: "teacher", channelIds: [agentPrivate.id] }),
  })
  check(narrowed.ok, "teacher can remove an agent from its open channel")
  await waitFor(() => student.events.some((event) => event.type === "member.deleted"))
  check(!student.events.some((event) => event.type === "member.updated"), "agent assignment removal does not leak a private member update")

  teacher.events.length = 0
  const empty = await fetch(`${base}/api/channels`, {
    method: "POST",
    headers: { authorization: "Bearer teacher-token", "content-type": "application/json" },
    body: JSON.stringify({ name: "Delete me", group: "private", visibility: "private" }),
  })
  const emptyChannel = await empty.json() as { id: string }
  const deleted = await fetch(`${base}/api/channels/${emptyChannel.id}`, {
    method: "DELETE",
    headers: { authorization: "Bearer teacher-token" },
  })
  check(deleted.status === 204, "teacher can delete an empty channel")
  await waitFor(() => teacher.events.some((event) => event.type === "channel.deleted"))
  check(teacher.events.filter((event) => event.type === "channel.deleted").length === 1, "empty-channel deletion emits exactly one redaction event")

  teacher.socket.close()
  student.socket.close()
  await running.close()
  console.log("Workspace WS OK")
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
