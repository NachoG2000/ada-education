import {
  agentEnrollmentResultSchema,
  browserAuthFrameSchema,
  communityWorkspaceSnapshotSchema,
  createInviteInputSchema,
  scopedServerEventSchema,
} from "../src/index.js"

const failures: string[] = []
const check = (condition: boolean, label: string): void => {
  console.log(`${condition ? "ok " : "FAIL"} ${label}`)
  if (!condition) failures.push(label)
}

const at = "2026-09-03T12:00:00.000Z"
const membership = {
  id: "membership-1",
  userId: "user-1",
  communityId: "community-1",
  role: "teacher" as const,
  status: "active" as const,
  joinedAt: at,
}
const community = {
  id: "community-1",
  name: "Neural Networks",
  term: "2026",
  initial: "N",
  createdAt: at,
}
const agent = {
  id: "agent-1",
  communityId: "community-1",
  name: "Ada",
  instructions: "Answer from the course folder.",
  runtime: "codex" as const,
  model: "gpt-5.6",
  channelIds: ["channel-1"],
  createdBy: "user-1",
  createdAt: at,
  status: "active" as const,
}
const channel = {
  id: "channel-1",
  communityId: "community-1",
  name: "questions",
  kind: "channel" as const,
  visibility: "public" as const,
  status: "active" as const,
  createdBy: "user-1",
  createdAt: at,
  memberIds: ["user-1"],
  agentIds: ["agent-1"],
}

check(browserAuthFrameSchema.safeParse({ type: "auth", token: "x".repeat(32), communityId: "community-1" }).success,
  "browser auth binds the global bearer to one community")
check(!browserAuthFrameSchema.safeParse({ type: "auth", token: "x".repeat(32) }).success,
  "browser auth rejects an unscoped socket")

const validEvent = {
  type: "agent.created" as const,
  communityId: "community-1",
  eventId: "event-1",
  occurredAt: at,
  payload: { agent },
}
check(scopedServerEventSchema.safeParse(validEvent).success, "a consistently scoped event parses")
check(!scopedServerEventSchema.safeParse({ ...validEvent, payload: { agent: { ...agent, communityId: "community-2" } } }).success,
  "an event rejects a nested resource from another community")
check(!scopedServerEventSchema.safeParse({ ...validEvent, payload: { agent: { ...agent, runnerToken: "secret" } } }).success,
  "agent events reject runner credentials")

check(communityWorkspaceSnapshotSchema.safeParse({
  community,
  membership,
  members: [{ id: "user-1", communityId: "community-1", displayName: "Martin", initials: "MA", role: "teacher", status: "active", joinedAt: at, presence: "online" }],
  agents: [{ ...agent, presence: "offline" }],
  channels: [channel],
  directory: { communityId: "community-1", channels: [], agents: [], updatedAt: at },
  messages: [],
  threads: [],
}).success, "the browser workspace snapshot has roster, presence, joined channels, and directory")

check(agentEnrollmentResultSchema.safeParse({
  agent,
  enrollment: {
    agentId: "agent-1",
    communityId: "community-1",
    runnerToken: "r".repeat(32),
    setupCommand: "ada-runner --agent agent-1",
    issuedAt: at,
  },
}).success, "the explicit enrollment response carries the one-time runner credential")
check(!createInviteInputSchema.safeParse({ role: "student", mode: "single-use", maxUses: 2 }).success,
  "single-use invite contracts reject multiple uses")

if (failures.length > 0) {
  console.error(`\n${failures.length} hosted protocol check(s) failed`)
  process.exit(1)
}
console.log("\nHosted protocol contract OK")
