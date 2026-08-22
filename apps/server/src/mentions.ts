import type { Agent, Channel, Member, Message, MessageBlock } from "@ada/protocol"

/**
 * Busca handles en los bloques de texto, nunca en citas ni en código.
 * Los ids de Ada son deliberadamente simples, pero aceptamos guiones y
 * guiones bajos para que el contrato no dependa del nombre visible.
 */
export function mentionedAgentIds(message: Message, channel: Channel, members: Member[]): string[] {
  const memberIds = new Set(channel.memberIds)
  const agents = new Set(
    members
      .filter((member): member is Agent => member.kind === "agent" && memberIds.has(member.id))
      .map((member) => member.id),
  )
  const result = new Set<string>()
  for (const paragraph of message.paragraphs) {
    for (const block of paragraph) {
      if (block.kind !== "text") continue
      for (const match of block.text.matchAll(/@([A-Za-z0-9][A-Za-z0-9_-]*)/g)) {
        const id = match[1]
        if (id && agents.has(id)) result.add(id)
      }
    }
  }
  return [...result]
}

/**
 * Contexto determinista para un runner: cronológico, acotado a 20 y sin
 * mensajes del futuro según el reloj del server. El mensaje recién creado se
 * incluye porque el caller lo pasa en `messages` antes de armar el evento.
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

/** Extrae texto recursivamente sin que otros bloques puedan disparar menciones. */
export function textBlocks(paragraphs: Message["paragraphs"]): string[] {
  return paragraphs.flatMap((paragraph) =>
    paragraph.flatMap((block: MessageBlock) => (block.kind === "text" ? [block.text] : [])),
  )
}
