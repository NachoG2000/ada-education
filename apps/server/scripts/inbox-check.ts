import assert from "node:assert/strict"
import type { Community, Message } from "@ada/protocol"
import { inboxActivity } from "../../web/src/lib/inbox-activity.js"
const message = (id: string, authorId: string, channelId: string, threadId?: string, text = "Hello", at = "2026-09-07T10:00:00Z"): Message => ({ id, authorId, channelId, threadId, at, paragraphs: [[{ kind: "text", text }]] })
const community = {
  channels: [{ id: "public", kind: "channel", memberIds: ["me", "peer"] }, { id: "dm", kind: "dm", ownerId: "me", memberIds: ["me", "bot"] }, { id: "student-dm", kind: "dm", ownerId: "peer", memberIds: ["peer", "bot"] }],
  members: [{ id: "me", name: "My Name" }, { id: "peer", name: "Peer" }],
  threads: [{ id: "mine", rootMessageId: "root" }, { id: "other", rootMessageId: "other-root" }],
  messages: [message("root", "me", "public", "mine"), message("reply", "peer", "public", "mine"), message("unrelated", "peer", "public", "other"), message("mention", "peer", "public", undefined, "@My Name, hello"), message("substring", "peer", "public", undefined, "email@My Name"), message("incoming", "bot", "dm"), message("private-other", "bot", "student-dm"), message("own", "me", "dm")],
} as unknown as Pick<Community, "channels" | "members" | "threads" | "messages">
assert.deepEqual(new Set(inboxActivity(community, "me").map((m) => m.id)), new Set(["reply", "mention", "incoming"]))
community.messages.push(message("early", "peer", "public", "mine", "Before participation", "2026-09-07T09:00:00Z"))
assert(!inboxActivity(community, "me").some((m) => m.id === "early"))
community.messages.find((m) => m.id === "mention")!.deletedAt = "2026-09-07T11:00:00Z"
assert(!inboxActivity(community, "me").some((m) => m.id === "mention"))
console.log("Inbox eligibility OK: mentions, participating threads, own DMs, time ordering, deletion and teacher privacy.")
