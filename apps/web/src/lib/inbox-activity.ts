import { resolveTextMentions, type Community, type Message } from "@ada/protocol"

/** Select attention for this viewer from an already authorized workspace projection. */
export function inboxActivity(community: Pick<Community, "messages" | "channels" | "members" | "threads">, userId: string): Message[] {
  const channels = new Map(community.channels.map((c) => [c.id, c]))
  const threads = new Map(community.threads.map((t) => [t.id, t]))
  const authored = community.messages.filter((m) => m.authorId === userId && !m.deletedAt)
  return community.messages.filter((m) => {
    if (m.deletedAt || m.authorId === userId) return false
    const channel = channels.get(m.channelId)
    if (!channel || !channel.memberIds.includes(userId) || channel.kind === "dm" && channel.ownerId !== userId) return false
    if (channel.kind === "dm") return true
    if (m.paragraphs.flat().flatMap((b) => b.kind === "text" ? resolveTextMentions(b.text, community.members) : [b]).some((b) => b.kind === "mention" && b.memberId === userId)) return true
    const thread = m.threadId ? threads.get(m.threadId) : undefined
    return Boolean(thread && m.id !== thread.rootMessageId && authored.some((p) => p.at <= m.at && (p.id === thread.rootMessageId || p.threadId === thread.id)))
  }).sort((a, b) => b.at.localeCompare(a.at))
}
