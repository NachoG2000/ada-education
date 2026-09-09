/** Real REST authorization, version conflict, private work and inbox persistence checks. */
import assert from "node:assert/strict"
import { openDatabase } from "../src/db.js"
import { createApi } from "../src/api.js"
const db = openDatabase(":memory:")
const app = createApi(db)
async function request(path: string, token?: string, body?: unknown, method = body ? "POST" : "GET", expected = body ? 201 : 200): Promise<any> {
  const response = await app.request(path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  assert.equal(response.status, expected, `${method} ${path}: ${await response.clone().text()}`)
  return response.json()
}
try {
  const teacher = await request("/api/users", undefined, { displayName: "Teacher" })
  const student = await request("/api/users", undefined, { displayName: "Student" })
  const peer = await request("/api/users", undefined, { displayName: "Peer" })
  const outsider = await request("/api/users", undefined, { displayName: "Outsider" })
  const community = await request("/api/communities", teacher.token, { name: "Education", term: "Test", starterAgents: true })
  const base = `/api/communities/${community.community.id}`
  for (const user of [student, peer]) {
    const invite = await request(`${base}/invites`, teacher.token, { role: "student", mode: "single-use" })
    await request("/api/invites/redeem", user.token, { code: invite.code }, "POST", 200)
  }
  const channel = await request(`${base}/channels`, teacher.token, { name: "Recursion", kind: "channel", visibility: "public", memberIds: [student.user.id, peer.user.id], agentIds: [] })
  const path = `${base}/channels/${channel.id}/artifacts`
  const content = { title: "Tree traversal", kind: "assignment", body: "Explain a traversal", prompts: [{ id: "q1", text: "What is the base case?" }] }
  await request(path, student.token, { content }, "POST", 403)
  const a = await request(path, teacher.token, { content })
  const item = `${base}/artifacts/${a.id}`
  assert.equal((await request(path, student.token)).length, 1)
  await request(item, outsider.token, undefined, "GET", 403)
  const otherCommunity = await request("/api/communities", teacher.token, { name: "Other", term: "Test" })
  await request(`/api/communities/${otherCommunity.community.id}/artifacts/${a.id}`, teacher.token, undefined, "GET", 404)
  const work = await request(`${item}/work`, student.token, { answers: { q1: "Private initial answer" }, version: 0, artifactVersion: 1 }, "PUT", 200)
  assert.deepEqual((await request(`${item}/work`, teacher.token)).answers, {}, "teachers cannot fetch student drafts")
  assert.deepEqual((await request(`${item}/work`, peer.token)).answers, {})
  await request(`${item}/work`, student.token, { answers: { q1: "Stale overwrite" }, version: 0, artifactVersion: 1 }, "PUT", 409)
  await request(`${item}/submissions`, student.token, { version: work.version })
  await request(`${item}/submissions`, student.token, { version: work.version })
  assert.equal((await request(`${item}/submissions`, teacher.token)).length, 1, "idempotent submit")
  await request(`${item}/work`, student.token, { answers: { q1: "New private draft" }, version: 1, artifactVersion: 1 }, "PUT", 200)
  const submissions = await request(`${item}/submissions`, teacher.token)
  assert.equal(submissions[0].answers.q1, "Private initial answer", "submitted copy cannot expose later edits")
  assert.equal((await request(`${item}/submissions`, peer.token)).length, 0)
  await request(`${item}/submissions/${submissions[0].id}`, peer.token, { feedback: "forged" }, "PUT", 403)
  await request(`${item}/submissions/${submissions[0].id}`, teacher.token, { feedback: "Consider the empty tree." }, "PUT", 200)
  assert.equal((await request(`${item}/submissions`, student.token))[0].feedback, "Consider the empty tree.")
  const updated = await request(item, teacher.token, { content: { ...content, title: "Updated traversal" }, version: 1 }, "PUT", 200)
  assert.equal(updated.version, 2)
  await request(item, teacher.token, { content, version: 1 }, "PUT", 409)
  const versions = await request(`${item}/versions`, student.token)
  assert.equal(versions.length, 2)
  assert.equal(versions[1].content.title, "Tree traversal")
  await request(`${item}/submissions`, student.token, { version: 2 }, "POST", 409)
  await request(`${item}/work`, student.token, { answers: { invalid: "oops" }, version: 2, artifactVersion: 2 }, "PUT", 400)
  const agents = await request(`${base}/agents`, teacher.token)
  const dm = await request(`${base}/dms`, student.token, { agentId: agents[0].id })
  const privateArtifact = await request(`${base}/channels/${dm.channel.id}/artifacts`, student.token, { content: { title: "My recap", kind: "explanation" } })
  const privatePath = `${base}/artifacts/${privateArtifact.id}`
  await request(privatePath, teacher.token)
  await request(privatePath, peer.token, undefined, "GET", 404)
  await request(privatePath, teacher.token, { content, version: 1 }, "PUT", 403)
  const message = await request(`${base}/channels/${channel.id}/messages`, teacher.token, { paragraphs: [[{ kind: "text", text: "Hello" }]] })
  await request(`${base}/inbox/reads`, student.token, { messageId: message.id, read: true }, "PUT", 200)
  assert.deepEqual(await request(`${base}/inbox/reads`, student.token), [message.id])
  assert.deepEqual(await request(`${base}/inbox/reads`, peer.token), [])
  await request(`${base}/inbox/reads`, student.token, { messageId: message.id, read: false }, "PUT", 200)
  assert.deepEqual(await request(`${base}/inbox/reads`, student.token), [])
  const privateMessage = await request(`${base}/channels/${dm.channel.id}/messages`, student.token, { paragraphs: [[{ kind: "text", text: "Private question" }]] })
  await request(`${base}/inbox/reads`, peer.token, { messageId: privateMessage.id, read: true }, "PUT", 404)
  await request(`${base}/channels/${channel.id}`, teacher.token, { status: "archived" }, "PATCH", 200)
  await request(item, teacher.token, { content, version: 2 }, "PUT", 409)
  await request(`${item}/work`, student.token, { answers: {}, version: 2, artifactVersion: 2 }, "PUT", 409)
  await request(privatePath, student.token, undefined, "DELETE", 200)
  await request(privatePath, student.token, undefined, "GET", 404)
  console.log("Education OK: tenants, roles, versions, conflicts, private drafts, immutable submission copies, feedback, DMs, read state, archives and deletion.")
} finally { db.close() }
