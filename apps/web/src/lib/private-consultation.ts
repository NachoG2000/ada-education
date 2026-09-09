import { z } from "zod"
const schema = z.object({ artifactId: z.string(), channelId: z.string(), title: z.string(), text: z.string() })
export type PrivateConsultation = z.infer<typeof schema>
const key = (userId: string, communityId: string, dmId: string) => `ada:consultation:${userId}:${communityId}:${dmId}`
export function readConsultation(userId: string, communityId: string, dmId: string): PrivateConsultation | undefined {
  try { const value = sessionStorage.getItem(key(userId, communityId, dmId)); return value ? schema.parse(JSON.parse(value)) : undefined } catch { return undefined }
}
export function stageConsultation(userId: string, communityId: string, dmId: string, value: PrivateConsultation) {
  sessionStorage.setItem(key(userId, communityId, dmId), JSON.stringify(value))
  window.dispatchEvent(new Event("ada:consultation"))
}
export function clearConsultation(userId: string, communityId: string, dmId: string) { sessionStorage.removeItem(key(userId, communityId, dmId)) }
