import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  openDatabase,
  seedCommunity,
  upsertAgent,
  upsertBaseCard,
  upsertChannel,
  upsertPerson,
  addChannelMember,
  repoRoot,
  type SeedAgent,
  type SeedChannel,
  type SeedPerson,
} from "./db.js"
import type { CardType } from "@ada/protocol"

interface CourseConfig {
  id?: string
  name: string
  subtitle?: string
  initial?: string
  channels: Array<SeedChannel>
  people?: Array<SeedPerson & { channelIds?: string[] }>
  persons?: Array<SeedPerson & { channelIds?: string[] }>
  agents?: Array<SeedAgent>
  baseDocs?: Array<{
    channelId: string
    path: string
    title: string
    type: CardType
    authorId?: string
    sources?: Array<{ kind: "message" | "file"; ref: string; label: string }>
  }>
}

export interface SeedOptions {
  courseDir?: string
  dbPath?: string
}

export function seedCourse(options: SeedOptions = {}): void {
  const courseDir = resolve(repoRoot, options.courseDir ?? process.env.ADA_COURSE ?? "data/neural-networks-2026")
  const config = JSON.parse(readFileSync(resolve(courseDir, "community.json"), "utf8")) as CourseConfig
  const database = openDatabase(options.dbPath)
  try {
    const channelIds = config.channels.map((channel) => channel.id)
    seedCommunity(database, {
      id: config.id ?? courseDir.split("/").pop() ?? "course",
      name: config.name,
      subtitle: config.subtitle ?? "Course community",
      initial: config.initial ?? config.name.slice(0, 1).toUpperCase(),
    })
    // Memberships are added after inserting all members (FKs are active).
    for (const channel of config.channels) upsertChannel(database, { ...channel, memberIds: [] })
    const people = config.people ?? config.persons ?? []
    for (const person of people) {
      upsertPerson(database, person)
      for (const channelId of person.channelIds ?? channelIds) addChannelMember(database, channelId, person.id)
    }
    for (const agent of config.agents ?? []) upsertAgent(database, agent)
    for (const channel of config.channels) {
      for (const memberId of channel.memberIds ?? []) addChannelMember(database, channel.id, memberId)
    }
    for (const doc of config.baseDocs ?? []) {
      const authorId = doc.authorId ?? doc.path.split("/")[0]
      const body = readFileSync(resolve(courseDir, "raw", doc.path), "utf8")
      upsertBaseCard(database, {
        channelId: doc.channelId,
        authorId,
        path: doc.path,
        title: doc.title,
        type: doc.type,
        visibility: "channel",
        sources: doc.sources ?? [{ kind: "file", ref: `raw/${doc.path}`, label: doc.title }],
        body,
        base: true,
      })
    }
    console.log(`Seed complete: ${config.name} (${config.channels.length} channels, ${people.length + (config.agents ?? []).length} members). Repeatable without duplicating.`)
  } finally {
    database.close()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) seedCourse()
