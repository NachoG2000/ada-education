import { openDatabase } from "../src/db.js"
import { WorkspaceError } from "../src/workspace-errors.js"
import {
  createAgent,
  deleteAgent,
  rotateAgentToken,
  updateAgent,
  updateCommunity,
  updateProfile,
} from "../src/workspace-members.js"
import {
  addMessageReaction,
  createWorkspaceMessage,
  editWorkspaceMessage,
  markChannelRead,
  removeMessageReaction,
  tombstoneWorkspaceMessage,
} from "../src/workspace-messages.js"

const check = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message)
  console.log(`ok  ${message}`)
}

function expectCode(fn: () => unknown, code: string, message: string): void {
  try {
    fn()
  } catch (error) {
    check(error instanceof WorkspaceError && error.code === code, message)
    return
  }
  throw new Error(`${message}: expected ${code}`)
}

const database = openDatabase(":memory:")
try {
  database.exec(`
    INSERT INTO community (id, name, subtitle, initial) VALUES ('course', 'Course', 'Test', 'C');
    INSERT INTO members (id, kind, name, initials, tone, role) VALUES
      ('teacher', 'person', 'Teacher', 'T', 'card', 'teacher'),
      ('student', 'person', 'Student', 'S', 'cardstock', 'student'),
      ('other', 'person', 'Other', 'O', 'card', 'student');
    INSERT INTO channels (id, name, group_name, visibility, status, created_by) VALUES
      ('questions', 'Questions', 'course', 'open', 'active', 'teacher'),
      ('private-student', 'Private', 'private', 'private', 'active', 'student'),
      ('archived', 'Archived', 'course', 'open', 'archived', 'teacher');
    INSERT INTO channel_members (channel_id, member_id) VALUES
      ('questions', 'teacher'), ('questions', 'student'), ('private-student', 'student'), ('archived', 'teacher'), ('archived', 'student');
  `)

  const community = updateCommunity(database, "teacher", { name: "Updated course" })
  check(community.name === "Updated course", "teacher can update community metadata")
  const profile = updateProfile(database, "student", "student", { name: "Learner" })
  check(profile.name === "Learner", "a person can update their own profile")
  expectCode(() => updateProfile(database, "student", "teacher", { name: "Nope" }), "forbidden", "profile updates cannot target another member")

  const created = createAgent(database, "teacher", {
    name: "Course guide",
    instructions: "Help the cohort.",
    scope: "community",
    runtime: "scripted",
    channelIds: ["questions"],
  })
  check(created.agent.kind === "agent" && created.agent.status === "active", "teacher can create a community agent")
  check(!("token" in created.agent) && created.enrollment.runnerToken.length > 20, "agent snapshots omit tokens and enrollment returns one token")
  check(created.enrollment.setupCommand.includes("--token '") && !created.enrollment.setupCommand.includes("API_KEY"), "setup command is shell-safe and contains no provider credential")
  const agentId = created.agent.id

  const editedAgent = updateAgent(database, "teacher", agentId, { description: "Updated", avatarUrl: "https://example.com/guide.png", figureSeed: "rerolled" })
  check(editedAgent.description === "Updated" && editedAgent.avatarUrl === "https://example.com/guide.png" && editedAgent.figureSeed === "rerolled", "teacher can update agent configuration")
  const inactive = updateAgent(database, "teacher", agentId, { status: "inactive" })
  check(inactive.status === "inactive" && (database.prepare("SELECT token FROM members WHERE id = ?").get(agentId) as { token?: unknown }).token === null, "deactivation clears the token and preserves identity")
  const active = updateAgent(database, "teacher", agentId, { status: "active" })
  check(active.status === "active" && (database.prepare("SELECT token FROM members WHERE id = ?").get(agentId) as { token?: unknown }).token === null, "reactivation does not invent a credential")
  const rotated = rotateAgentToken(database, "teacher", agentId)
  check(rotated.enrollment.runnerToken.length > 20 && !("token" in rotated.agent), "rotation returns a one-time token without exposing it in the agent")
  expectCode(() => deleteAgent(database, "teacher", agentId), "history_conflict", "agent deletion refuses remaining memberships")
  database.prepare("DELETE FROM channel_members WHERE member_id = ?").run(agentId)
  database.prepare("INSERT INTO messages (id, channel_id, author_id, at, paragraphs) VALUES (?, ?, ?, ?, ?)")
    .run("agent-history", "questions", agentId, new Date().toISOString(), "[]")
  expectCode(() => deleteAgent(database, "teacher", agentId), "history_conflict", "agent deletion refuses authored message history")
  database.prepare("DELETE FROM messages WHERE id = 'agent-history'").run()
  deleteAgent(database, "teacher", agentId)
  check(!database.prepare("SELECT 1 FROM members WHERE id = ?").get(agentId), "history-free community agent can be deleted")

  const personal = createAgent(database, "student", {
    name: "Study guide",
    instructions: "Help this student.",
    scope: "personal",
    runtime: "scripted",
    channelIds: ["private-student"],
  })
  const ownerEdited = updateAgent(database, "student", personal.agent.id, { name: "Personal guide" })
  check(ownerEdited.name === "Personal guide", "personal agent owner can manage the agent")
  expectCode(() => updateAgent(database, "other", personal.agent.id, { name: "Nope" }), "forbidden", "personal agent authorization excludes other students")
  const personalEdited = updateAgent(database, "teacher", personal.agent.id, { name: "Teacher edited guide" })
  check(personalEdited.name === "Teacher edited guide", "teacher can manage a personal agent")
  expectCode(() => deleteAgent(database, "teacher", personal.agent.id), "history_conflict", "agent deletion refuses remaining channel memberships")
  database.prepare("DELETE FROM channel_members WHERE member_id = ?").run(personal.agent.id)
  deleteAgent(database, "teacher", personal.agent.id)
  check(!database.prepare("SELECT 1 FROM members WHERE id = ?").get(personal.agent.id), "history-free agent can be deleted")

  database.prepare("INSERT INTO attachments (id, channel_id, uploader_id, name, mime, size, storage_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run("att-1", "questions", "student", "notes.txt", "text/plain", 4, "raw/chat/questions/att-1-notes.txt", new Date().toISOString())
  const message = createWorkspaceMessage(database, "student", "questions", {
    paragraphs: [[{ kind: "text", text: "Hello" }]],
    clientId: "client-1",
    attachmentIds: ["att-1"],
  })
  check(message.attachments?.length === 1 && message.clientId === "client-1", "message creation associates same-channel unattached metadata")
  const retry = createWorkspaceMessage(database, "student", "questions", {
    paragraphs: [[{ kind: "text", text: "Changed retry body" }]],
    clientId: "client-1",
  })
  check(retry.id === message.id && retry.paragraphs[0]?.[0]?.text === "Hello", "client ID retry is idempotent")
  expectCode(() => createWorkspaceMessage(database, "student", "archived", { paragraphs: [[{ kind: "text", text: "No" }]] }), "channel_archived", "archived channels reject new messages")
  expectCode(() => createWorkspaceMessage(database, "teacher", "private-student", { paragraphs: [[{ kind: "text", text: "No" }]] }), "not_channel_member", "nonmembers cannot create messages")

  const edited = editWorkspaceMessage(database, "student", message.id, { paragraphs: [[{ kind: "text", text: "Edited" }]] })
  check(edited.editedAt && edited.paragraphs[0]?.[0]?.text === "Edited", "message author can edit")
  const reactions = addMessageReaction(database, "teacher", message.id, "👍")
  check(reactions[0]?.count === 1 && reactions[0]?.memberIds[0] === "teacher", "active channel members can add reactions")
  check(removeMessageReaction(database, "teacher", message.id, "👍").length === 0, "reaction removal aggregates cleanly")
  const read = markChannelRead(database, "student", "questions", { lastReadAt: new Date().toISOString() })
  check(read.memberId === "student" && read.unread === false, "read marker upsert returns unread state")
  const tombstone = tombstoneWorkspaceMessage(database, "teacher", message.id)
  check(tombstone.deletedAt && tombstone.paragraphs.length === 0 && !tombstone.attachments?.length, "teacher tombstone preserves row while clearing content and attachment association")
  check((database.prepare("SELECT message_id FROM attachments WHERE id = 'att-1'").get() as { message_id?: unknown }).message_id === null, "tombstone detaches attachments for safe cleanup")

  console.log("Workspace members/messages OK")
} finally {
  database.close()
}
