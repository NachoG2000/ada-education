import { messageSchema, type Message } from "@ada/protocol"
const key = (userId: string, communityId: string, dmId: string) => `ada:message-context:${userId}:${communityId}:${dmId}`
export function readAdaContext(userId: string, communityId: string, dmId: string): Message | undefined {
  try { const value = sessionStorage.getItem(key(userId, communityId, dmId)); return value ? messageSchema.parse(JSON.parse(value)) : undefined } catch { return undefined }
}
export function saveAdaContext(userId: string, communityId: string, dmId: string, message?: Message) {
  try {
    if (message) sessionStorage.setItem(key(userId, communityId, dmId), JSON.stringify(message))
    else sessionStorage.removeItem(key(userId, communityId, dmId))
  } catch { /* The mounted panel still retains context when storage is unavailable. */ }
}
