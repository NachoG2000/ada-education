import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  openDatabase,
  seedCommunity,
  upsertAgent,
  upsertBasePage,
  upsertChannel,
  upsertPerson,
  addChannelMember,
  repoRoot,
  type SeedAgent,
  type SeedChannel,
  type SeedPerson,
} from "./db.js"
import type { PageType } from "@ada/protocol"

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
    type: PageType
    authorId?: string
    sources?: Array<{ kind: "mensaje" | "archivo"; ref: string; label: string }>
  }>
}

export interface SeedOptions {
  courseDir?: string
  dbPath?: string
}

export function seedCourse(options: SeedOptions = {}): void {
  const courseDir = resolve(repoRoot, options.courseDir ?? process.env.ADA_COURSE ?? "data/redes-neuronales-2c-2026")
  const config = JSON.parse(readFileSync(resolve(courseDir, "community.json"), "utf8")) as CourseConfig
  const database = openDatabase(options.dbPath)
  try {
    const channelIds = config.channels.map((channel) => channel.id)
    seedCommunity(database, {
      id: config.id ?? courseDir.split("/").pop() ?? "curso",
      name: config.name,
      subtitle: config.subtitle ?? "Comunidad del curso",
      initial: config.initial ?? config.name.slice(0, 1).toUpperCase(),
    })
    // Las membresías se agregan después de insertar todos los miembros (FKs activas).
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
      upsertBasePage(database, {
        channelId: doc.channelId,
        authorId,
        path: doc.path,
        title: doc.title,
        type: doc.type,
        visibility: "canal",
        sources: doc.sources ?? [{ kind: "archivo", ref: `raw/${doc.path}`, label: doc.title }],
        body,
        base: true,
      })
    }
    console.log(`Seed listo: ${config.name} (${config.channels.length} canales, ${people.length + (config.agents ?? []).length} miembros). Repetible sin duplicar.`)
  } finally {
    database.close()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) seedCourse()
