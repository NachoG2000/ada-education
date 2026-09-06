/* Ada's domain model (see PRODUCT.md → Operating Context).
   Lives in @ada/protocol because web, server, and runner all share it. */

/** Procedural character palette; the visual source (fills/inks) lives in apps/web/src/lib/figure.ts and must keep these names */
export type FigureColorName =
  | "coral" | "green" | "yellow" | "blue" | "lilac"
  | "pink" | "teal" | "orange" | "red" | "lime"

export type CardType = "note" | "assignment" | "decision" | "answer" | "submission"

export type Visibility = "channel" | "only-me"

export type WorkStatus = "active" | "submitted" | "archived"

export type Presence = "online" | "away" | "thinking" | "publishing"

/** Visibility and lifecycle for chat channels. These are separate from the
    Card visibility above: cards keep their existing `channel | only-me`
    contract, while channels are either open or private and may be archived. */
export type ChannelVisibility = "open" | "private"
export type ChannelStatus = "active" | "archived"
export type AgentStatus = "active" | "inactive"
/** Known runner values plus a compatibility escape hatch for existing seeded
    rows, which historically stored an arbitrary runtime label. New API input
    schemas remain strict and accept only the two supported runtimes. */
export type AgentRuntime = "scripted" | "claude" | (string & {})

/** Stable JSON error codes shared by REST clients and server handlers. */
export type ApiErrorCode =
  | "invalid_input"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "not_channel_member"
  | "channel_archived"
  | "conflict"
  | "history_conflict"

export interface ApiError {
  error: string
  code: ApiErrorCode
  field?: string
}

export interface Person {
  kind: "person"
  id: string
  name: string
  initials: string
  /** cardstock color of the circle (neutrals/soft tints only, never tab colors) */
  tone: "card" | "cardstock" | "seal-soft" | "red-soft"
  role?: "teacher" | "student"
  presence: Presence
  joinedAt?: string
}

export interface Agent {
  kind: "agent"
  id: string
  name: string
  /** who created it: the community (teacher) or a person for their private channel */
  scope: "community" | "personal"
  createdBy: string
  /** procedural character seed (see lib/figure.ts); defaults to the id */
  figureSeed?: string
  /** fixed character color (otherwise the seed decides) */
  figureColor?: FigureColorName
  instructions: string
  provider: { mode: "subscription" | "api-key"; model: string }
  channelIds: string[]
  presence: Presence
  description?: string
  /** Existing seeded rows may contain arbitrary runtime labels; new API input
      schemas restrict values to AgentRuntime. */
  runtime?: string
  model?: string
  status?: AgentStatus
  createdAt?: string
  updatedAt?: string
  inactiveAt?: string
  avatarUrl?: string | null
}

export type Member = Person | Agent

export interface Card {
  id: string
  channelId: string
  title: string
  type: CardType
  authorId: string
  version: number
  visibility: Visibility
  /** ids of the messages or files it came from */
  sources: Array<{ kind: "message" | "file"; ref: string; label: string }>
  replaces?: string
  /** channel base document (not published from the conversation) */
  base?: boolean
  state?: "new" | "updated" | "superseded" | "compiling"
  publishedAt: string
  /** markdown */
  body: string
  /** wiki path the author published it from (lets a runtime cite seeded cards by path) */
  path?: string
}

export interface Citation {
  cardId: string
  section?: string
}

export interface Attachment {
  id: string
  channelId: string
  uploaderId: string
  name: string
  mime: string
  size: number
  createdAt: string
  messageId?: string
}

export interface MessageReaction {
  emoji: string
  count: number
  memberIds: string[]
}

export type MessageBlock =
  | { kind: "text"; text: string }
  | { kind: "cite"; text: string; cite: Citation }
  | { kind: "code"; text: string }

export interface Message {
  id: string
  channelId: string
  authorId: string
  at: string
  /** paragraphs; each paragraph is a list of inline blocks */
  paragraphs: MessageBlock[][]
  threadId?: string
  /** the answer comes from an existing card ("from the file") */
  fromCard?: { cardId: string; ago: string }
  /** the message is a card's publication post */
  publishes?: string
  clientId?: string
  editedAt?: string
  deletedAt?: string
  attachments?: Attachment[]
  reactions?: MessageReaction[]
}

export interface Thread {
  id: string
  rootMessageId: string
  replyIds: string[]
  /** card published when the thread closes */
  publishedCardId?: string
}

export interface Channel {
  id: string
  name: string
  group: "course" | "work" | "private"
  visibility?: ChannelVisibility
  status?: ChannelStatus
  createdBy?: string
  createdAt?: string
  updatedAt?: string
  archivedAt?: string
  description?: string
  memberIds: string[]
  /** real total when the id list is partial (demo) */
  memberCount?: number
  work?: { status: WorkStatus; due?: string }
  unread?: boolean
  kind?: "channel" | "dm"
  agentId?: string
  ownerId?: string
}

export interface WorkChannelInput {
  status?: WorkStatus
  due?: string
}

export interface CreateChannelInput {
  name: string
  description?: string
  group: Channel["group"]
  visibility: ChannelVisibility
  memberIds?: string[]
  agentIds?: string[]
  work?: WorkChannelInput
}

export interface UpdateChannelInput {
  name?: string
  description?: string | null
  group?: Channel["group"]
  visibility?: ChannelVisibility
  status?: ChannelStatus
  work?: WorkChannelInput | null
}

export interface ReplaceChannelMembersInput {
  memberIds: string[]
  agentIds: string[]
}

export interface CreateAgentInput {
  name: string
  description?: string
  avatarUrl?: string
  instructions: string
  scope: Agent["scope"]
  runtime: AgentRuntime
  model?: string
  figureSeed?: string
  figureColor?: FigureColorName
  channelIds: string[]
}

export interface UpdateAgentInput {
  name?: string
  description?: string
  avatarUrl?: string
  instructions?: string
  scope?: Agent["scope"]
  runtime?: AgentRuntime
  model?: string
  figureSeed?: string
  figureColor?: FigureColorName
  channelIds?: string[]
  status?: AgentStatus
}

export interface AgentEnrollment {
  runnerToken: string
  setupCommand: string
  issuedAt?: string
}

export interface AgentCreateResult {
  agent: Agent
  enrollment: AgentEnrollment
}

export interface AgentTokenRotationResult {
  agent: Agent
  enrollment: AgentEnrollment
}

export interface CommunityUpdateInput {
  name?: string
  subtitle?: string
  term?: string
}

export interface ProfileUpdateInput {
  name?: string
  initials?: string
  tone?: Person["tone"]
}

export interface EditMessageInput {
  paragraphs: MessageBlock[][]
}

export interface MessageReactionInput {
  emoji: string
}

export interface ReadMarkerInput {
  lastReadAt: string
}

export interface TypingInput {
  channelId: string
  typing: boolean
}

export interface TypingState {
  channelId: string
  memberId: string
  typing: boolean
}

/* ---- Modules, assignments, feedback and reports ---------------------------
   Added 2026-08-23 for the teacher/student demo flow (DECISIONS.md §18).
   A module is a unit of the course with its own channel, study material the
   teacher uploads, a difficulty the teacher sets (the agent only suggests), and
   the cards the agent compiled from the material. */

export type DifficultyLevel = "intro" | "core" | "advanced"

export type ModuleStatus = "empty" | "compiling" | "ready"

export interface Material {
  id: string
  name: string
  kind: "markdown" | "pdf" | "slides" | "link"
  /** bytes, when known */
  size?: number
  /** path under data/<course>/raw/ */
  path: string
  uploadedAt: string
}

export interface Difficulty {
  level: DifficultyLevel
  /** the agent's (or the teacher's) one-paragraph reason */
  rationale?: string
  /** cohort signals the level rests on ("2 of 3 students slipped on σ′ in Assignment 2") */
  evidence?: string[]
  /** agent id that proposed the current rationale/evidence */
  suggestedBy?: string
  /** person id that set the level by hand; while empty, an agent's suggestion may set it */
  setBy?: string
}

export interface Module {
  /** "03-backprop": the module's channel carries the same id */
  id: string
  index: number
  slug: string
  title: string
  summary: string
  channelId: string
  objectives: string[]
  difficulty: Difficulty
  status: ModuleStatus
  materials: Material[]
  /** computed by the server: cards published in the module's channel, oldest first */
  cardIds: string[]
  /** one line set when the teacher reconciles a report into the module */
  revision?: string
}

export interface Assignment {
  id: string
  moduleId: string
  /** the work channel it lives in */
  channelId: string
  title: string
  due: string
  status: WorkStatus
}

/** The agent's feedback to one student on one assignment. Shown only to that student. */
export interface Feedback {
  id: string
  assignmentId: string
  studentId: string
  agentId: string
  at: string
  score: { got: number; of: number }
  summary: string
  strengths: string[]
  /** where it slipped, per module, optionally pointing at the card to reread */
  gaps: Array<{ moduleId: string; note: string; cardId?: string }>
  nextSteps: Array<{ text: string; cardId?: string }>
}

/** What the agent files to the teacher after advising a student: its own
    summary and a recommendation for the module — never the student's words.
    The student sees on her screen that a summary was shared (DECISIONS.md §18). */
export interface Report {
  id: string
  agentId: string
  studentId: string
  moduleId: string
  assignmentId?: string
  at: string
  /** what the agent advised, in one paragraph */
  told: string
  recommendations: Array<{ id: string; text: string }>
  /** cards the advice rests on (the plan card, the cited cards) */
  cardIds: string[]
  status: "new" | "reconciled"
  reconciled?: { at: string; by: string; accepted: string[]; note: string; cardId: string }
}

export interface Community {
  id: string
  name: string
  subtitle: string
  initial: string
  members: Member[]
  channels: Channel[]
  cards: Card[]
  messages: Message[]
  threads: Thread[]
  modules: Module[]
  assignments: Assignment[]
  feedback: Feedback[]
  reports: Report[]
  meId: string
  updatedAt?: string
  term?: string
}
