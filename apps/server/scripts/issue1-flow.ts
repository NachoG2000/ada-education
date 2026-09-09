/* Throwaway hosted issue-flow check. It uses a fresh SQLite file and a random
   HTTP port, so it cannot mutate the developer's seeded database. */
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { WebSocket } from "ws"
import { browserServerFrameSchema, communityWorkspaceSnapshotSchema, runnerServerFrameSchema } from "@ada/protocol"

const scratch = mkdtempSync(join(tmpdir(), "ada-issue1-flow-"))
process.env.ADA_DB = join(scratch, "issue1.db")
process.env.PORT = "0"

const { startServer } = await import("../src/index.js")
const running = startServer()
const address = running.server.address()
assert(address && typeof address !== "string")
const base = `http://127.0.0.1:${address.port}`

type Json = Record<string, any>
const check = (condition: unknown, message: string): void => { if (!condition) throw new Error(`issue1: ${message}`) }
async function request(path: string, init: RequestInit = {}): Promise<{ status: number; body: Json | Json[] }> {
  const response = await fetch(`${base}${path}`, init)
  const text = await response.text()
  let body: Json | Json[] = {}
  try { body = JSON.parse(text) as Json | Json[] } catch { body = { text } }
  return { status: response.status, body }
}
const auth = (token: string): Record<string, string> => ({ authorization: `Bearer ${token}` })
async function post(path: string, token: string | undefined, body: Json): Promise<Json> {
  const result = await request(path, { method: "POST", headers: { "content-type": "application/json", ...(token ? auth(token) : {}) }, body: JSON.stringify(body) })
  check(result.status < 300, `${path} returned ${result.status}: ${JSON.stringify(result.body)}`)
  return result.body as Json
}
async function expectStatus(path: string, token: string, status: number, init: RequestInit = {}): Promise<Json | Json[]> {
  const result = await request(path, { ...init, headers: { ...(init.headers ?? {}), ...auth(token) } })
  check(result.status === status, `${path} expected ${status}, got ${result.status}: ${JSON.stringify(result.body)}`)
  return result.body
}

function wsFrame(url: string, first: Json): Promise<{ socket: WebSocket; frames: Json[] }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    const frames: Json[] = []
    const timer = setTimeout(() => reject(new Error("WS ready timeout")), 3_000)
    socket.on("message", (raw) => {
      const frame = JSON.parse(raw.toString()) as Json
      frames.push(frame)
      if (frame.type === "ready") { clearTimeout(timer); resolve({ socket, frames }) }
    })
    socket.on("error", reject)
    socket.on("open", () => socket.send(JSON.stringify(first)))
  })
}
async function waitFor(frames: Json[], predicate: (frame: Json) => boolean): Promise<Json> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const found = frames.find(predicate)
    if (found) return found
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error("WS frame timeout")
}

async function expectWsAuthRejected(url: string, first: Json, expectedCode: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(url)
    const timer = setTimeout(() => reject(new Error("WS rejection timeout")), 3_000)
    socket.once("open", () => socket.send(JSON.stringify(first)))
    socket.once("close", (code) => {
      clearTimeout(timer)
      try {
        check(code === expectedCode, `WebSocket expected close ${expectedCode}, got ${code}`)
        resolve()
      } catch (error) {
        reject(error)
      }
    })
    socket.once("error", reject)
  })
}
try {
  const alice = await post("/api/users", undefined, { displayName: "Alice Teacher" })
  const bob = await post("/api/users", undefined, { displayName: "Bob Student" })
  const cara = await post("/api/users", undefined, { displayName: "Cara Student" })
  const dana = await post("/api/users", undefined, { displayName: "Dana Student" })
  const erin = await post("/api/users", undefined, { displayName: "Erin Student" })
  check(typeof alice.token === "string" && alice.token.length >= 40, "user token is high entropy")
  const renamedUser = await expectStatus("/api/users/me", alice.token, 200, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: " Alice   Teacher Updated " }) }) as Json
  check(renamedUser.displayName === "Alice Teacher Updated" && !JSON.stringify(renamedUser).includes(alice.token), "profile update normalizes the global display name without returning credentials")
  await expectStatus("/api/users/me", alice.token, 400, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: "" }) })

  const first = await post("/api/communities", alice.token, { name: "Alpha", term: "2026" })
  const second = await post("/api/communities", cara.token, { name: "Beta", term: "2026" })
  const alpha = first.community.id as string
  const beta = second.community.id as string
  check(alpha !== beta, "communities have distinct ids")
  await expectStatus(`/api/communities/${beta}`, alice.token, 403)

  const invite = await post(`/api/communities/${alpha}/invites`, alice.token, { role: "student", mode: "single-use" })
  const firstRedeem = await post("/api/invites/redeem", bob.token, { code: invite.code })
  const redeemAgain = await post("/api/invites/redeem", bob.token, { code: invite.code })
  check(firstRedeem.consumed === true && redeemAgain.consumed === false && redeemAgain.membership.status === "active", "invite redemption reports consumption and is idempotent for an existing member")
  await expectStatus("/api/invites/redeem", cara.token, 409, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: invite.code }) })
  const reusable = await post(`/api/communities/${alpha}/invites`, alice.token, { role: "student", mode: "reusable", maxUses: 2 })
  await post("/api/invites/redeem", cara.token, { code: reusable.code })
  await post("/api/invites/redeem", dana.token, { code: reusable.code })
  await expectStatus("/api/invites/redeem", erin.token, 409, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: reusable.code }) })
  const revocable = await post(`/api/communities/${alpha}/invites`, alice.token, { role: "student", mode: "reusable", maxUses: 5 })
  const inviteList = await expectStatus(`/api/communities/${alpha}/invites`, alice.token, 200) as Json[]
  check(inviteList.some((item) => item.id === revocable.invite.id && item.mode === "reusable") && !JSON.stringify(inviteList).includes(revocable.code) && !JSON.stringify(inviteList).includes("codeDigest"), "invite listing returns active safe metadata only")
  await expectStatus(`/api/communities/${alpha}/invites`, bob.token, 403)
  await expectStatus(`/api/communities/${alpha}/invites/${revocable.invite.id}`, cara.token, 403, { method: "DELETE" })
  const revoked = await expectStatus(`/api/communities/${alpha}/invites/${revocable.invite.id}`, alice.token, 200, { method: "DELETE" }) as Json
  check(typeof revoked.revokedAt === "string" && !("code" in revoked), "invite revocation returns safe timestamped metadata")
  await expectStatus("/api/invites/redeem", erin.token, 409, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: revocable.code }) })
  const afterRevoke = await expectStatus(`/api/communities/${alpha}/invites`, alice.token, 200) as Json[]
  check(!afterRevoke.some((item) => item.id === revocable.invite.id), "revoked invites leave the active list")
  const betaInvite = await post(`/api/communities/${beta}/invites`, cara.token, { role: "student", mode: "reusable" })
  await post("/api/invites/redeem", alice.token, { code: betaInvite.code })
  await expectStatus(`/api/communities/${beta}/invites`, alice.token, 403)
  const aliceSession = await request("/api/session", { headers: auth(alice.token) })
  check((aliceSession.body as Json).communities.some((item: Json) => item.id === beta && item.membership.role === "student"), "one global user can carry independent per-community roles")

  const channel = await post(`/api/communities/${alpha}/channels`, alice.token, { name: "Questions", kind: "channel", visibility: "public" })
  const channelId = channel.id as string
  const betaChannel = await post(`/api/communities/${beta}/channels`, cara.token, { name: "Beta only", kind: "channel", visibility: "public" })
  const betaMessage = await post(`/api/communities/${beta}/channels/${betaChannel.id}/messages`, cara.token, { paragraphs: [[{ kind: "text", text: "beta private state" }]] })
  await expectStatus(`/api/communities/${beta}/channels/${channelId}`, cara.token, 404, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "cross-tenant rename" }) })
  await expectStatus(`/api/communities/${alpha}/messages/${betaMessage.id}`, alice.token, 404, { method: "DELETE" })
  const browse = await request(`/api/communities/${alpha}/channels/browse`, { headers: auth(alice.token) })
  check(Array.isArray(browse.body), `browse returns a list: ${JSON.stringify(browse.body)}`)
  check((browse.body as Json[]).some((item) => item.id === channelId && !("memberIds" in item)), "browse exposes metadata only")
  await expectStatus(`/api/communities/${alpha}/channels/${channelId}/messages`, bob.token, 404)
  await post(`/api/communities/${alpha}/channels/${channelId}/join`, bob.token, {})
  await expectStatus(`/api/communities/${alpha}/members/${bob.user.id}`, dana.token, 403, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "teacher" }) })
  const promoted = await expectStatus(`/api/communities/${alpha}/members/${bob.user.id}`, alice.token, 200, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "teacher" }) }) as Json
  check(promoted.role === "teacher", "teachers can promote an active member")
  const demoted = await expectStatus(`/api/communities/${alpha}/members/${bob.user.id}`, alice.token, 200, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "student" }) }) as Json
  check(demoted.role === "student", "teachers can demote another teacher while one remains")
  await expectStatus(`/api/communities/${alpha}/members/${alice.user.id}`, alice.token, 409, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "student" }) })
  const agentResult = await post(`/api/communities/${alpha}/agents`, alice.token, { name: "Tutor Alpha", instructions: "Help", runtime: "pi", model: "test", channelIds: [channelId] })
  const agent = agentResult.agent as Json
  const runnerToken = agentResult.enrollment.runnerToken as string
  check(!("runnerToken" in agent) && runnerToken.length >= 40, "agent projection omits its one-time runner token")
  check(agentResult.enrollment.setupCommand.includes("$HOME/.ada/agents/") && agentResult.enrollment.setupCommand.includes(runnerToken), "the one-time setup command uses a portable user-local agent folder")
  const dm = await post(`/api/communities/${alpha}/dms`, bob.token, { agentId: agent.id })
  const dmId = dm.channel.id as string
  const sameDm = await post(`/api/communities/${alpha}/dms`, bob.token, { agentId: agent.id })
  check(sameDm.channel.id === dmId, "a user-agent DM is unique and idempotent")
  await expectStatus(`/api/communities/${alpha}/channels/${dmId}/messages`, cara.token, 404)
  const workspace = await request(`/api/communities/${alpha}`, { headers: auth(alice.token) })
  check(workspace.status === 200 && communityWorkspaceSnapshotSchema.safeParse(workspace.body).success, "workspace snapshot satisfies the shared hosted schema")
  check((workspace.body as Json).channels.some((item: Json) => item.id === dmId), "teachers can inspect a private user-agent DM")

  const message = await post(`/api/communities/${alpha}/channels/${channelId}/messages`, bob.token, { paragraphs: [[{ kind: "text", text: "hello" }]] })
  const messageId = message.id as string
  const edited = await expectStatus(`/api/communities/${alpha}/messages/${messageId}`, bob.token, 200, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ paragraphs: [[{ kind: "text", text: "hello, edited" }]] }) }) as Json
  check(typeof edited.editedAt === "string" && edited.paragraphs[0][0].text === "hello, edited", "authors can edit their message")
  await expectStatus(`/api/communities/${alpha}/messages/${messageId}`, cara.token, 404, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ paragraphs: [[{ kind: "text", text: "not mine" }]] }) })
  const tombstone = await expectStatus(`/api/communities/${alpha}/messages/${messageId}`, alice.token, 200, { method: "DELETE" }) as Json
  const repeatedTombstone = await expectStatus(`/api/communities/${alpha}/messages/${messageId}`, alice.token, 200, { method: "DELETE" }) as Json
  check(tombstone.status === "deleted" && !JSON.stringify(tombstone).includes("hello, edited") && repeatedTombstone.deletedAt === tombstone.deletedAt, "moderation creates an idempotent content-free tombstone")

  const browser = await wsFrame(`${base.replace("http", "ws")}/ws`, { type: "auth", token: bob.token, communityId: alpha })
  check(browser.frames[0]?.payload?.communityId === alpha, "browser ready is bound to community")
  const outsider = await wsFrame(`${base.replace("http", "ws")}/ws`, { type: "auth", token: cara.token, communityId: alpha })
  check(browserServerFrameSchema.safeParse(browser.frames[0]).success && browserServerFrameSchema.safeParse(outsider.frames[0]).success, "browser ready frames satisfy the shared protocol")
  await expectStatus(`/api/communities/${alpha}/members/${bob.user.id}`, alice.token, 200, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "teacher" }) })
  await new Promise((resolve) => setTimeout(resolve, 40))
  check(browser.frames.some((frame) => frame.type === "event" && frame.payload?.event?.type === "membership.updated" && frame.payload.event.payload.membership.userId === bob.user.id), "membership role changes use the viewer-scoped event envelope")
  await expectStatus(`/api/communities/${alpha}/members/${bob.user.id}`, alice.token, 200, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "student" }) })
  const privateMessage = await post(`/api/communities/${alpha}/channels/${dmId}/messages`, bob.token, { paragraphs: [[{ kind: "text", text: "private" }]] })
  await post(`/api/communities/${alpha}/threads`, bob.token, { channelId: dmId, rootMessageId: privateMessage.id })
  await new Promise((resolve) => setTimeout(resolve, 50))
  check(!outsider.frames.some((frame) => frame.type === "event" && ["message.created", "thread.created"].includes(frame.payload?.event?.type) && [privateMessage.id, dmId].includes(frame.payload?.event?.payload?.message?.id ?? frame.payload?.event?.payload?.thread?.channelId)), "DM messages and threads are not observed by a nonparticipant socket")
  check(browser.frames.some((frame) => frame.type === "event" && frame.payload?.event?.type === "thread.created" && frame.payload.event.payload.thread.channelId === dmId), "a DM participant receives its private thread event")
  await new Promise<void>((resolve) => {
    const querySocket = new WebSocket(`${base.replace("http", "ws")}/ws?token=${encodeURIComponent(bob.token)}`)
    querySocket.once("close", (code) => { check(code === 4401, "hosted query-token WebSocket auth is rejected"); resolve() })
    querySocket.once("error", () => resolve())
  })
  await new Promise<void>((resolve) => {
    const unauthenticated = new WebSocket(`${base.replace("http", "ws")}/ws`)
    unauthenticated.once("open", () => unauthenticated.send(JSON.stringify({ type: "typing.set", payload: { channelId, typing: true } })))
    unauthenticated.once("close", (code) => { check(code === 4401, "hosted sockets reject non-auth first frames"); resolve() })
    unauthenticated.once("error", () => resolve())
  })
  const runner = await wsFrame(`${base.replace("http", "ws")}/ws/runner`, { type: "auth", token: runnerToken })
  runner.socket.on("message", (raw) => {
    const frame = JSON.parse(raw.toString()) as Json
    if (frame.type === "memory.work" && frame.payload.view.scope.kind !== "channel") runner.socket.send(JSON.stringify({ type: "memory.result", ref: `context-${frame.payload.view.runId}`, payload: { runId: frame.payload.view.runId, proposals: [], answer: "Private fixture reply" } }))
  })
  check(runner.frames[0]?.payload?.agent?.communityId === alpha, "runner ready is bound to agent community")
  const runnerReadyCheck = runnerServerFrameSchema.safeParse(runner.frames[0])
  check(runnerReadyCheck.success, `runner ready frame satisfies the shared protocol: ${runnerReadyCheck.success ? "" : JSON.stringify(runnerReadyCheck.error.flatten())}`)
  await new Promise((resolve) => setTimeout(resolve, 40))
  const onlineWorkspace = await request(`/api/communities/${alpha}`, { headers: auth(alice.token) })
  check((onlineWorkspace.body as Json).agents.some((item: Json) => item.id === agent.id && item.presence === "online"), "runner presence is authoritative in REST snapshots")
  await expectStatus(`/api/communities/${alpha}/agents/${agent.id}`, alice.token, 200, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ instructions: "Help carefully" }) })
  await new Promise((resolve) => setTimeout(resolve, 40))
  const outsiderAgentEvent = outsider.frames.find((frame) => frame.type === "event" && frame.payload?.event?.type === "agent.updated")
  check(outsiderAgentEvent?.payload?.event?.payload?.agent?.channelIds?.length === 0, "agent events hide unjoined channel assignments per viewer")
  const beforeFalseMention = runner.frames.length
  await post(`/api/communities/${alpha}/channels/${channelId}/messages`, bob.token, { paragraphs: [[{ kind: "text", text: "@Tutor Alphabeta is not this agent" }]] })
  await new Promise((resolve) => setTimeout(resolve, 50))
  check(!runner.frames.slice(beforeFalseMention).some((frame) => frame.type === "memory.work" && frame.payload.view.scope.kind === "channel"), "mention matching requires a complete agent name")
  await post(`/api/communities/${alpha}/channels/${channelId}/messages`, bob.token, { paragraphs: [[{ kind: "text", text: "@Tutor Alpha please help" }]] })
  const work = await waitFor(runner.frames, (frame) => frame.type === "memory.work" && frame.payload.view.scope.kind === "channel")
  check(runnerServerFrameSchema.safeParse(work).success, "governed work satisfies the shared contract")
  check(work.payload.requester.id === bob.user.id && work.payload.view.sources.every((item: Json) => item.communityId === alpha && item.channelId === channelId), "runner work identifies the author and contains only channel-scoped sources")
  runner.socket.send(JSON.stringify({ type: "message.create", ref: "wrong-scope", payload: { communityId: beta, agentId: agent.id, channelId, paragraphs: [[{ kind: "text", text: "must fail" }]] } }))
  const wrongScopeAck = await waitFor(runner.frames, (frame) => frame.type === "ack" && frame.ref === "wrong-scope")
  check(wrongScopeAck.ok === false, "runner writes outside its bound community receive a correlated rejection")
  runner.socket.send(JSON.stringify({ type: "memory.result", ref: "runner-message", payload: { runId: work.payload.view.runId, answer: "agent reply", proposals: [] } }))
  const messageAck = await waitFor(runner.frames, (frame) => frame.type === "ack" && frame.ref === "runner-message")
  check(messageAck.ok === true && typeof messageAck.messageId === "string", "agent replies are persisted with a correlated ack")
  await post(`/api/communities/${alpha}/threads`, alice.token, { channelId, rootMessageId: messageAck.messageId })
  runner.socket.send(JSON.stringify({ type: "card.publish", ref: "cross-source", payload: { communityId: alpha, agentId: agent.id, channelId, path: "cards/rejected.md", title: "Rejected", type: "answer", body: "must fail", sourceMessageIds: [betaMessage.id] } }))
  const crossSourceAck = await waitFor(runner.frames, (frame) => frame.type === "ack" && frame.ref === "cross-source")
  check(crossSourceAck.ok === false, "card sources cannot cross community boundaries")
  runner.socket.send(JSON.stringify({ type: "card.publish", ref: "runner-card", payload: { communityId: alpha, agentId: agent.id, channelId, path: "cards/answer.md", title: "Answer", type: "answer", body: "retained card", sourceMessageIds: [messageAck.messageId] } }))
  const cardAck = await waitFor(runner.frames, (frame) => frame.type === "ack" && frame.ref === "runner-card")
  check(cardAck.ok === false, "legacy card publication cannot bypass governed execution and admission")
  check(browser.frames.some((frame) => frame.type === "event" && frame.payload?.event?.type === "message.created"), "agent reply is scoped to browser events")
  const renamed = await expectStatus(`/api/communities/${alpha}/channels/${channelId}`, alice.token, 200, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Questions renamed" }) }) as Json
  check(renamed.name === "Questions renamed", "teachers can rename channels")
  const rotated = await post(`/api/communities/${alpha}/agents/${agent.id}/enrollment`, alice.token, {})
  await new Promise((resolve) => setTimeout(resolve, 40))
  check(runner.socket.readyState === WebSocket.CLOSED || runner.socket.readyState === WebSocket.CLOSING, "agent enrollment rotation revokes the old runner socket")
  await expectWsAuthRejected(`${base.replace("http", "ws")}/ws/runner`, { type: "auth", token: runnerToken }, 4403)
  const replacement = await wsFrame(`${base.replace("http", "ws")}/ws/runner`, { type: "auth", token: rotated.enrollment.runnerToken })
  replacement.socket.close()
  await new Promise((resolve) => setTimeout(resolve, 50))
  const offlineWorkspace = await request(`/api/communities/${alpha}`, { headers: auth(alice.token) })
  check((offlineWorkspace.body as Json).agents.some((item: Json) => item.id === agent.id && item.presence === "offline"), "runner disconnect becomes offline in REST snapshots")
  const replacementForDelete = await wsFrame(`${base.replace("http", "ws")}/ws/runner`, { type: "auth", token: rotated.enrollment.runnerToken })
  const archived = await expectStatus(`/api/communities/${alpha}/channels/${channelId}`, alice.token, 200, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "archived" }) }) as Json
  check(archived.status === "archived", "teachers can archive channels")
  await expectStatus(`/api/communities/${alpha}/channels/${channelId}/messages`, bob.token, 409, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paragraphs: [[{ kind: "text", text: "too late" }]] }) })
  await expectStatus(`/api/communities/${alpha}/agents/${agent.id}`, alice.token, 200)
  await expectStatus(`/api/communities/${alpha}/agents/${agent.id}`, alice.token, 200, { method: "DELETE" })
  await new Promise((resolve) => setTimeout(resolve, 40))
  check(replacementForDelete.socket.readyState === WebSocket.CLOSED || replacementForDelete.socket.readyState === WebSocket.CLOSING, "agent deletion revokes the active runner socket")
  await expectWsAuthRejected(`${base.replace("http", "ws")}/ws/runner`, { type: "auth", token: rotated.enrollment.runnerToken }, 4403)
  const deletedAgent = await expectStatus(`/api/communities/${alpha}/agents/${agent.id}`, alice.token, 200)
  check((deletedAgent as Json).status === "deleted", "agent deletion is a soft lifecycle transition")
  const db = new DatabaseSync(process.env.ADA_DB as string)
  check(Number((db.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('tenant_users') WHERE name = 'token'").get() as Json).n) === 0, "tenant users do not persist raw bearer token columns")
  check(Number((db.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('tenant_agents') WHERE name = 'runner_token'").get() as Json).n) === 0, "tenant agents do not persist raw runner token columns")
  check(Number((db.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('tenant_invites') WHERE name IN ('mode', 'revoked_at')").get() as Json).n) === 2, "invite mode and revocation are persisted by the current migration")
  const storedUserDigest = (db.prepare("SELECT token_digest FROM tenant_users WHERE id = ?").get(alice.user.id) as Json).token_digest
  const storedRunnerDigest = (db.prepare("SELECT runner_token_digest FROM tenant_agents WHERE id = ?").get(agent.id) as Json).runner_token_digest
  check(typeof storedUserDigest === "string" && storedUserDigest.length === 64 && storedUserDigest !== alice.token, "the database stores only the user token digest")
  check(typeof storedRunnerDigest === "string" && storedRunnerDigest.length === 64 && storedRunnerDigest !== runnerToken && storedRunnerDigest !== rotated.enrollment.runnerToken, "the database stores only the current runner token digest")
  db.close()
  check(browser.frames.some((frame) => frame.type === "event" && frame.payload?.event?.type === "runner.presence"), "presence is scoped and delivered through hosted event envelope")

  await expectStatus(`/api/communities/${alpha}/membership`, alice.token, 409, { method: "DELETE" })
  await expectStatus(`/api/communities/${alpha}/membership`, dana.token, 200, { method: "DELETE" })
  const danaSession = await request("/api/session", { headers: auth(dana.token) })
  check(!(danaSession.body as Json).communities.some((item: Json) => item.id === alpha), "a member can leave one community without losing the global user")
  await expectStatus(`/api/communities/${alpha}/members/${bob.user.id}`, alice.token, 200, { method: "DELETE" })
  await new Promise((resolve) => setTimeout(resolve, 40))
  check(browser.socket.readyState === WebSocket.CLOSED || browser.socket.readyState === WebSocket.CLOSING, "removed member socket is revoked")
  browser.socket.close()
  outsider.socket.close()
  console.log("Issue #1 hosted flow OK: tenants, roles, invites, channels/DMs, agents, messages, WS and revocation")
} finally {
  await running.close()
  rmSync(scratch, { recursive: true, force: true })
}
