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
  getMessage,
  getModule,
  getMessages,
  getThread,
  listMembers,
  openDatabase,
  publishCard,
  type AuthoredCardPublishInput,
} from "./db.js"
import { createApi } from "./api.js"
import { canReadChannel as canReadWorkspaceChannel, getWorkspaceChannel } from "./workspace-access.js"
import { createWebSocketHub, type AgentRecord, type WebSocketHub, type WsStore } from "./ws.js"

export type RunningServer = {
  server: Server
  hub: WebSocketHub
  close(): Promise<void>
}

export function startServer(): RunningServer {
  const database = openDatabase()
  const presence = new Map<string, Presence>()
  const memberKinds = new Map(listMembers(database).map((member) => [member.id, member.kind] as const))
  let hub: WebSocketHub | undefined

  const rememberMember = (member: Member): void => {
    memberKinds.set(member.id, member.kind)
  }

  const requireMembership = ["1", "true"].includes(process.env.ADA_REQUIRE_MEMBERSHIP ?? "")
  const app = createApi(database, {
    presence,
    requireMembership,
    onMessageCreated: (message, hint) => hub?.onMessageCreated(message, hint),
    onMemberJoined: (member) => {
      rememberMember(member)
      hub?.broadcast({ type: "member.joined", payload: { member } })
    },
    onChannelCreated: (channel) => hub?.broadcast({ type: "channel.created", payload: { channel } }),
    onChannelUpdated: (channel) => hub?.broadcast({ type: "channel.updated", payload: { channel } }),
    // Deletion is delivered by onChannelAccessRevoked to the pre-mutation
    // audience; broadcasting from here would duplicate that typed event.
    onChannelDeleted: () => undefined,
    onChannelAccessRevoked: (channelId, memberIds, deletedBy) => hub?.revokeChannelAccess(channelId, memberIds, deletedBy),
    onMemberUpdated: (member) => {
      rememberMember(member)
      if (member.kind === "agent" && member.status === "inactive") hub?.disconnectRunner(member.id, "agent deactivated")
      hub?.broadcast({ type: "member.updated", payload: { member } })
    },
    onMemberDeleted: (memberId) => {
      hub?.disconnectRunner(memberId, "agent deleted")
      // Visibility-safe delivery is handled by onMemberAccessRevoked; the
      // ordinary event would be unable to resolve a deleted agent's channels.
    },
    onMemberAccessRevoked: (memberId, viewerIds) => hub?.revokeMemberAccess(memberId, viewerIds),
    onCommunityUpdated: (community) => hub?.broadcast({ type: "community.updated", payload: { community } }),
    onMessageUpdated: (message) => hub?.broadcast({ type: "message.updated", payload: { message } }),
    onMessageDeleted: (message) => hub?.broadcast({ type: "message.deleted", payload: { message } }),
    onMessageReactionsUpdated: (messageId, reactions) => hub?.broadcast({
      type: "message.reactions.updated",
      payload: { messageId, reactions },
    }),
    onChannelRead: (read) => hub?.broadcast({
      type: "channel.read",
      payload: { channelId: read.channelId, memberId: read.memberId, lastReadAt: read.lastReadAt },
    }),
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
    viewerForToken(token): Member | undefined {
      return findPersonByToken(database, token)
    },
    findAgentByToken(token): AgentRecord | undefined {
      const agent = findAgentByToken(database, token)
      return agent ? { ...agent, token } : undefined
    },
    members(): Member[] {
      return listMembers(database, presence)
    },
    channel(id: string): Channel | undefined {
      return getWorkspaceChannel(database, id)
    },
    member(id: string): Member | undefined {
      return getMember(database, id, presence)
    },
    memberKind(id: string): Member["kind"] | undefined {
      return memberKinds.get(id)
    },
    module(id: string) {
      return getModule(database, id)
    },
    message(id: string) {
      return getMessage(database, id)
    },
    canReadChannel(id: string, viewer: Member): boolean {
      return canReadWorkspaceChannel(database, id, viewer)
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
