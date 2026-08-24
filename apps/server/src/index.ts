import { pathToFileURL } from "node:url"
import { createServer, type Server } from "node:http"
import { getRequestListener } from "@hono/node-server"
import type { Channel, Member, Message, Presence } from "@ada/protocol"
import {
  applyModuleSuggestion,
  createMessage,
  createReport,
  findAgentByToken,
  findPersonByToken,
  getMember,
  getMessages,
  getThread,
  listChannels,
  listMembers,
  openDatabase,
  publishCard,
  type AuthoredCardPublishInput,
} from "./db.js"
import { createApi } from "./api.js"
import { createWebSocketHub, type AgentRecord, type WebSocketHub, type WsStore } from "./ws.js"

export type RunningServer = {
  server: Server
  hub: WebSocketHub
  close(): Promise<void>
}

export function startServer(): RunningServer {
  const database = openDatabase()
  const presence = new Map<string, Presence>()
  let hub: WebSocketHub | undefined

  const requireMembership = ["1", "true"].includes(process.env.ADA_REQUIRE_MEMBERSHIP ?? "")
  const app = createApi(database, {
    presence,
    requireMembership,
    onMessageCreated: (message, hint) => hub?.onMessageCreated(message, hint),
    onMemberJoined: (member) => hub?.broadcast({ type: "member.joined", payload: { member } }),
    onThreadCreated: (thread) => hub?.onThreadCreated(thread),
    onCardPublished: ({ card, message }) => hub?.onCardPublished(card, message),
    onModuleUpdated: (module) => hub?.broadcast({ type: "module.updated", payload: { module } }),
    onReportUpdated: (report) => hub?.broadcast({ type: "report.updated", payload: { report } }),
  })
  const server = createServer(getRequestListener(app.fetch))
  const store: WsStore = {
    requireMembership,
    personTokenValid(token): boolean {
      return Boolean(findPersonByToken(database, token))
    },
    findAgentByToken(token): AgentRecord | undefined {
      const agent = findAgentByToken(database, token)
      return agent ? { ...agent, token } : undefined
    },
    members(): Member[] {
      return listMembers(database, presence)
    },
    channel(id: string): Channel | undefined {
      return listChannels(database).find((channel) => channel.id === id)
    },
    member(id: string): Member | undefined {
      return getMember(database, id, presence)
    },
    messages(): Message[] {
      return getMessages(database, { limit: 1_000_000 })
    },
    threadRootMessageId(threadId: string): string | undefined {
      return getThread(database, threadId)?.rootMessageId
    },
    createMessage(input) {
      return createMessage(database, input)
    },
    publishCard(input) {
      return publishCard(database, input as AuthoredCardPublishInput)
    },
    applyModuleSuggestion(agentId, input) {
      return applyModuleSuggestion(database, agentId, input)
    },
    createReport(agentId, input) {
      return createReport(database, agentId, input)
    },
  }
  hub = createWebSocketHub(server, store, (agentId, nextPresence) => {
    presence.set(agentId, nextPresence)
  })

  const port = Number(process.env.PORT ?? "8787")
  server.listen(port, () => {
    console.log(`Ada server listening on http://localhost:${port}`)
  })

  let closing: Promise<void> | undefined
  const close = (): Promise<void> => {
    if (closing) return closing
    closing = (async () => {
      await hub?.close()
      await closeHttpServer(server)
      database.close()
    })()
    return closing
  }

  return {
    server,
    hub,
    close,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const running = startServer()
  let shuttingDown = false
  const shutdown = (signal: string): void => {
    if (shuttingDown) return
    shuttingDown = true
    process.off("SIGINT", onSigInt)
    process.off("SIGTERM", onSigTerm)
    console.log(`Received ${signal}; shutting down Ada server...`)
    void running.close().then(
      () => {
        console.log("Ada server closed.")
        // Cleanup finished; we exit this child process so `tsx watch`
        // doesn't have to force it after SIGINT/SIGTERM propagates.
        process.exit(0)
      },
      (error: unknown) => {
        console.error(`Could not close Ada server: ${error instanceof Error ? error.message : String(error)}`)
        process.exit(1)
      },
    )
  }
  const onSigInt = (): void => shutdown("SIGINT")
  const onSigTerm = (): void => shutdown("SIGTERM")
  process.once("SIGINT", onSigInt)
  process.once("SIGTERM", onSigTerm)
}

function closeHttpServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
}
