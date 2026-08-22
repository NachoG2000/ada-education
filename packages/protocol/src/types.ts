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

export interface Person {
  kind: "person"
  id: string
  name: string
  initials: string
  /** cardstock color of the circle (neutrals/soft tints only, never tab colors) */
  tone: "card" | "cardstock" | "seal-soft" | "red-soft"
  role?: "teacher" | "student"
  presence: Presence
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
}

export interface Citation {
  cardId: string
  section?: string
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
  reactions?: Array<{ emoji: string; count: number }>
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
  description?: string
  memberIds: string[]
  /** real total when the id list is partial (demo) */
  memberCount?: number
  work?: { status: WorkStatus; due?: string }
  unread?: boolean
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
  meId: string
}
