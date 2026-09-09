/** Mention permissions and membership/message atomicity through the real REST API. */
import assert from "node:assert/strict"
import { openDatabase } from "../src/db.js"
import { createApi } from "../src/api.js"
import { tenantWorkAgentsForMessage } from "../src/tenant.js"
import { resolveTextMentions, scopedMessageSchema, scopedServerEventSchema } from "@ada/protocol"
const database = openDatabase(":memory:")
const events: string[] = []
const work: string[][] = []
const app = createApi(database, {
  onTenantEvent: (event) => { scopedServerEventSchema.parse({ ...event, eventId: "test-event", occurredAt: new Date().toISOString() }); events.push(event.type) },
  onTenantWork: (message) => work.push(tenantWorkAgentsForMessage(database, message).map((agent) => agent.id)),
})
async function request(path: string, token?: string, body?: unknown, method = body ? "POST" : "GET", expected = body ? 201 : 200): Promise<any> {
  const response = await app.request(path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  assert.equal(response.status, expected, `${method} ${path}: ${await response.clone().text()}`)
  return response.json()
}
try {
  const teacher = await request("/api/users", undefined, { displayName: "Teacher" })
  const student = await request("/api/users", undefined, { displayName: "Student" })
  const community = await request("/api/communities", teacher.token, { name: "Mentions", term: "Test", starterAgents: true })
  const base = `/api/communities/${community.community.id}`
  const invite = await request(`${base}/invites`, teacher.token, { role: "student", mode: "single-use" })
  await request("/api/invites/redeem", student.token, { code: invite.code }, "POST", 200)
  const agents = await request(`${base}/agents`, teacher.token)
  const agent = agents.find((item: any) => item.systemRole !== "ada"), other = agents.find((item: any) => item.systemRole === "ada")
  const channel = await request(`${base}/channels`, teacher.token, { name: "Questions", kind: "channel", visibility: "public", memberIds: [student.user.id], agentIds: [] })
  const endpoint = `${base}/channels/${channel.id}/messages`
  const mention = (id: string, text = "@forged label") => ({ kind: "mention", memberId: id, text })
  const payload = { paragraphs: [[mention(agent.id), { kind: "text", text: " hello" }]], clientId: "one" }
  await request(endpoint, student.token, payload, "POST", 403)
  assert.equal((await request(endpoint, teacher.token)).length, 0)
  events.length = 0
  const sent = await request(endpoint, teacher.token, payload)
  scopedMessageSchema.parse(sent)
  assert.equal(sent.paragraphs[0][0].text, `@${agent.name}`, "server canonicalizes labels")
  assert.deepEqual(work.at(-1), [agent.id], "newly added agent receives this same message")
  assert(events.indexOf("channel.updated") < events.indexOf("message.created"))
  assert.equal((await request(`${base}/channels`, teacher.token)).find((item: any) => item.id === channel.id).agentIds.filter((id: string) => id === agent.id).length, 1)
  const again = await request(endpoint, teacher.token, payload)
  assert.equal(again.id, sent.id, "retry returns the existing message")
  await request(endpoint, student.token, { paragraphs: [[mention(agent.id)]] })
  assert.deepEqual(work.at(-1), [agent.id], "student can address an existing channel agent")
  await request(`${base}/agents/${agent.id}`, teacher.token, { name: "Renamed tutor" }, "PATCH", 200)
  const renamed = await request(endpoint, teacher.token, { paragraphs: [[mention(agent.id, `@${agent.name}`)]] })
  assert.equal(renamed.paragraphs[0][0].text, "@Renamed tutor")
  assert.deepEqual(work.at(-1), [agent.id], "identity survives rename")
  const before = (await request(endpoint, teacher.token)).length
  await request(endpoint, teacher.token, { paragraphs: [[mention(other.id), mention("foreign-agent")]] }, "POST", 400)
  assert.equal((await request(endpoint, teacher.token)).length, before, "invalid mention rolls back message")
  assert(!(await request(`${base}/channels`, teacher.token)).find((item: any) => item.id === channel.id).agentIds.includes(other.id), "invalid mention rolls back all additions")
  const dm = await request(`${base}/dms`, teacher.token, { agentId: agent.id })
  await request(`${base}/channels/${dm.channel.id}/messages`, teacher.token, { paragraphs: [[mention(other.id)]] }, "POST", 403)
  await request(endpoint, teacher.token, { paragraphs: [[{ kind: "code", text: `@${other.name}` }]] })
  assert.deepEqual(work.at(-1), [], "code is not a mention")
  await request(`${base}/messages/${sent.id}`, teacher.token, { paragraphs: [[mention(other.id)]] }, "PATCH", 200)
  assert(!(await request(`${base}/channels`, teacher.token)).find((item: any) => item.id === channel.id).agentIds.includes(other.id), "editing does not recruit agents")
  const thread = await request(`${base}/threads`, teacher.token, { channelId: channel.id, rootMessageId: sent.id }, "POST", 200)
  await request(endpoint, teacher.token, { paragraphs: [[{ kind: "text", text: `@${other.name}, help` }]], threadId: thread.id })
  assert.deepEqual(work.at(-1), [other.id], "plain-text and thread mentions recruit on send")
  await request(`${base}/channels/${channel.id}`, teacher.token, { status: "archived" }, "PATCH", 200)
  await request(endpoint, teacher.token, payload, "POST", 409)
  const identities = [{ id: "a", name: "Course tutor" }, { id: "b", name: "Course" }]
  assert.equal(resolveTextMentions("@Course tutor, hello", identities)[0].kind, "mention")
  assert.equal(resolveTextMentions("mail@Course", identities)[0].kind, "text")
  assert.equal(resolveTextMentions("@Course", [...identities, { id: "c", name: "Course" }])[0].kind, "text")
  console.log("Mentions OK: permissions, stable IDs, canonical labels, atomic join/send, retries, DMs, threads, code, edits, archives, and ambiguous names.")
} finally { database.close() }
