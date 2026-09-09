import type { Agent, Channel, Member, Message, MessageBlock } from "@ada/protocol"

/**
 * Looks for handles in text blocks only, never in citations or code.
 * Ada's ids are deliberately simple, but we accept hyphens and
 * underscores so the contract doesn't depend on the visible name.
 */
export function mentionedAgentIds(message: Message, channel: Channel, members: Member[]): string[] {
  const memberIds = new Set(channel.memberIds)
  const agents = new Set(
    members
      .filter((member): member is Agent => member.kind === "agent" && memberIds.has(member.id))
      .map((member) => member.id),
  )
  const result = new Set<string>()
  // A private channel is a conversation with the agent: everything a person
  // writes there is addressed to it, with or without an "@".
  const author = members.find((member) => member.id === message.authorId)
  if (channel.group === "private" && author?.kind === "person") {
    for (const id of agents) result.add(id)
  }
  for (const paragraph of message.paragraphs) {
    for (const block of paragraph) {
      if (block.kind !== "text" && block.kind !== "mention") continue
      for (const match of block.text.matchAll(/@([A-Za-z0-9][A-Za-z0-9_-]*)/g)) {
        const id = match[1]
        if (id && agents.has(id)) result.add(id)
      }
    }
  }
  return [...result]
}

/**
 * Deterministic context for a runner: chronological, capped at 20, and
 * without messages from the future per the server's clock. The just-created
 * message is included because the caller passes it in `messages` before
 * building the event.
 */
export function mentionContext(
  messages: Message[],
  channelId: string,
  threadId: string | undefined,
  now = new Date(),
  rootMessageId?: string,
): Message[] {
  const nowMs = now.getTime()
  return messages
    .filter((message) => {
      if (message.channelId !== channelId) return false
      if (threadId && message.threadId !== threadId && message.id !== rootMessageId) return false
      const at = Date.parse(message.at)
      return Number.isFinite(at) && at <= nowMs
    })
    .sort((left, right) => {
      const byDate = Date.parse(left.at) - Date.parse(right.at)
      return byDate || left.id.localeCompare(right.id)
    })
    .slice(-20)
}

/** Recursively extracts text without letting other blocks trigger mentions. */
export function textBlocks(paragraphs: Message["paragraphs"]): string[] {
  return paragraphs.flatMap((paragraph) =>
    paragraph.flatMap((block: MessageBlock) => ((block.kind === "text" || block.kind === "mention") ? [block.text] : [])),
  )
}
