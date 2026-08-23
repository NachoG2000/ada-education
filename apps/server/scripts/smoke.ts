import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { WebSocket } from "ws"

const baseUrl = process.env.ADA_SERVER_URL ?? "http://localhost:8787"
const wsUrl = baseUrl.replace(/^http/, "ws")
const timeoutMs = 5_000
const activeSockets = new Set<WebSocket>()

type JsonObject = { type?: string; [key: string]: unknown }

function json(data: WebSocket.RawData): JsonObject {
  return JSON.parse(data.toString()) as JsonObject
}

function opened(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout opening WS")), timeoutMs)
    socket.once("open", () => {
      clearTimeout(timeout)
      resolve()
    })
    socket.once("error", reject)
  })
}

function next(socket: WebSocket, predicate: (event: JsonObject) => boolean, label = "WS event"): Promise<JsonObject> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage)
      reject(new Error(`timeout waiting for ${label}`))
    }, timeoutMs)
    const onMessage = (raw: WebSocket.RawData): void => {
      let event: JsonObject
      try {
        event = json(raw)
      } catch {
        return
      }
      if (!predicate(event)) return
      clearTimeout(timeout)
      socket.off("message", onMessage)
      resolve(event)
    }
    socket.on("message", onMessage)
  })
}

function closed(socket: WebSocket): Promise<number> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout closing invalid WS")), timeoutMs)
    socket.once("close", (code) => {
      clearTimeout(timeout)
      resolve(code)
    })
    socket.once("error", reject)
  })
}

async function post(path: string, body: unknown): Promise<JsonObject> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const value = (await response.json()) as JsonObject
  if (!response.ok) throw new Error(`REST ${response.status}: ${JSON.stringify(value)}`)
  return value
}

async function patch(path: string, body: unknown): Promise<JsonObject> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const value = (await response.json()) as JsonObject
  if (!response.ok) throw new Error(`REST ${response.status}: ${JSON.stringify(value)}`)
  return value
}

async function get(path: string): Promise<JsonObject> {
  const response = await fetch(`${baseUrl}${path}`)
  const value = (await response.json()) as JsonObject
  if (!response.ok) throw new Error(`REST ${response.status}: ${JSON.stringify(value)}`)
  return value
}

/** Modules/materials/reports checks (design.md §8): PATCH difficulty, a material upload that triggers
    an ingest mention, and a report (filed here over the runner socket) reconciled into a decision card.
    Everything it writes lands in the course/DB it runs against: run it through `npm run smoke`, which
    uses a throwaway copy of the course, not the demo's. */
async function moduleAndReportChecks(client: WebSocket, runner: WebSocket): Promise<void> {
  const snapshot = await get("/api/community")
  for (const key of ["modules", "assignments", "feedback", "reports"]) {
    if (!Array.isArray(snapshot[key])) throw new Error(`snapshot is missing array "${key}"`)
  }
  const modules = snapshot.modules as JsonObject[]
  if (modules.length === 0) throw new Error("no modules to exercise module/report checks against")
  const targetModule = modules[0]
  const moduleId = String(targetModule.id)

  const moduleUpdated = next(client, (event) => {
    if (event.type !== "module.updated") return false
    const module = (event.payload as JsonObject | undefined)?.module as JsonObject | undefined
    const difficulty = module?.difficulty as JsonObject | undefined
    return module?.id === moduleId && difficulty?.level === "advanced"
  }, "module.updated after PATCH")
  const patched = await patch(`/api/modules/${moduleId}`, {
    difficulty: { level: "advanced", rationale: "Smoke test override" },
    authorId: "martin",
  })
  const patchedDifficulty = patched.difficulty as JsonObject | undefined
  if (patchedDifficulty?.level !== "advanced") throw new Error("PATCH /api/modules did not apply difficulty.level")
  if (patchedDifficulty?.setBy !== "martin") throw new Error("PATCH /api/modules did not set difficulty.setBy")
  await moduleUpdated

  const materialName = `smoke-${Date.now()}.md`
  const messageCreated = next(client, (event) => {
    if (event.type !== "message.created") return false
    const message = (event.payload as JsonObject | undefined)?.message as JsonObject | undefined
    return message?.channelId === targetModule.channelId
  }, "message.created for the material ingest mention")
  const mentionEvent = next(runner, (event) => event.type === "agent.mention"
    && (event.payload as JsonObject | undefined)?.intent === "ingest"
    && (event.payload as JsonObject | undefined)?.moduleId === moduleId, "agent.mention with the ingest hint")
  const uploaded = await post(`/api/modules/${moduleId}/materials`, {
    name: materialName,
    kind: "markdown",
    text: "# Smoke material\n\nUploaded by the smoke test.",
    authorId: "martin",
  })
  if (uploaded.status !== "compiling") throw new Error("material upload did not set module status to compiling")
  const materials = uploaded.materials as JsonObject[]
  if (!materials.some((item) => item.name === materialName)) throw new Error("material upload did not append the material")
  await messageCreated
  await mentionEvent
  const courseDir = resolve(process.cwd(), process.env.ADA_COURSE ?? "data/neural-networks-2026")
  const writtenPath = resolve(courseDir, "raw/martin/modules", moduleId, materialName)
  if (!existsSync(writtenPath)) throw new Error(`material upload did not write ${writtenPath}`)

  // The report to reconcile is filed by this script over the runner socket, the
  // way a runtime does it: the seeded course doesn't need a pending one.
  const reportRef = `smoke-report-${Date.now()}`
  const reportAck = next(runner, (event) => event.type === "ack" && event.ref === reportRef, "ack for report.create")
  const reportCreated = next(client, (event) => event.type === "report.updated"
    && ((event.payload as JsonObject | undefined)?.report as JsonObject | undefined)?.status === "new", "report.updated after report.create")
  runner.send(JSON.stringify({
    type: "report.create",
    ref: reportRef,
    payload: {
      studentId: "sofia",
      moduleId,
      told: "Smoke test: what the agent told the student.",
      recommendations: [{ id: "r1", text: "Smoke recommendation one" }, { id: "r2", text: "Smoke recommendation two" }],
      cardIds: [],
    },
  }))
  const ack = await reportAck
  if (ack.ok !== true || !(ack.report as JsonObject | undefined)?.id) throw new Error("report.create was not acknowledged with a report")
  const pendingReport = (await reportCreated).payload as JsonObject
  const pendingReportObj = pendingReport.report as JsonObject
  const recommendations = pendingReportObj.recommendations as JsonObject[]
  const acceptedIds = recommendations.slice(0, 1).map((rec) => String(rec.id))
  const cardPublished = next(client, (event) => {
    if (event.type !== "card.published") return false
    const card = (event.payload as JsonObject | undefined)?.card as JsonObject | undefined
    return card?.type === "decision"
  }, "card.published for the reconcile decision")
  const reportUpdated = next(client, (event) => {
    if (event.type !== "report.updated") return false
    const report = (event.payload as JsonObject | undefined)?.report as JsonObject | undefined
    return report?.id === pendingReportObj.id && report?.status === "reconciled"
  }, "report.updated after reconcile")
  const reconciled = await post(`/api/reports/${pendingReportObj.id}/reconcile`, {
    accepted: acceptedIds,
    note: "Smoke test reconciliation.",
    authorId: "martin",
  })
  if (reconciled.status !== "reconciled") throw new Error("reconcile did not mark the report reconciled")
  const reconciledInfo = reconciled.reconciled as JsonObject | undefined
  if (!reconciledInfo?.cardId) throw new Error("reconcile did not record the decision card id")
  await cardPublished
  await reportUpdated

  console.log("Smoke OK (modules/reports): PATCH difficulty, material upload with ingest mention, and report reconcile with a decision card.")
}

async function main(): Promise<void> {
  const client = new WebSocket(`${wsUrl}/ws`)
  activeSockets.add(client)
  await opened(client)
  const runner = new WebSocket(`${wsUrl}/ws/runner?token=ada-demo-token`)
  activeSockets.add(runner)
  const online = next(client, (event) =>
    event.type === "member.presence"
      && (event.payload as JsonObject | undefined)?.memberId === "ada"
      && (event.payload as JsonObject | undefined)?.presence === "online",
    "online presence for ada",
  )
  await opened(runner)
  await online

  const thinking = next(client, (event) =>
    event.type === "member.presence"
      && (event.payload as JsonObject | undefined)?.memberId === "ada"
      && (event.payload as JsonObject | undefined)?.presence === "thinking",
    "thinking presence for ada",
  )
  runner.send(JSON.stringify({
    type: "presence",
    payload: { presence: "thinking", runtime: "claude", model: "smoke-model" },
  }))
  const thinkingEvent = await thinking
  const thinkingPayload = thinkingEvent.payload as JsonObject
  if (thinkingPayload.runtime !== "claude" || thinkingPayload.model !== "smoke-model") {
    throw new Error("presence did not propagate the runner's runtime/model")
  }

  const mention = next(runner, (event) => event.type === "agent.mention", "agent.mention")
  const created = await post("/api/channels/questions/messages", {
    authorId: "sofia",
    paragraphs: [[{ kind: "text", text: "hello @ada" }]],
  })
  const mentionEvent = await mention
  const mentionPayload = mentionEvent.payload as JsonObject
  const context = mentionPayload.context as unknown[]
  if (!Array.isArray(context) || !context.some((item) => (item as JsonObject).id === created.id)) {
    throw new Error("agent.mention does not carry the just-persisted message in context")
  }

  const path = `questions/smoke-${Date.now()}.md`
  const cardEvent = next(client, (event) =>
    event.type === "card.published" && (event.payload as JsonObject | undefined)?.card !== undefined,
    "card.published",
  )
  const cardAck = next(runner, (event) => event.type === "ack" && event.ref === "smoke-card", "ack for card.publish")
  runner.send(JSON.stringify({
    type: "card.publish",
    ref: "smoke-card",
    payload: {
      channelId: "questions",
      path,
      title: "Smoke test question",
      type: "answer",
      visibility: "channel",
      sources: [{ kind: "message", ref: String(created.id), label: "Question" }],
      body: "Test answer from smoke.",
    },
  }))
  const published = await cardAck
  if (published.ok !== true) throw new Error(String(published.error ?? "card.publish rejected"))
  const card = published.card as JsonObject
  if (!card || card.authorId !== "ada") throw new Error("card.publish did not derive authorId=ada")
  const cardPublishedEvent = await cardEvent
  const cardEventPayload = cardPublishedEvent.payload as JsonObject
  const announcedCard = cardEventPayload.card as JsonObject
  const announcedMessage = cardEventPayload.message as JsonObject
  if (!announcedCard || announcedCard.id !== card.id || announcedMessage?.publishes !== card.id) {
    throw new Error("card.published does not carry the publish message with the correct publishes")
  }

  const messageEvent = next(client, (event) =>
    event.type === "message.created" && (event.payload as JsonObject | undefined)?.message !== undefined,
    "message.created",
  )
  const messageAck = next(runner, (event) => event.type === "ack" && event.ref === "smoke-message", "ack for message.create")
  runner.send(JSON.stringify({
    type: "message.create",
    ref: "smoke-message",
    payload: {
      channelId: "questions",
      paragraphs: [[{
        kind: "cite",
        text: "Smoke test question",
        cite: { cardId: String(card.id) },
      }]],
    },
  }))
  const cited = await messageAck
  if (cited.ok !== true) throw new Error(String(cited.error ?? "message.create rejected"))
  const citedMessage = cited.message as JsonObject | undefined
  if (!citedMessage || citedMessage.authorId !== "ada") throw new Error("message.create did not derive authorId=ada")
  const messageCreatedEvent = await messageEvent
  const messageEventPayload = messageCreatedEvent.payload as JsonObject
  const createdEventMessage = messageEventPayload.message as JsonObject
  if (!createdEventMessage || createdEventMessage.id !== citedMessage.id) {
    throw new Error("message.created does not match the ACK's message")
  }

  await moduleAndReportChecks(client, runner)

  const offline = next(client, (event) =>
    event.type === "member.presence"
      && (event.payload as JsonObject | undefined)?.memberId === "ada"
      && (event.payload as JsonObject | undefined)?.presence === "away",
    "away presence for ada",
  )
  runner.close(1000)
  await offline

  const invalid = new WebSocket(`${wsUrl}/ws/runner?token=invalid-token`)
  activeSockets.add(invalid)
  const close = closed(invalid)
  await opened(invalid).catch(() => undefined)
  const closeCode = await close
  if (closeCode !== 4401) throw new Error(`invalid token closed with ${closeCode}, expected 4401`)

  client.close(1000)
  runner.close(1000)
  invalid.close(1000)
  activeSockets.clear()
  console.log("Smoke OK: presence, mention with context, card.publish, message.create with cite, and invalid token (4401).")
}

main().catch((error: unknown) => {
  for (const socket of activeSockets) socket.terminate()
  activeSockets.clear()
  console.error(`Smoke failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
