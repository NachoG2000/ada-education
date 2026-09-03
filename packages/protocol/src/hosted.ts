/*
 * Hosted-service contracts for issue #1.
 *
 * The older course-local protocol remains in types.ts/events.ts while the
 * server is migrated.  Everything in this file is deliberately scoped by
 * communityId.  Credentials are confined to request and one-time result
 * schemas; projections and events never contain bearer material.
 */
import { z } from "zod"

const idSchema = z.string().trim().min(1).max(200)
const nameSchema = z.string().trim().min(1).max(160)
const timestampSchema = z.string().datetime({ offset: true })
const avatarUrlSchema = z.string().url().max(2_000).nullable().optional()
const bearerTokenSchema = z.string().trim().min(20).max(512)
export const hostedPresenceSchema = z.enum(["online", "offline", "thinking", "publishing"])

export const membershipRoleSchema = z.enum(["teacher", "student"])
export const membershipStatusSchema = z.enum(["active", "removed", "left"])

/** A global identity.  A user's role is never stored on the user itself. */
export const userSchema = z.object({
  id: idSchema,
  displayName: nameSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
}).strict()

export const createUserInputSchema = z.object({
  displayName: nameSchema,
}).strict()

export const activeMembershipSchema = z.object({
  id: idSchema,
  userId: idSchema,
  communityId: idSchema,
  role: membershipRoleSchema,
  status: z.literal("active"),
  joinedAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
}).strict()

export const removedMembershipSchema = z.object({
  id: idSchema,
  userId: idSchema,
  communityId: idSchema,
  role: membershipRoleSchema,
  status: z.literal("removed"),
  joinedAt: timestampSchema,
  removedAt: timestampSchema,
  removedBy: idSchema,
  updatedAt: timestampSchema.optional(),
}).strict()

export const leftMembershipSchema = z.object({
  id: idSchema,
  userId: idSchema,
  communityId: idSchema,
  role: membershipRoleSchema,
  status: z.literal("left"),
  joinedAt: timestampSchema,
  leftAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
}).strict()

/** Membership lifecycle is explicit, so removed and left are not aliases for inactive. */
export const membershipSchema = z.discriminatedUnion("status", [
  activeMembershipSchema,
  removedMembershipSchema,
  leftMembershipSchema,
])

export const membershipSummarySchema = z.object({
  id: idSchema,
  userId: idSchema,
  communityId: idSchema,
  role: membershipRoleSchema,
  status: membershipStatusSchema,
  joinedAt: timestampSchema,
  endedAt: timestampSchema.optional(),
}).strict()

export const communitySummarySchema = z.object({
  id: idSchema,
  name: nameSchema,
  term: z.string().trim().min(1).max(120),
  initial: z.string().trim().min(1).max(2),
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
  membership: membershipSummarySchema,
}).strict()

/** Community data that is identical for every member. */
export const communityRecordSchema = communitySummarySchema.omit({ membership: true })

/** Session restoration never re-issues a credential; it returns safe account state. */
export const sessionOverviewSchema = z.object({
  user: userSchema,
  communities: z.array(communitySummarySchema),
}).strict()

/** The raw global bearer token is returned only when the user is first created. */
export const createUserResultSchema = z.object({
  user: userSchema,
  token: bearerTokenSchema,
}).strict()

/** Roster projection: global identity plus role and presence in one community. */
export const communityMemberSchema = z.object({
  id: idSchema,
  communityId: idSchema,
  displayName: nameSchema,
  initials: z.string().trim().min(1).max(4),
  role: membershipRoleSchema,
  status: z.literal("active"),
  joinedAt: timestampSchema,
  presence: hostedPresenceSchema,
}).strict()

export const createCommunityInputSchema = z.object({
  name: nameSchema,
  term: z.string().trim().min(1).max(120),
}).strict()

export const createCommunityResultSchema = z.object({
  community: communitySummarySchema,
  membership: activeMembershipSchema,
}).strict()

/** Explicit aliases keep endpoint naming readable without duplicating schemas. */
export const communityCreateInputSchema = createCommunityInputSchema
export const communityCreateResultSchema = createCommunityResultSchema

/** Invite metadata intentionally omits the bearer code. */
export const inviteModeSchema = z.enum(["single-use", "reusable"])
export const inviteMetadataSchema = z.object({
  id: idSchema,
  communityId: idSchema,
  role: membershipRoleSchema,
  mode: inviteModeSchema,
  createdBy: idSchema,
  createdAt: timestampSchema,
  expiresAt: timestampSchema.optional(),
  uses: z.number().int().nonnegative(),
  maxUses: z.number().int().positive().optional(),
  revokedAt: timestampSchema.optional(),
}).strict()

export const createInviteInputSchema = z.object({
  role: membershipRoleSchema,
  mode: inviteModeSchema,
  expiresAt: timestampSchema.optional(),
  maxUses: z.number().int().positive().max(100_000).optional(),
}).strict().superRefine((input, context) => {
  if (input.mode === "single-use" && input.maxUses !== undefined && input.maxUses !== 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["maxUses"], message: "single-use invites have exactly one use" })
  }
})

/** The raw code is returned only when the teacher creates the invite. */
export const inviteCreateResultSchema = z.object({
  invite: inviteMetadataSchema,
  code: bearerTokenSchema,
}).strict()

export const redeemInviteInputSchema = z.object({
  code: bearerTokenSchema,
}).strict()

export const inviteRedeemResultSchema = z.object({
  community: communitySummarySchema,
  membership: activeMembershipSchema,
}).strict()

export const inviteCreateInputSchema = createInviteInputSchema
export const inviteRedeemInputSchema = redeemInviteInputSchema

export const communityChannelKindSchema = z.enum(["channel", "dm"])
export const communityChannelVisibilitySchema = z.enum(["public", "private"])
export const communityChannelStatusSchema = z.enum(["active", "archived"])

/** Full channel projection.  The community id is mandatory in the hosted API. */
export const communityChannelSchema = z.object({
  id: idSchema,
  communityId: idSchema,
  name: nameSchema,
  description: z.string().max(2_000).optional(),
  kind: communityChannelKindSchema,
  visibility: communityChannelVisibilitySchema,
  status: communityChannelStatusSchema,
  createdBy: idSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
  archivedAt: timestampSchema.optional(),
  memberIds: z.array(idSchema).max(10_000),
  agentIds: z.array(idSchema).max(1_000),
  /** Present only for a DM channel. */
  agentId: idSchema.optional(),
  ownerId: idSchema.optional(),
}).strict().superRefine((channel, context) => {
  if (channel.kind === "dm" && !channel.agentId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["agentId"], message: "DM channels must identify their agent" })
  }
})

/** Directory entries are public-safe and omit private membership lists. */
export const channelDirectoryEntrySchema = z.object({
  id: idSchema,
  communityId: idSchema,
  name: nameSchema,
  description: z.string().max(2_000).optional(),
  kind: communityChannelKindSchema,
  visibility: communityChannelVisibilitySchema,
  status: communityChannelStatusSchema,
  memberCount: z.number().int().nonnegative(),
  createdAt: timestampSchema,
}).strict()

export const createCommunityChannelInputSchema = z.object({
  name: nameSchema,
  description: z.string().max(2_000).optional(),
  kind: z.literal("channel"),
  visibility: communityChannelVisibilitySchema,
}).strict()

export const updateCommunityChannelInputSchema = z.object({
  name: nameSchema.optional(),
  description: z.string().max(2_000).nullable().optional(),
  visibility: communityChannelVisibilitySchema.optional(),
  status: communityChannelStatusSchema.optional(),
}).strict()

export const joinChannelInputSchema = z.object({
  channelId: idSchema,
}).strict()

/** An agent DM is a private channel and is unique for one user/agent pair. */
export const createAgentDmInputSchema = z.object({
  agentId: idSchema,
}).strict()

export const agentDmSchema = z.object({
  channelId: idSchema,
  communityId: idSchema,
  agentId: idSchema,
  ownerId: idSchema,
  createdAt: timestampSchema,
  status: communityChannelStatusSchema,
  archivedAt: timestampSchema.optional(),
}).strict()

export const agentRuntimeV2Schema = z.enum(["claude", "codex"])
export const agentLifecycleStatusSchema = z.enum(["active", "deleted"])

const agentProjectionBase = {
  id: idSchema,
  communityId: idSchema,
  name: nameSchema,
  avatarUrl: avatarUrlSchema,
  instructions: z.string().max(20_000),
  runtime: agentRuntimeV2Schema,
  model: z.string().trim().min(1).max(200),
  channelIds: z.array(idSchema).max(1_000),
  createdBy: idSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
}

export const activeAgentSchema = z.object({
  ...agentProjectionBase,
  status: z.literal("active"),
}).strict()

export const deletedAgentSchema = z.object({
  ...agentProjectionBase,
  status: z.literal("deleted"),
  deletedAt: timestampSchema,
  deletedBy: idSchema,
}).strict()

/** Agent projections have no token or enrollment fields. */
export const agentRecordSchema = z.discriminatedUnion("status", [activeAgentSchema, deletedAgentSchema])
export const communityAgentSchema = activeAgentSchema.extend({
  presence: hostedPresenceSchema,
}).strict()
export const publicAgentDirectoryEntrySchema = z.object({
  id: idSchema,
  communityId: idSchema,
  name: nameSchema,
  avatarUrl: avatarUrlSchema,
  runtime: agentRuntimeV2Schema,
  model: z.string().trim().min(1).max(200),
  status: agentLifecycleStatusSchema,
}).strict()

export const publicDirectorySchema = z.object({
  communityId: idSchema,
  channels: z.array(channelDirectoryEntrySchema),
  agents: z.array(publicAgentDirectoryEntrySchema),
  updatedAt: timestampSchema,
}).strict()

export const createCommunityAgentInputSchema = z.object({
  name: nameSchema,
  avatarUrl: avatarUrlSchema,
  instructions: z.string().max(20_000),
  runtime: agentRuntimeV2Schema,
  model: z.string().trim().min(1).max(200),
  channelIds: z.array(idSchema).max(1_000),
}).strict()

export const updateCommunityAgentInputSchema = z.object({
  name: nameSchema.optional(),
  avatarUrl: avatarUrlSchema,
  instructions: z.string().max(20_000).optional(),
  runtime: agentRuntimeV2Schema.optional(),
  model: z.string().trim().min(1).max(200).optional(),
  channelIds: z.array(idSchema).max(1_000).optional(),
}).strict()

/** Raw runner token appears only in this one-time response and nowhere in an Agent. */
export const agentEnrollmentResultSchema = z.object({
  agent: activeAgentSchema,
  enrollment: z.object({
    agentId: idSchema,
    communityId: idSchema,
    runnerToken: z.string().trim().min(20).max(512),
    setupCommand: z.string().trim().min(1).max(4_000),
    issuedAt: timestampSchema,
  }).strict(),
}).strict()

export const rotateAgentEnrollmentInputSchema = z.object({}).strict()
export const rotateAgentEnrollmentResultSchema = agentEnrollmentResultSchema

const messageBlockSchemaV2 = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string() }).strict(),
  z.object({ kind: z.literal("cite"), text: z.string(), cite: z.object({ cardId: idSchema, section: z.string().optional() }).strict() }).strict(),
  z.object({ kind: z.literal("code"), text: z.string() }).strict(),
])

export const scopedMessageSchema = z.object({
  id: idSchema,
  communityId: idSchema,
  channelId: idSchema,
  authorId: idSchema,
  at: timestampSchema,
  paragraphs: z.array(z.array(messageBlockSchemaV2)),
  threadId: idSchema.optional(),
  clientId: z.string().max(200).optional(),
  editedAt: timestampSchema.optional(),
  deletedAt: timestampSchema.optional(),
  deletedBy: idSchema.optional(),
}).strict()

/** Delete events carry this minimal tombstone and no deleted message content. */
export const messageTombstoneSchema = z.object({
  id: idSchema,
  communityId: idSchema,
  channelId: idSchema,
  authorId: idSchema,
  status: z.literal("deleted"),
  deletedAt: timestampSchema,
  deletedBy: idSchema,
}).strict()

export const scopedThreadSchema = z.object({
  id: idSchema,
  communityId: idSchema,
  channelId: idSchema,
  rootMessageId: idSchema,
  replyIds: z.array(idSchema),
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
}).strict()

/** One tenant's complete browser hydration payload. Card memory is kept out of
    this UI projection even though the runner/server card API remains active. */
export const communityWorkspaceSnapshotSchema = z.object({
  community: communityRecordSchema,
  membership: activeMembershipSchema,
  members: z.array(communityMemberSchema),
  agents: z.array(communityAgentSchema),
  channels: z.array(communityChannelSchema),
  directory: publicDirectorySchema,
  messages: z.array(scopedMessageSchema),
  threads: z.array(scopedThreadSchema),
}).strict().superRefine((snapshot, context) => {
  const expected = snapshot.community.id
  const scoped: Array<[string, string]> = [
    ["membership.communityId", snapshot.membership.communityId],
    ["directory.communityId", snapshot.directory.communityId],
    ...snapshot.members.map((member, index): [string, string] => [`members.${index}.communityId`, member.communityId]),
    ...snapshot.agents.map((agent, index): [string, string] => [`agents.${index}.communityId`, agent.communityId]),
    ...snapshot.channels.map((channel, index): [string, string] => [`channels.${index}.communityId`, channel.communityId]),
    ...snapshot.messages.map((message, index): [string, string] => [`messages.${index}.communityId`, message.communityId]),
    ...snapshot.threads.map((thread, index): [string, string] => [`threads.${index}.communityId`, thread.communityId]),
  ]
  for (const [path, actual] of scoped) {
    if (actual !== expected) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: path.split("."), message: "snapshot resource belongs to a different community" })
    }
  }
})

export const createScopedMessageInputSchema = z.object({
  channelId: idSchema,
  threadId: idSchema.optional(),
  paragraphs: z.array(z.array(messageBlockSchemaV2).min(1)).min(1),
  clientId: z.string().max(200).optional(),
}).strict()

export const editScopedMessageInputSchema = z.object({
  paragraphs: z.array(z.array(messageBlockSchemaV2).min(1)).min(1),
}).strict()

export const deleteScopedMessageInputSchema = z.object({}).strict()
export const createScopedThreadInputSchema = z.object({
  channelId: idSchema,
  rootMessageId: idSchema,
}).strict()

const eventBase = {
  communityId: idSchema,
  eventId: idSchema,
  occurredAt: timestampSchema,
  sequence: z.number().int().nonnegative().optional(),
}

const scopedEvent = <T extends z.ZodRawShape>(type: string, payload: z.ZodObject<T>) =>
  z.object({ ...eventBase, type: z.literal(type), payload }).strict()

const scopedServerEventUnion = z.discriminatedUnion("type", [
  scopedEvent("community.updated", z.object({ community: communityRecordSchema }).strict()),
  scopedEvent("membership.created", z.object({ membership: membershipSchema }).strict()),
  scopedEvent("membership.updated", z.object({ membership: membershipSchema }).strict()),
  scopedEvent("membership.removed", z.object({ membership: removedMembershipSchema }).strict()),
  scopedEvent("membership.left", z.object({ membership: leftMembershipSchema }).strict()),
  scopedEvent("channel.created", z.object({ channel: communityChannelSchema }).strict()),
  scopedEvent("channel.updated", z.object({ channel: communityChannelSchema }).strict()),
  scopedEvent("channel.archived", z.object({ channel: communityChannelSchema }).strict()),
  scopedEvent("channel.deleted", z.object({ channelId: idSchema, deletedAt: timestampSchema, deletedBy: idSchema }).strict()),
  scopedEvent("directory.updated", z.object({ channels: z.array(channelDirectoryEntrySchema), agents: z.array(publicAgentDirectoryEntrySchema) }).strict()),
  scopedEvent("agent.created", z.object({ agent: activeAgentSchema }).strict()),
  scopedEvent("agent.updated", z.object({ agent: activeAgentSchema }).strict()),
  scopedEvent("agent.deleted", z.object({ agent: deletedAgentSchema }).strict()),
  scopedEvent("agent.dm.created", z.object({ dm: agentDmSchema, channel: communityChannelSchema }).strict()),
  scopedEvent("agent.dm.deleted", z.object({ channelId: idSchema, agentId: idSchema, deletedAt: timestampSchema }).strict()),
  scopedEvent("message.created", z.object({ message: scopedMessageSchema }).strict()),
  scopedEvent("message.updated", z.object({ message: scopedMessageSchema }).strict()),
  scopedEvent("message.deleted", z.object({ message: messageTombstoneSchema }).strict()),
  scopedEvent("thread.created", z.object({ thread: scopedThreadSchema }).strict()),
  scopedEvent("thread.updated", z.object({ thread: scopedThreadSchema }).strict()),
  scopedEvent("runner.presence", z.object({ presence: hostedPresenceSchema, agentId: idSchema, runtime: agentRuntimeV2Schema, model: z.string().max(200).optional() }).strict()),
  scopedEvent("card.published", z.object({ channelId: idSchema, cardId: idSchema, messageId: idSchema.optional() }).strict()),
])

/** Reject a syntactically valid event if a nested resource claims a different
    tenant from its envelope. The server remains the authorization boundary;
    this catches accidental cross-tenant serialization at every consumer. */
export const scopedServerEventSchema = scopedServerEventUnion.superRefine((event, context) => {
  const visit = (value: unknown, path: Array<string | number>): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, index]))
      return
    }
    if (!value || typeof value !== "object") return
    for (const [key, nested] of Object.entries(value)) {
      const nextPath = [...path, key]
      if (key === "communityId" && typeof nested === "string" && nested !== event.communityId) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: nextPath, message: "nested resource belongs to a different community" })
      } else {
        visit(nested, nextPath)
      }
    }
  }
  visit(event.payload, ["payload"])
})

/** Browser WS authentication must be the first client frame. */
export const browserAuthFrameSchema = z.object({
  type: z.literal("auth"),
  token: bearerTokenSchema,
  communityId: idSchema,
}).strict()

export const browserReadyFrameSchema = z.object({
  type: z.literal("ready"),
  payload: z.object({
    user: userSchema,
    communityId: idSchema,
  }).strict(),
}).strict()

export const browserServerFrameSchema = z.discriminatedUnion("type", [
  browserReadyFrameSchema,
  z.object({ type: z.literal("event"), payload: z.object({ event: scopedServerEventSchema }).strict() }).strict(),
  z.object({ type: z.literal("error"), payload: z.object({ code: z.string(), message: z.string() }).strict() }).strict(),
])

/** Runner WS authentication must also be the first client frame. */
export const runnerAuthFrameSchema = z.object({
  type: z.literal("auth"),
  token: bearerTokenSchema,
}).strict()

export const runnerReadyFrameSchema = z.object({
  type: z.literal("ready"),
  payload: z.object({
    agent: activeAgentSchema,
  }).strict(),
}).strict()

export const runnerPresenceSchema = z.object({
  type: z.literal("presence"),
  payload: z.object({
    presence: hostedPresenceSchema,
    runtime: agentRuntimeV2Schema,
    model: z.string().trim().min(1).max(200).optional(),
  }).strict(),
}).strict()

/** Work dispatched by the server contains community and agent scope explicitly. */
export const runnerWorkSchema = z.object({
  type: z.literal("work"),
  payload: z.object({
    workId: idSchema,
    communityId: idSchema,
    agentId: idSchema,
    channelId: idSchema,
    threadId: idSchema.optional(),
    message: scopedMessageSchema,
    context: z.array(scopedMessageSchema),
  }).strict(),
}).strict()

export const runnerMessageCreateSchema = z.object({
  type: z.literal("message.create"),
  ref: idSchema,
  payload: z.object({
    communityId: idSchema,
    agentId: idSchema,
    channelId: idSchema,
    threadId: idSchema.optional(),
    paragraphs: z.array(z.array(messageBlockSchemaV2).min(1)).min(1),
  }).strict(),
}).strict()

/** Runner card publication keeps the card-file pipeline, but is tenant-scoped. */
export const runnerCardPublishSchema = z.object({
  type: z.literal("card.publish"),
  ref: idSchema,
  payload: z.object({
    communityId: idSchema,
    agentId: idSchema,
    channelId: idSchema,
    path: z.string().trim().min(1).max(2_000),
    title: nameSchema,
    type: z.enum(["note", "assignment", "decision", "answer", "submission"]),
    body: z.string(),
    sourceMessageIds: z.array(idSchema).max(100),
    replacesCardId: idSchema.optional(),
  }).strict(),
}).strict()

export const runnerClientFrameSchema = z.discriminatedUnion("type", [
  runnerAuthFrameSchema,
  runnerPresenceSchema,
  runnerMessageCreateSchema,
  runnerCardPublishSchema,
])

/** The browser's first client frame is currently the complete client union. */
export const browserClientFrameSchema = browserAuthFrameSchema
/** Full envelope alias for callers that need to retain an event generically. */
export const scopedEventEnvelopeSchema = scopedServerEventSchema

export const runnerServerFrameSchema = z.union([
  runnerReadyFrameSchema,
  runnerWorkSchema,
  z.object({
    type: z.literal("ack"),
    ref: idSchema,
    ok: z.literal(true),
    messageId: idSchema.optional(),
    cardId: idSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal("ack"),
    ref: idSchema,
    ok: z.literal(false),
    error: z.string().trim().min(1).max(1_200),
  }).strict(),
  z.object({ type: z.literal("error"), payload: z.object({ code: z.string(), message: z.string() }).strict() }).strict(),
])

/* Inferred public types.  Network callers should use the schemas above at
   every boundary rather than hand-maintaining parallel interfaces. */
export type User = z.infer<typeof userSchema>
export type CreateUserInput = z.infer<typeof createUserInputSchema>
export type CreateUserResult = z.infer<typeof createUserResultSchema>
export type SessionOverview = z.infer<typeof sessionOverviewSchema>
export type Membership = z.infer<typeof membershipSchema>
export type ActiveMembership = z.infer<typeof activeMembershipSchema>
export type RemovedMembership = z.infer<typeof removedMembershipSchema>
export type LeftMembership = z.infer<typeof leftMembershipSchema>
export type MembershipSummary = z.infer<typeof membershipSummarySchema>
export type CommunitySummary = z.infer<typeof communitySummarySchema>
export type CommunityRecord = z.infer<typeof communityRecordSchema>
export type CommunityMember = z.infer<typeof communityMemberSchema>
export type CreateCommunityInput = z.infer<typeof createCommunityInputSchema>
export type CreateCommunityResult = z.infer<typeof createCommunityResultSchema>
export type InviteMode = z.infer<typeof inviteModeSchema>
export type InviteMetadata = z.infer<typeof inviteMetadataSchema>
export type CreateInviteInput = z.infer<typeof createInviteInputSchema>
export type InviteCreateResult = z.infer<typeof inviteCreateResultSchema>
export type RedeemInviteInput = z.infer<typeof redeemInviteInputSchema>
export type InviteRedeemResult = z.infer<typeof inviteRedeemResultSchema>
export type PublicDirectory = z.infer<typeof publicDirectorySchema>
export type CommunityChannel = z.infer<typeof communityChannelSchema>
export type ChannelDirectoryEntry = z.infer<typeof channelDirectoryEntrySchema>
export type CreateCommunityChannelInput = z.infer<typeof createCommunityChannelInputSchema>
export type UpdateCommunityChannelInput = z.infer<typeof updateCommunityChannelInputSchema>
export type JoinChannelInput = z.infer<typeof joinChannelInputSchema>
export type CreateAgentDmInput = z.infer<typeof createAgentDmInputSchema>
export type AgentDm = z.infer<typeof agentDmSchema>
export type ActiveAgent = z.infer<typeof activeAgentSchema>
export type DeletedAgent = z.infer<typeof deletedAgentSchema>
export type AgentRecord = z.infer<typeof agentRecordSchema>
export type CommunityAgent = z.infer<typeof communityAgentSchema>
export type PublicAgentDirectoryEntry = z.infer<typeof publicAgentDirectoryEntrySchema>
export type CreateCommunityAgentInput = z.infer<typeof createCommunityAgentInputSchema>
export type UpdateCommunityAgentInput = z.infer<typeof updateCommunityAgentInputSchema>
export type AgentEnrollmentResult = z.infer<typeof agentEnrollmentResultSchema>
export type RotateAgentEnrollmentResult = z.infer<typeof rotateAgentEnrollmentResultSchema>
export type ScopedMessage = z.infer<typeof scopedMessageSchema>
export type MessageTombstone = z.infer<typeof messageTombstoneSchema>
export type ScopedThread = z.infer<typeof scopedThreadSchema>
export type CommunityWorkspaceSnapshot = z.infer<typeof communityWorkspaceSnapshotSchema>
export type CreateScopedMessageInput = z.infer<typeof createScopedMessageInputSchema>
export type EditScopedMessageInput = z.infer<typeof editScopedMessageInputSchema>
export type DeleteScopedMessageInput = z.infer<typeof deleteScopedMessageInputSchema>
export type CreateScopedThreadInput = z.infer<typeof createScopedThreadInputSchema>
export type ScopedServerEvent = z.infer<typeof scopedServerEventSchema>
export type BrowserAuthFrame = z.infer<typeof browserAuthFrameSchema>
export type BrowserReadyFrame = z.infer<typeof browserReadyFrameSchema>
export type BrowserServerFrame = z.infer<typeof browserServerFrameSchema>
export type RunnerAuthFrame = z.infer<typeof runnerAuthFrameSchema>
export type RunnerReadyFrame = z.infer<typeof runnerReadyFrameSchema>
export type RunnerPresence = z.infer<typeof runnerPresenceSchema>
export type RunnerWork = z.infer<typeof runnerWorkSchema>
export type RunnerMessageCreate = z.infer<typeof runnerMessageCreateSchema>
export type RunnerCardPublish = z.infer<typeof runnerCardPublishSchema>
export type RunnerClientFrame = z.infer<typeof runnerClientFrameSchema>
export type RunnerServerFrame = z.infer<typeof runnerServerFrameSchema>
export type ScopedEventEnvelope = z.infer<typeof scopedEventEnvelopeSchema>
