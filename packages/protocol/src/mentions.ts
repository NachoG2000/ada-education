import type { MessageBlock } from "./types.js"

export type MentionIdentity = { id: string; name: string }

/** Resolve legacy plain-text mentions only when a name is unambiguous. */
export function resolveTextMentions(text: string, members: readonly MentionIdentity[]): MessageBlock[] {
  members = [...new Map(members.map((member) => [`${member.id}:${member.name.toLowerCase()}`, member])).values()]
  const counts = new Map<string, number>()
  for (const member of members) counts.set(member.name.toLowerCase(), (counts.get(member.name.toLowerCase()) ?? 0) + 1)
  const candidates = members.filter((member) => member.name && counts.get(member.name.toLowerCase()) === 1).sort((a, b) => b.name.length - a.name.length)
  if (!candidates.length) return [{ kind: "text", text }]
  const names = candidates.map((member) => member.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
  const pattern = new RegExp(`(^|[\\s(])@(${names})(?=$|[\\s.,!?;:)])`, "gi")
  const result: MessageBlock[] = []
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index + match[1].length
    if (start > cursor) result.push({ kind: "text", text: text.slice(cursor, start) })
    const member = candidates.find((item) => item.name.toLowerCase() === match[2].toLowerCase())!
    result.push({ kind: "mention", text: `@${match[2]}`, memberId: member.id })
    cursor = start + match[2].length + 1
  }
  if (cursor < text.length) result.push({ kind: "text", text: text.slice(cursor) })
  return result.length ? result : [{ kind: "text", text }]
}
