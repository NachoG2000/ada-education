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
    const timeout = setTimeout(() => reject(new Error("timeout abriendo WS")), timeoutMs)
    socket.once("open", () => {
      clearTimeout(timeout)
      resolve()
    })
    socket.once("error", reject)
  })
}

function next(socket: WebSocket, predicate: (event: JsonObject) => boolean, label = "evento WS"): Promise<JsonObject> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage)
      reject(new Error(`timeout esperando ${label}`))
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
    const timeout = setTimeout(() => reject(new Error("timeout cerrando WS inválido")), timeoutMs)
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

async function main(): Promise<void> {
  const client = new WebSocket(`${wsUrl}/ws`)
  activeSockets.add(client)
  await opened(client)
  const runner = new WebSocket(`${wsUrl}/ws/runner?token=ada-demo-token`)
  activeSockets.add(runner)
  const online = next(client, (event) =>
    event.type === "member.presence"
      && (event.payload as JsonObject | undefined)?.memberId === "ada"
      && (event.payload as JsonObject | undefined)?.presence === "en-linea",
    "presencia en-linea de ada",
  )
  await opened(runner)
  await online

  const thinking = next(client, (event) =>
    event.type === "member.presence"
      && (event.payload as JsonObject | undefined)?.memberId === "ada"
      && (event.payload as JsonObject | undefined)?.presence === "pensando",
    "presencia pensando de ada",
  )
  runner.send(JSON.stringify({
    type: "presence",
    payload: { presence: "pensando", runtime: "claude", model: "smoke-model" },
  }))
  const thinkingEvent = await thinking
  const thinkingPayload = thinkingEvent.payload as JsonObject
  if (thinkingPayload.runtime !== "claude" || thinkingPayload.model !== "smoke-model") {
    throw new Error("presence no propagó runtime/model del runner")
  }

  const mention = next(runner, (event) => event.type === "agent.mention", "agent.mention")
  const created = await post("/api/channels/dudas/messages", {
    authorId: "sofia",
    paragraphs: [[{ kind: "text", text: "hola @ada" }]],
  })
  const mentionEvent = await mention
  const mentionPayload = mentionEvent.payload as JsonObject
  const context = mentionPayload.context as unknown[]
  if (!Array.isArray(context) || !context.some((item) => (item as JsonObject).id === created.id)) {
    throw new Error("agent.mention no trae el mensaje recién persistido en context")
  }

  const path = `preguntas/smoke-${Date.now()}.md`
  const pageEvent = next(client, (event) =>
    event.type === "page.published" && (event.payload as JsonObject | undefined)?.page !== undefined,
    "page.published",
  )
  const pageAck = next(runner, (event) => event.type === "ack" && event.ref === "smoke-page", "ack de page.publish")
  runner.send(JSON.stringify({
    type: "page.publish",
    ref: "smoke-page",
    payload: {
      channelId: "dudas",
      path,
      title: "Pregunta del smoke",
      type: "respuesta",
      visibility: "canal",
      sources: [{ kind: "mensaje", ref: String(created.id), label: "Pregunta" }],
      body: "Respuesta de prueba del smoke.",
    },
  }))
  const published = await pageAck
  if (published.ok !== true) throw new Error(String(published.error ?? "page.publish rechazado"))
  const page = published.page as JsonObject
  if (!page || page.authorId !== "ada") throw new Error("page.publish no derivó authorId=ada")
  const pagePublishedEvent = await pageEvent
  const pageEventPayload = pagePublishedEvent.payload as JsonObject
  const announcedPage = pageEventPayload.page as JsonObject
  const announcedMessage = pageEventPayload.message as JsonObject
  if (!announcedPage || announcedPage.id !== page.id || announcedMessage?.publishes !== page.id) {
    throw new Error("page.published no trae el mensaje de publicación con publishes correcto")
  }

  const messageEvent = next(client, (event) =>
    event.type === "message.created" && (event.payload as JsonObject | undefined)?.message !== undefined,
    "message.created",
  )
  const messageAck = next(runner, (event) => event.type === "ack" && event.ref === "smoke-message", "ack de message.create")
  runner.send(JSON.stringify({
    type: "message.create",
    ref: "smoke-message",
    payload: {
      channelId: "dudas",
      paragraphs: [[{
        kind: "cite",
        text: "Pregunta del smoke",
        cite: { pageId: String(page.id) },
      }]],
    },
  }))
  const cited = await messageAck
  if (cited.ok !== true) throw new Error(String(cited.error ?? "message.create rechazado"))
  const citedMessage = cited.message as JsonObject | undefined
  if (!citedMessage || citedMessage.authorId !== "ada") throw new Error("message.create no derivó authorId=ada")
  const messageCreatedEvent = await messageEvent
  const messageEventPayload = messageCreatedEvent.payload as JsonObject
  const createdEventMessage = messageEventPayload.message as JsonObject
  if (!createdEventMessage || createdEventMessage.id !== citedMessage.id) {
    throw new Error("message.created no corresponde al mensaje del ACK")
  }

  const offline = next(client, (event) =>
    event.type === "member.presence"
      && (event.payload as JsonObject | undefined)?.memberId === "ada"
      && (event.payload as JsonObject | undefined)?.presence === "ausente",
    "presencia ausente de ada",
  )
  runner.close(1000)
  await offline

  const invalid = new WebSocket(`${wsUrl}/ws/runner?token=token-invalido`)
  activeSockets.add(invalid)
  const close = closed(invalid)
  await opened(invalid).catch(() => undefined)
  const closeCode = await close
  if (closeCode !== 4401) throw new Error(`token inválido cerró con ${closeCode}, esperaba 4401`)

  client.close(1000)
  runner.close(1000)
  invalid.close(1000)
  activeSockets.clear()
  console.log("Smoke OK: presencia, mención con contexto, page.publish, message.create con cite y token inválido (4401).")
}

main().catch((error: unknown) => {
  for (const socket of activeSockets) socket.terminate()
  activeSockets.clear()
  console.error(`Smoke falló: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
