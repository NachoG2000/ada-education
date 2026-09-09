import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openDatabase } from "../src/db.js"
import { createApi } from "../src/api.js"
import { CourseMemory } from "../src/memory.js"
import { MemoryFiles, parseOkf, serializeOkf } from "../src/memory-files.js"
import { claimMemoryWork, completeMemoryWork, queueMemoryMessage, queueMemorySource, releaseMemoryWork } from "../src/memory-jobs.js"
import { memorySnapshotSchema, type MemoryProposal, type MemorySource } from "@ada/protocol"

const directory = mkdtempSync(join(tmpdir(), "ada-memory-check-"))
const database = openDatabase(join(directory, "test.db"))
const app = createApi(database)
async function request(path: string, token?: string, body?: unknown, method = body ? "POST" : "GET", expected = body ? 201 : 200): Promise<any> {
  const response = await app.request(path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  assert.equal(response.status, expected, `${method} ${path}: ${await response.clone().text()}`)
  return response.json()
}
const evidence = (source: MemorySource, quote: string) => [{ sourceId: source.id, version: source.version, quote }]
try {
  const teacher = await request("/api/users", undefined, { displayName: "Maya" })
  const student = await request("/api/users", undefined, { displayName: "Alex" })
  const other = await request("/api/users", undefined, { displayName: "Sam" })
  const created = await request("/api/communities", teacher.token, { name: "Algorithms", term: "Autumn", starterAgents: true })
  const communityId = created.community.id
  const memory = new CourseMemory(database, communityId)
  assert.equal(memory.files.catalog().version, 1, "every new community initializes canonical memory")
  const base = `/api/communities/${communityId}`
  for (const account of [student, other]) {
    const invite = await request(`${base}/invites`, teacher.token, { role: "student", mode: "single-use" })
    await request("/api/invites/redeem", account.token, { code: invite.code }, "POST", 200)
  }
  const agents = await request(`${base}/agents`, teacher.token)
  const ada = agents.find((agent: any) => agent.systemRole === "ada")
  const channel = await request(`${base}/channels`, teacher.token, { name: "Recursion", kind: "channel", visibility: "public", memberIds: [student.user.id, other.user.id], agentIds: [ada.id] })
  const actor = memory.actor(teacher.user.id)
  const raw = Buffer.from("# Recursion\r\nA base case stops recursive calls.\r\n")
  const source = memory.ingest(teacher.user.id, { title: "Recursion notes", filename: "notes.md", mediaType: "text/markdown", raw, text: raw.toString(), scope: { kind: "course" } })
  assert.deepEqual(memory.files.raw(source), raw)
  const conceptInput: MemoryProposal = { title: "Base case", kind: "concept", body: "A recursive function needs a stopping condition.", scope: { kind: "course" }, concept: "base-case", evidence: evidence(source, "A base case stops recursive calls."), relations: [] }
  const concept = memory.propose({ ...actor, agentId: ada.id }, conceptInput)
  assert.equal(concept.admission, "accepted")
  assert.equal(concept.verified.length, 0, "automatic admission never forges human review")
  for (const title of ["Factorial", "Countdown"]) {
    const example = memory.propose({ ...actor, agentId: ada.id }, { ...conceptInput, title, body: `${title}: stop at zero.`, kind: "example", relations: [{ kind: "supports", recordId: concept.id }] })
    assert.equal(example.admission, "accepted")
  }
  assert.equal(memory.snapshot(actor).records.filter((record) => record.kind === "example").length, 2)
  const studentDm = await request(`${base}/dms`, student.token, { agentId: ada.id })
  const teacherDm = await request(`${base}/dms`, teacher.token, { agentId: ada.id })
  const studentAudience = { ...memory.actor(student.user.id), agentId: ada.id, channelId: studentDm.channel.id }
  const send = async (text: string, token = student.token, channelId = studentDm.channel.id) => request(`${base}/channels/${channelId}/messages`, token, { paragraphs: [[{ kind: "text", text }]] })
  const doubtMessage = await send("I do not understand why we need a base case.")
  const doubtSource = memory.captureMessage(doubtMessage.id)!
  const doubt = memory.propose(studentAudience, { title: "Base-case question", kind: "question", body: "Alex asks why recursion needs a base case.", concept: "base-case", module: "Module 1", occurredAt: "2026-09-01T12:00:00Z", scope: { kind: "learner", learnerId: student.user.id }, evidence: evidence(doubtSource, "I do not understand why we need a base case.") })
  const progressMessage = await send("In my solution, n equals zero is the base case. Without it the recursive calls would never stop.")
  const progressSource = memory.captureMessage(progressMessage.id)!
  const progress = memory.propose(studentAudience, { title: "Explains the stopping condition", kind: "inference", body: "Alex's explanation provides evidence of understanding the base case in this exercise.", concept: "base-case", module: "Module 2", occurredAt: "2026-09-08T12:00:00Z", scope: doubt.scope, evidence: evidence(progressSource, "Without it the recursive calls would never stop."), relations: [{ kind: "resolves", recordId: doubt.id }] })
  assert.equal(progress.admission, "accepted")
  assert.equal(memory.snapshot(studentAudience).records.find((record) => record.id === doubt.id)?.state, "resolved")
  assert.equal(memory.snapshot(studentAudience).records.find((record) => record.id === progress.id)?.kind, "inference")
  queueMemoryMessage(database, progressMessage)
  queueMemoryMessage(database, progressMessage)
  const run = claimMemoryWork(database, communityId, ada.id)!
  assert(run, "queued work is claimable")
  assert.equal(claimMemoryWork(database, communityId, ada.id), undefined, "only one active lease per agent")
  assert(run.payload.view.records.some((record) => record.id === doubt.id), "historical evidence can support a fresh response")
  assert.throws(() => completeMemoryWork(database, communityId, "other-agent", { type: "memory.result", ref: "ref-one", payload: { runId: run.payload.view.runId, proposals: [], answer: "Good explanation." } }), /authenticated/)
  const resultFrame = { type: "memory.result", ref: "ref-one", payload: { runId: run.payload.view.runId, proposals: [], answer: "Your explanation identifies the stopping condition." } }
  const completed = completeMemoryWork(database, communityId, ada.id, resultFrame)
  assert(completed.messageId)
  assert.equal(completeMemoryWork(database, communityId, ada.id, resultFrame).messageId, completed.messageId, "duplicate acknowledgement cannot duplicate a reply")
  const retryMessage = await send("What changes if the input is negative?")
  queueMemoryMessage(database, retryMessage)
  const interrupted = claimMemoryWork(database, communityId, ada.id)!
  releaseMemoryWork(database, ada.id)
  const resumed = claimMemoryWork(database, communityId, ada.id)!
  assert.notEqual(interrupted.payload.view.runId, resumed.payload.view.runId)
  assert.throws(() => completeMemoryWork(database, communityId, ada.id, { ...resultFrame, payload: { ...resultFrame.payload, runId: interrupted.payload.view.runId } }), /authenticated/)
  completeMemoryWork(database, communityId, ada.id, { ...resultFrame, payload: { ...resultFrame.payload, runId: resumed.payload.view.runId } })
  assert(memory.snapshot({ ...actor, agentId: ada.id, channelId: teacherDm.channel.id }).records.some((record) => record.id === doubt.id))
  assert(!memory.snapshot({ ...actor, agentId: ada.id, channelId: channel.id }).records.some((record) => record.id === doubt.id), "teacher asking in shared channel gets no learner memory")
  assert(!JSON.stringify(memory.snapshot(memory.actor(other.user.id))).includes(doubt.id))
  const othersSnapshot = memorySnapshotSchema.parse(await request(`${base}/memory`, other.token))
  assert(!JSON.stringify(othersSnapshot).includes(doubtSource.id), "source titles and IDs are filtered too")
  await request(`${base}/memory/sources/${doubtSource.id}`, other.token, undefined, "GET", 404)
  await request(`${base}/memory/records/${doubt.id}/history`, other.token, undefined, "GET", 404)
  assert.throws(() => memory.propose(studentAudience, { ...conceptInput, evidence: evidence(doubtSource, "I do not understand why we need a base case.") }), /widen/)
  assert.throws(() => memory.propose(studentAudience, { ...conceptInput, verified: [{ by: `human:${teacher.user.id}` }] }), /Unrecognized/)
  assert.throws(() => memory.propose(studentAudience, { ...conceptInput, evidence: evidence(source, "fabricated quote") }), /quote/)
  queueMemorySource(database, source)
  const sourceWork = claimMemoryWork(database, communityId, ada.id)!
  assert.equal(sourceWork.payload.view.purpose, "consolidate")
  assert(!JSON.stringify(sourceWork).includes(doubt.id), "compiling course material cannot load private learner records")
  assert.deepEqual(sourceWork.payload.view.learners, [], "the course compiler has no private learner directory")
  completeMemoryWork(database, communityId, ada.id, { ...resultFrame, payload: { runId: sourceWork.payload.view.runId, proposals: [] } })
  const correction = memory.propose(studentAudience, { title: "Correction to progress evidence", kind: "inference", body: "The response shows an explanation, not independently demonstrated understanding.", scope: doubt.scope, evidence: evidence(progressSource, "Without it the recursive calls would never stop."), relations: [{ kind: "corrects", recordId: progress.id }] })
  memory.review(teacher.user.id, correction.id, { expectedRevision: 1, decision: "accept", note: "Keep the question open until an independent attempt." })
  assert.equal(memory.snapshot(studentAudience).records.find((record) => record.id === progress.id)?.state, "corrected")
  assert.equal(memory.snapshot(studentAudience).records.find((record) => record.id === doubt.id)?.state, "current", "a corrected resolver cannot keep an earlier question resolved")
  const rumorMessage = await send("The teacher said the workshop is Friday.", student.token, channel.id)
  const rumorSource = memory.captureMessage(rumorMessage.id)!
  queueMemoryMessage(database, rumorMessage)
  const sharedWork = claimMemoryWork(database, communityId, ada.id)!
  assert(!JSON.stringify(sharedWork).includes(doubt.id), "shared compiler view excludes learner IDs, bodies and titles")
  completeMemoryWork(database, communityId, ada.id, { ...resultFrame, payload: { runId: sharedWork.payload.view.runId, proposals: [] } })
  const rumor = memory.propose({ ...memory.actor(student.user.id), agentId: ada.id, channelId: channel.id }, { title: "Workshop date", kind: "event", concept: "workshop", body: "Workshop on Friday.", scope: { kind: "channel", channelId: channel.id }, evidence: evidence(rumorSource, "The teacher said the workshop is Friday.") })
  assert.equal(rumor.admission, "review", "quoted teacher identity is not authority")
  await request(`${base}/memory/records/${rumor.id}/review`, student.token, { expectedRevision: 1, decision: "accept", note: "I approve" }, "POST", 403)
  const accepted = memory.review(teacher.user.id, rumor.id, { expectedRevision: 1, decision: "accept", note: "Confirmed with the course schedule." })
  assert.equal(accepted.revision, 2)
  assert.equal(memory.files.record(rumor.id, 1)?.admission, "review")
  assert.throws(() => memory.review(teacher.user.id, rumor.id, { expectedRevision: 1, decision: "reject", note: "Stale action" }), /changed/)
  const expired = memory.propose(actor, { ...conceptInput, title: "Past workshop", kind: "event", concept: "past-workshop", staleAfter: "2020-01-01T00:00:00Z" })
  assert.equal(memory.snapshot(actor).records.find((record) => record.id === expired.id)?.state, "expired")
  const currentSource = memory.ingest(teacher.user.id, { title: source.title, filename: source.filename, mediaType: source.mediaType, scope: source.scope, raw: Buffer.from("Updated notes."), text: "Updated notes.", sourceId: source.id, expectedVersion: 1 })
  assert.deepEqual(memory.files.raw(source), raw, "raw source revisions are retained")
  assert.equal(memory.snapshot(actor).records.find((record) => record.id === concept.id)?.state, "needs_review")
  memory.revoke(teacher.user.id, source.id, currentSource.version)
  assert(!memory.snapshot(actor).records.some((record) => record.id === concept.id), "revocation hides all dependents")
  const staleMessage = await send("Can you revisit my previous explanation?")
  queueMemoryMessage(database, staleMessage)
  const staleWork = claimMemoryWork(database, communityId, ada.id)!
  await request(`${base}/messages/${progressMessage.id}`, student.token, { paragraphs: [[{ kind: "text", text: "Correction: I copied that explanation." }]] }, "PATCH", 200)
  assert.throws(() => completeMemoryWork(database, communityId, ada.id, { ...resultFrame, payload: { ...resultFrame.payload, runId: staleWork.payload.view.runId } }), /changed/, "changed evidence blocks a stale in-flight answer")
  assert.equal(memory.snapshot(studentAudience).records.find((record) => record.id === progress.id)?.state, "needs_review")
  assert.equal(memory.snapshot(studentAudience).records.find((record) => record.id === doubt.id)?.state, "current", "invalidated progress stops resolving the earlier question")
  const okf = serializeOkf(doubt, { vendor_extension: { keep: true } })
  assert.deepEqual(parseOkf(okf).metadata.vendor_extension, { keep: true })
  const historical = join(memory.files.directory, "history", rumor.id, "2.md")
  writeFileSync(historical, serializeOkf(accepted, { vendor_extension: "retained" }))
  memory.review(teacher.user.id, rumor.id, { expectedRevision: 2, decision: "accept", note: "Reconfirmed." })
  assert.equal(parseOkf(readFileSync(join(memory.files.directory, "history", rumor.id, "3.md"), "utf8")).metadata.vendor_extension, "retained")
  const portable = await app.request(`${base}/memory/records/${rumor.id}/okf`, { headers: { authorization: `Bearer ${teacher.token}` } })
  assert.equal(portable.status, 200)
  assert.equal(parseOkf(await portable.text()).metadata.vendor_extension, "retained", "OKF downloads preserve canonical producer extensions")
  assert.throws(() => parseOkf("---\ntitle: missing type\n---\ntext"), /type/)
  assert.throws(() => parseOkf("---\ntype: concept\ntype: event\n---\ntext"), /YAML/)
  const reopened = openDatabase(join(directory, "test.db"))
  assert.equal(new MemoryFiles(reopened, communityId).record(doubt.id)?.body, doubt.body)
  reopened.close()
  const pdf = readFileSync(new URL("../fixtures/memory-upload.pdf", import.meta.url))
  const form = new FormData()
  form.set("metadata", JSON.stringify({ title: "Uploaded recursion PDF", scope: { kind: "course" } }))
  form.set("file", new File([pdf], "recursion.pdf", { type: "application/pdf" }))
  const upload = await app.request(`${base}/memory/sources`, { method: "POST", headers: { authorization: `Bearer ${teacher.token}` }, body: form })
  assert.equal(upload.status, 201, await upload.clone().text())
  const uploaded = (await upload.json()) as { source: MemorySource }
  assert(memory.files.text(uploaded.source).includes("A base case stops recursive calls."), "PDF.js extracts the real uploaded PDF text")
  const downloaded = await app.request(`${base}/memory/sources/${uploaded.source.id}/raw`, { headers: { authorization: `Bearer ${teacher.token}` } })
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), pdf, "multipart ingestion preserves original PDF bytes")
  const studentUpload = await app.request(`${base}/memory/sources`, { method: "POST", headers: { authorization: `Bearer ${student.token}` }, body: form })
  assert.equal(studentUpload.status, 403)
  const pdfWork = claimMemoryWork(database, communityId, ada.id)!
  assert.equal(pdfWork.payload.view.purpose, "consolidate")
  assert(pdfWork.payload.view.sources[0].text.includes("A base case stops recursive calls."))
  completeMemoryWork(database, communityId, ada.id, { ...resultFrame, payload: { runId: pdfWork.payload.view.runId, proposals: [] } })
  const foreign = await request("/api/communities", other.token, { name: "Other course", term: "Autumn" })
  assert.throws(() => memory.snapshot({ communityId: foreign.community.id, userId: other.user.id }), /not found/)
  await request(`/api/communities/${foreign.community.id}/memory/sources/${doubtSource.id}`, other.token, undefined, "GET", 404)
  console.log("Memory OK: canonical bytes/revisions, OKF round trips, composition, role-based admission, private trajectories, temporal state, revocation, corrections, REST isolation, and restart recovery.")
} finally { database.close(); rmSync(directory, { recursive: true, force: true }) }
