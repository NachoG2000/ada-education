import assert from "node:assert/strict"
import {
  createMessage,
  getMember,
  openDatabase,
  seedCommunity,
  upsertAgent,
  upsertChannel,
  upsertPerson,
} from "../src/db.js"
import { getViewerCommunitySnapshot } from "../src/workspace-access.js"
import {
  archiveChannel,
  createChannel,
  deleteEmptyChannel,
  joinChannel,
  leaveChannel,
  replaceChannelMembers,
  unarchiveChannel,
  updateChannel,
} from "../src/workspace-channels.js"
import { WorkspaceError } from "../src/workspace-errors.js"

const database = openDatabase(":memory:")
seedCommunity(database, { id: "check", name: "Check", subtitle: "Workspace check", initial: "C" })
upsertPerson(database, { id: "teacher", name: "Teacher", initials: "T", tone: "card", role: "teacher" })
upsertPerson(database, { id: "student", name: "Student", initials: "S", tone: "cardstock", role: "student" })
upsertAgent(database, {
  id: "ada-check",
  name: "Ada Check",
  scope: "community",
  createdBy: "teacher",
  instructions: "Check",
  channelIds: [],
  token: "check-token",
  runtime: "scripted",
})
upsertChannel(database, { id: "course", name: "Course", group: "course", memberIds: ["teacher", "student"] })
upsertChannel(database, { id: "private-hidden", name: "Hidden", group: "private", memberIds: ["teacher"] })

const teacher = getMember(database, "teacher")
const student = getMember(database, "student")
assert(teacher?.kind === "person")
assert(student?.kind === "person")

const hidden = getViewerCommunitySnapshot(database, new Map(), student)
assert(hidden.channels.some((channel) => channel.id === "course"))
assert(!hidden.channels.some((channel) => channel.id === "private-hidden"))

const privateChannel = createChannel(database, {
  name: "Student Room",
  group: "private",
  visibility: "private",
  memberIds: [],
  agentIds: ["ada-check"],
}, student)
assert.equal(privateChannel.createdBy, "student")
assert(privateChannel.memberIds.includes("student"))
assert(privateChannel.memberIds.includes("ada-check"))

assert.throws(
  () => createChannel(database, { name: "student room", group: "private", visibility: "private" }, teacher),
  (error: unknown) => error instanceof WorkspaceError && error.code === "conflict",
)

const managed = createChannel(database, {
  name: "Managed Course",
  group: "course",
  visibility: "open",
  memberIds: ["teacher"],
  agentIds: [],
}, teacher)
assert(!managed.memberIds.includes("student"))
joinChannel(database, managed.id, student)
assert(getMember(database, "student"))
assert(updateChannel(database, managed.id, { description: "Updated" }, teacher).description === "Updated")
replaceChannelMembers(database, managed.id, { memberIds: ["teacher", "student"], agentIds: ["ada-check"] }, teacher)
assert.equal(archiveChannel(database, managed.id, teacher).status, "archived")
assert.equal(unarchiveChannel(database, managed.id, teacher).status, "active")
assert(leaveChannel(database, managed.id, student).memberIds.includes("teacher"))

const message = createMessage(database, {
  channelId: "course",
  authorId: "teacher",
  paragraphs: [[{ kind: "text", text: "history" }]],
})
assert(message.id)
assert.throws(
  () => deleteEmptyChannel(database, "course", teacher),
  (error: unknown) => error instanceof WorkspaceError && error.code === "history_conflict",
)

const empty = createChannel(database, {
  name: "Disposable",
  group: "course",
  visibility: "open",
  memberIds: ["teacher"],
  agentIds: [],
}, teacher)
deleteEmptyChannel(database, empty.id, teacher)
assert.equal(database.prepare("SELECT 1 FROM channels WHERE id = ?").get(empty.id), undefined)

console.log("workspace channel checks passed")
