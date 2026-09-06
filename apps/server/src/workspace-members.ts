import { randomBytes, randomUUID } from "node:crypto"
import type { DatabaseSync } from "node:sqlite"
import type {
  Agent,
  AgentCreateResult,
  AgentEnrollment,
  AgentTokenRotationResult,
  ApiErrorCode,
  CommunityUpdateInput,
  Person,
  ProfileUpdateInput,
  UpdateAgentInput,
} from "@ada/protocol"
import { WorkspaceError } from "./workspace-errors.js"

type Row = Record<string, unknown>

const asString = (value: unknown): string | undefined => typeof value === "string" ? value : undefined
const now = (): string => new Date().toISOString()

function fail(code: ApiErrorCode, message: string, field?: string): never {
  throw new WorkspaceError(code, message, field)
}

function transaction<T>(database: DatabaseSync, fn: () => T): T {
  database.exec("BEGIN IMMEDIATE")
  try {
    const value = fn()
    database.exec("COMMIT")
    return value
  } catch (error) {
    database.exec("ROLLBACK")
    throw error
  }
}

function personRow(database: DatabaseSync, id: string): Row {
  const row = database.prepare("SELECT * FROM members WHERE id = ? AND kind = 'person'").get(id) as Row | undefined
  if (!row) fail("forbidden", "Only a person can perform this operation.")
  return row
}

function isTeacher(row: Row): boolean {
  return asString(row.role) === "teacher"
}

function ensureTeacher(database: DatabaseSync, actorId: string): Row {
  const actor = personRow(database, actorId)
  if (!isTeacher(actor)) fail("forbidden", "Only a teacher can manage this course workspace.")
  return actor
}

function ensureAgent(database: DatabaseSync, agentId: string): Row {
  const agent = database.prepare("SELECT * FROM members WHERE id = ? AND kind = 'agent'").get(agentId) as Row | undefined
  if (!agent) fail("not_found", "Agent does not exist.")
  return agent
}

function ensureAgentManager(database: DatabaseSync, actorId: string, agent: Row): Row {
  const actor = personRow(database, actorId)
  if (isTeacher(actor) || (asString(agent.scope) === "personal" && asString(agent.created_by) === actorId)) return actor
  fail("forbidden", "You cannot manage this agent.")
}

function ensureChannels(database: DatabaseSync, actor: Row, channelIds: string[]): void {
  for (const channelId of [...new Set(channelIds)]) {
    const channel = database.prepare("SELECT id FROM channels WHERE id = ?").get(channelId) as Row | undefined
    if (!channel) fail("not_found", `Channel does not exist: ${channelId}`, "channelIds")
    if (!isTeacher(actor) && !database.prepare("SELECT 1 FROM channel_members WHERE channel_id = ? AND member_id = ?")
      .get(channelId, asString(actor.id) ?? "")) {
      fail("not_channel_member", `You are not a member of channel ${channelId}.`, "channelIds")
    }
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function enrollment(token: string): AgentEnrollment {
  return {
    runnerToken: token,
    setupCommand: `npx tsx packages/runner/src/cli.ts --server "$ADA_SERVER" --cwd "$ADA_AGENT_CWD" --token ${shellQuote(token)}`,
  }
}

function agentFromRow(database: DatabaseSync, row: Row): Agent {
  const id = asString(row.id) ?? ""
  const channelIds = (database.prepare("SELECT channel_id FROM channel_members WHERE member_id = ? ORDER BY channel_id")
    .all(id) as Row[]).map((item) => asString(item.channel_id) ?? "")
  return {
    kind: "agent",
    id,
    name: asString(row.name) ?? id,
    description: asString(row.description),
    scope: (asString(row.scope) ?? "community") as Agent["scope"],
    createdBy: asString(row.created_by) ?? "",
    figureSeed: asString(row.figure_seed),
    figureColor: asString(row.figure_color) as Agent["figureColor"],
    instructions: asString(row.instructions) ?? "",
    provider: {
      mode: (asString(row.provider_mode) ?? "subscription") as Agent["provider"]["mode"],
      model: asString(row.provider_model) ?? "",
    },
    channelIds,
    presence: "away",
    runtime: asString(row.runtime),
    model: asString(row.model),
    status: (asString(row.status) ?? "active") as Agent["status"],
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    inactiveAt: asString(row.inactive_at),
    avatarUrl: asString(row.avatar_url),
  }
}

export function getWorkspaceAgent(database: DatabaseSync, agentId: string): Agent | undefined {
  const row = database.prepare("SELECT * FROM members WHERE id = ? AND kind = 'agent'").get(agentId) as Row | undefined
  return row ? agentFromRow(database, row) : undefined
}

export function listWorkspaceAgents(database: DatabaseSync): Agent[] {
  return (database.prepare("SELECT * FROM members WHERE kind = 'agent' ORDER BY created_at, id").all() as Row[])
    .map((row) => agentFromRow(database, row))
}

function personFromRow(row: Row): Person {
  const id = asString(row.id) ?? ""
  return {
    kind: "person",
    id,
    name: asString(row.name) ?? id,
    initials: asString(row.initials) ?? "",
    tone: (asString(row.tone) ?? "card") as Person["tone"],
    role: asString(row.role) as Person["role"],
    presence: "online",
  }
}

export interface CommunityInfo {
  id: string
  name: string
  subtitle: string
  initial: string
  updatedAt: string
}

export function updateCommunity(database: DatabaseSync, actorId: string, input: CommunityUpdateInput): CommunityInfo {
  ensureTeacher(database, actorId)
  return transaction(database, () => {
    const current = database.prepare("SELECT * FROM community LIMIT 1").get() as Row | undefined
    if (!current) fail("not_found", "Community does not exist.")
    const name = input.name ?? asString(current.name) ?? ""
    const subtitle = input.subtitle ?? asString(current.subtitle) ?? ""
    const updatedAt = now()
    database.prepare("UPDATE community SET name = ?, subtitle = ?, updated_at = ? WHERE id = ?")
      .run(name, subtitle, updatedAt, asString(current.id) ?? "")
    return {
      id: asString(current.id) ?? "",
      name,
      subtitle,
      initial: asString(current.initial) ?? name.slice(0, 1).toUpperCase(),
      updatedAt,
    }
  })
}

export function updateProfile(database: DatabaseSync, actorId: string, memberId: string, input: ProfileUpdateInput): Person {
  if (actorId !== memberId) fail("forbidden", "You can only update your own profile.")
  personRow(database, memberId)
  return transaction(database, () => {
    const current = personRow(database, memberId)
    const name = input.name ?? asString(current.name) ?? ""
    const initials = input.initials ?? asString(current.initials) ?? ""
    const tone = input.tone ?? asString(current.tone) ?? "card"
    database.prepare("UPDATE members SET name = ?, initials = ?, tone = ?, updated_at = ? WHERE id = ?")
      .run(name, initials, tone, now(), memberId)
    return personFromRow({ ...current, name, initials, tone })
  })
}

export function createAgent(database: DatabaseSync, actorId: string, input: {
  name: string
  description?: string
  avatarUrl?: string
  instructions: string
  scope: Agent["scope"]
  runtime: string
  model?: string
  figureSeed?: string
  figureColor?: Agent["figureColor"]
  channelIds: string[]
}): AgentCreateResult {
  const actor = personRow(database, actorId)
  if (input.scope === "community" && !isTeacher(actor)) fail("forbidden", "Only a teacher can create a community agent.")
  ensureChannels(database, actor, input.channelIds)
  const id = `agent-${randomUUID()}`
  const token = randomBytes(24).toString("base64url")
  const createdAt = now()
  const model = input.model ?? ""
  return transaction(database, () => {
    database.prepare(`
      INSERT INTO members (
        id, kind, name, scope, created_by, figure_seed, figure_color, instructions,
        provider_mode, provider_model, runtime, model, token, description, avatar_url, status,
        created_at, updated_at
      ) VALUES (?, 'agent', ?, ?, ?, ?, ?, ?, 'subscription', ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(id, input.name.trim(), input.scope, actorId, input.figureSeed ?? id, input.figureColor ?? null,
      input.instructions, model, input.runtime, model, token, input.description ?? null, input.avatarUrl ?? null, createdAt, createdAt)
    for (const channelId of [...new Set(input.channelIds)]) {
      database.prepare("INSERT INTO channel_members (channel_id, member_id) VALUES (?, ?)").run(channelId, id)
    }
    const agent = database.prepare("SELECT * FROM members WHERE id = ?").get(id) as Row
    return { agent: agentFromRow(database, agent), enrollment: enrollment(token) }
  })
}

export function updateAgent(database: DatabaseSync, actorId: string, agentId: string, input: UpdateAgentInput): Agent {
  const existing = ensureAgent(database, agentId)
  const actor = ensureAgentManager(database, actorId, existing)
  const targetScope = input.scope ?? (asString(existing.scope) as Agent["scope"] ?? "community")
  if (targetScope === "community" && !isTeacher(actor)) fail("forbidden", "Only a teacher can own a community agent.")
  if (input.channelIds) ensureChannels(database, actor, input.channelIds)
  return transaction(database, () => {
    const sets: string[] = []
    const values: Array<string | null> = []
    const add = (column: string, value: string | null) => { sets.push(`${column} = ?`); values.push(value) }
    if (input.name !== undefined) add("name", input.name.trim())
    if (input.description !== undefined) add("description", input.description)
    if (input.avatarUrl !== undefined) add("avatar_url", input.avatarUrl)
    if (input.instructions !== undefined) add("instructions", input.instructions)
    if (input.scope !== undefined) add("scope", input.scope)
    if (input.runtime !== undefined) add("runtime", input.runtime)
    if (input.model !== undefined) {
      add("model", input.model)
      add("provider_model", input.model)
    }
    if (input.figureSeed !== undefined) add("figure_seed", input.figureSeed)
    if (input.figureColor !== undefined) add("figure_color", input.figureColor)
    if (input.status !== undefined) {
      add("status", input.status)
      add("inactive_at", input.status === "inactive" ? now() : null)
      if (input.status === "inactive") add("token", null)
    }
    if (sets.length > 0) {
      add("updated_at", now())
      values.push(agentId)
      database.prepare(`UPDATE members SET ${sets.join(", ")} WHERE id = ? AND kind = 'agent'`).run(...values)
    }
    if (input.channelIds) {
      database.prepare("DELETE FROM channel_members WHERE member_id = ?").run(agentId)
      for (const channelId of [...new Set(input.channelIds)]) {
        database.prepare("INSERT INTO channel_members (channel_id, member_id) VALUES (?, ?)").run(channelId, agentId)
      }
    }
    return agentFromRow(database, ensureAgent(database, agentId))
  })
}

export function rotateAgentToken(database: DatabaseSync, actorId: string, agentId: string): AgentTokenRotationResult {
  const existing = ensureAgent(database, agentId)
  ensureAgentManager(database, actorId, existing)
  if (asString(existing.status) === "inactive") fail("conflict", "Reactivate the agent before rotating its runner token.")
  const token = randomBytes(24).toString("base64url")
  const updatedAt = now()
  return transaction(database, () => {
    database.prepare("UPDATE members SET token = ?, updated_at = ? WHERE id = ? AND kind = 'agent'")
      .run(token, updatedAt, agentId)
    return { agent: agentFromRow(database, ensureAgent(database, agentId)), enrollment: enrollment(token) }
  })
}

export function deleteAgent(database: DatabaseSync, actorId: string, agentId: string): { agentId: string } {
  const existing = ensureAgent(database, agentId)
  ensureAgentManager(database, actorId, existing)
  return transaction(database, () => {
    const references: Array<[string, string]> = [
      ["messages", "SELECT 1 FROM messages WHERE author_id = ? LIMIT 1"],
      ["cards", "SELECT 1 FROM cards WHERE author_id = ? LIMIT 1"],
      ["feedback", "SELECT 1 FROM feedback WHERE agent_id = ? LIMIT 1"],
      ["reports", "SELECT 1 FROM reports WHERE agent_id = ? LIMIT 1"],
      ["created channels", "SELECT 1 FROM channels WHERE created_by = ? LIMIT 1"],
      ["channel memberships", "SELECT 1 FROM channel_members WHERE member_id = ? LIMIT 1"],
    ]
    for (const [label, query] of references) {
      if (database.prepare(query).get(agentId)) fail("history_conflict", `Agent cannot be deleted while it has ${label}; deactivate it instead.`)
    }
    database.prepare("DELETE FROM members WHERE id = ? AND kind = 'agent'").run(agentId)
    return { agentId }
  })
}
