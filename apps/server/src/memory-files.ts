import { randomUUID } from "node:crypto"
import { closeSync, existsSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import type { DatabaseSync } from "node:sqlite"
import { parseDocument, stringify } from "yaml"
import { memoryRecordSchema, memorySourceSchema, type MemoryRecord, type MemorySource } from "@ada/protocol"

type Catalog = { version: number; sources: Record<string, number>; records: Record<string, number> }
const roots = new WeakMap<DatabaseSync, string>()
const safeId = (id: string): string => {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(id)) throw new Error("Invalid memory identifier")
  return id
}

export function memoryRoot(db: DatabaseSync): string {
  let root = roots.get(db)
  if (!root) {
    const file = (db.prepare("PRAGMA database_list").get() as { file: string }).file
    root = file ? join(dirname(file), `${basename(file)}.memory`) : mkdtempSync(join(tmpdir(), "ada-memory-"))
    roots.set(db, root)
  }
  return root
}

/** Rename is the commit point; fsync prevents an acknowledged head losing its files. */
function atomicWrite(path: string, content: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${randomUUID()}.tmp`
  const fd = openSync(temporary, "wx", 0o600)
  try { writeFileSync(fd, content); fsyncSync(fd) } finally { closeSync(fd) }
  renameSync(temporary, path)
  const dir = openSync(dirname(path), "r")
  try { fsyncSync(dir) } finally { closeSync(dir) }
}

export function parseOkf(text: string): { metadata: Record<string, unknown>; body: string } {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const end = lines.indexOf("---", 1)
  if (lines[0] !== "---" || end < 1) throw new Error("OKF requires YAML frontmatter")
  const document = parseDocument(lines.slice(1, end).join("\n"), { uniqueKeys: true })
  if (document.errors.length) throw new Error("Invalid OKF YAML")
  const metadata: unknown = document.toJS({ maxAliasCount: 50 })
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) || !("type" in metadata) || typeof metadata.type !== "string") throw new Error("OKF requires a type")
  return { metadata: metadata as Record<string, unknown>, body: lines.slice(end + 1).join("\n").trim() }
}

export function serializeOkf(record: MemoryRecord, previous: Record<string, unknown> = {}): string {
  const { body, ...ada } = record
  const metadata = {
    ...previous, type: record.kind, title: record.title,
    sources: record.evidence.map((source, index) => ({ ...((Array.isArray(previous.sources) ? previous.sources[index] : undefined) as object ?? {}), id: `s${index + 1}`, resource: `references/${source.sourceId}/v${source.version}/raw` })),
    generated: { by: record.generatedBy, at: record.createdAt }, verified: record.verified,
    status: record.admission === "accepted" ? "stable" : record.admission === "review" ? "draft" : "deprecated",
    ...(record.staleAfter ? { stale_after: record.staleAfter } : {}),
    "x-ada": ada,
  }
  return `---\n${stringify(metadata)}---\n\n${body}\n`
}

/** Files are canonical. The catalog is an atomic set of revision pointers, never a body index. */
export class MemoryFiles {
  readonly directory: string
  readonly db: DatabaseSync
  readonly communityId: string
  constructor(db: DatabaseSync, communityId: string) {
    this.db = db
    this.communityId = communityId
    this.directory = join(memoryRoot(db), safeId(communityId))
  }
  catalog(): Catalog {
    const path = join(this.directory, "catalog.json")
    if (!existsSync(path)) return { version: 0, sources: {}, records: {} }
    return JSON.parse(readFileSync(path, "utf8")) as Catalog
  }
  initialize(): void {
    if (existsSync(join(this.directory, "catalog.json"))) return
    this.commit(() => undefined)
  }
  commit<T>(operation: (catalog: Catalog) => T): T {
    // SQLite's existing installation lock serializes processes as well as requests.
    // It stores no canonical memory content. Unreferenced files after a crash are inert.
    const owns = !this.db.isTransaction
    if (owns) this.db.exec("BEGIN IMMEDIATE")
    try {
      const catalog = this.catalog()
      const result = operation(catalog)
      catalog.version += 1
      atomicWrite(join(this.directory, "catalog.json"), JSON.stringify(catalog, null, 2))
      if (owns) this.db.exec("COMMIT")
      return result
    } catch (error) {
      if (owns && this.db.isTransaction) this.db.exec("ROLLBACK")
      throw error
    }
  }
  source(id: string, version = this.catalog().sources[id]): MemorySource | undefined {
    if (!version || !Number.isSafeInteger(version) || version < 1 || version > (this.catalog().sources[id] ?? 0)) return undefined
    const path = join(this.directory, "references", safeId(id), `v${version}`, "source.json")
    return existsSync(path) ? memorySourceSchema.parse(JSON.parse(readFileSync(path, "utf8"))) : undefined
  }
  raw(source: MemorySource): Buffer {
    return readFileSync(join(this.directory, "references", safeId(source.id), `v${source.version}`, "raw"))
  }
  text(source: MemorySource): string {
    return readFileSync(join(this.directory, "references", safeId(source.id), `v${source.version}`, "text.txt"), "utf8")
  }
  writeSource(catalog: Catalog, source: MemorySource, raw: Uint8Array, text: string): void {
    const directory = join(this.directory, "references", safeId(source.id), `v${source.version}`)
    atomicWrite(join(directory, "raw"), raw)
    atomicWrite(join(directory, "text.txt"), text)
    atomicWrite(join(directory, "source.json"), JSON.stringify(memorySourceSchema.parse(source), null, 2))
    catalog.sources[source.id] = source.version
  }
  record(id: string, revision = this.catalog().records[id]): MemoryRecord | undefined {
    if (!revision || !Number.isSafeInteger(revision) || revision < 1 || revision > (this.catalog().records[id] ?? 0)) return undefined
    const path = join(this.directory, "history", safeId(id), `${revision}.md`)
    if (!existsSync(path)) return undefined
    const { metadata, body } = parseOkf(readFileSync(path, "utf8"))
    return memoryRecordSchema.parse({ ...(metadata["x-ada"] as object), body })
  }
  okf(record: MemoryRecord): string {
    return readFileSync(join(this.directory, "history", safeId(record.id), `${record.revision}.md`), "utf8")
  }
  writeRecord(catalog: Catalog, record: MemoryRecord): void {
    const last = catalog.records[record.id]
    const previous = last ? parseOkf(readFileSync(join(this.directory, "history", safeId(record.id), `${last}.md`), "utf8")).metadata : {}
    atomicWrite(join(this.directory, "history", safeId(record.id), `${record.revision}.md`), serializeOkf(record, previous))
    catalog.records[record.id] = record.revision
  }
  sources(): MemorySource[] { return Object.entries(this.catalog().sources).map(([id, version]) => this.source(id, version)!) }
  records(): MemoryRecord[] { return Object.entries(this.catalog().records).map(([id, version]) => this.record(id, version)!) }
}
