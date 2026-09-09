import { z } from "zod"
import { memoryJobSchema, memoryRecordSchema, memorySnapshotSchema, memorySourceSchema, type MemoryScope } from "@ada/protocol"
import { request } from "./hosted-api"

export function memoryClient(server: string, token: string, communityId: string) {
  const base = `/api/communities/${encodeURIComponent(communityId)}/memory`
  const call = (path: string, method = "GET", body?: unknown) => request<unknown>(server, base + path, token, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const download = async (path: string, filename: string) => {
    const response = await fetch(`${server}${base}${path}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error("This file is no longer available. Refresh the page and try again.")
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement("a")
    link.href = url; link.download = filename; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
  return {
    snapshot: () => call("").then((value) => memorySnapshotSchema.parse(value)),
    jobs: () => call("/jobs").then((value) => z.array(memoryJobSchema).parse(value)),
    retry: (id: string) => call(`/jobs/${encodeURIComponent(id)}/retry`, "POST"),
    source: (id: string, version?: number) => call(`/sources/${encodeURIComponent(id)}${version ? `?version=${version}` : ""}`).then((value) => z.object({ source: memorySourceSchema, text: z.string() }).parse(value)),
    upload: (file: File, metadata: { title: string; scope: MemoryScope; sourceId?: string; expectedVersion?: number; origin?: "material" | "legacy" }) => {
      const form = new FormData(); form.set("file", file); form.set("metadata", JSON.stringify(metadata))
      return request<unknown>(server, base + "/sources", token, { method: "POST", body: form, signal: AbortSignal.timeout(60000) }).then((value) => z.object({ source: memorySourceSchema }).parse(value))
    },
    review: (id: string, expectedRevision: number, decision: "accept" | "reject", note: string, body?: string) => call(`/records/${encodeURIComponent(id)}/review`, "POST", { expectedRevision, decision, note, body }).then((value) => z.object({ record: memoryRecordSchema }).parse(value)),
    history: (id: string) => call(`/records/${encodeURIComponent(id)}/history`).then((value) => z.object({ records: z.array(memoryRecordSchema) }).parse(value)),
    revoke: (id: string, expectedVersion: number) => call(`/sources/${encodeURIComponent(id)}/revoke`, "POST", { expectedVersion }),
    downloadSource: (id: string, filename: string, version?: number) => download(`/sources/${encodeURIComponent(id)}/raw${version ? `?version=${version}` : ""}`, filename),
    downloadRecord: (id: string) => download(`/records/${encodeURIComponent(id)}/okf`, `${id}.md`),
  }
}
export type MemoryClient = ReturnType<typeof memoryClient>
