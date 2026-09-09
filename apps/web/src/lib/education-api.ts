import { z } from "zod"
import { artifactSchema, artifactWorkSchema, submissionSchema, inboxReadSchema, type ArtifactWrite, type WorkInput } from "@ada/protocol"
import { request } from "./hosted-api"
const ok = z.object({ ok: z.literal(true) })
export function educationClient(server: string, token: string, communityId: string) {
  const base = `/api/communities/${encodeURIComponent(communityId)}`
  const call = (path: string, method = "GET", body?: unknown) => request<unknown>(server, base + path, token, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const artifact = (id: string) => `/artifacts/${encodeURIComponent(id)}`
  return {
    list: (channelId: string) => call(`/channels/${encodeURIComponent(channelId)}/artifacts`).then((v) => z.array(artifactSchema).parse(v)),
    get: (id: string) => call(artifact(id)).then((v) => artifactSchema.parse(v)),
    versions: (id: string) => call(`${artifact(id)}/versions`).then((v) => z.array(artifactSchema).parse(v)),
    create: (channelId: string, body: ArtifactWrite) => call(`/channels/${encodeURIComponent(channelId)}/artifacts`, "POST", body).then((v) => artifactSchema.parse(v)),
    update: (id: string, body: ArtifactWrite) => call(artifact(id), "PUT", body).then((v) => artifactSchema.parse(v)),
    remove: (id: string) => call(artifact(id), "DELETE").then((v) => ok.parse(v)),
    work: (id: string) => call(`${artifact(id)}/work`).then((v) => artifactWorkSchema.parse(v)),
    saveWork: (id: string, body: WorkInput) => call(`${artifact(id)}/work`, "PUT", body).then((v) => artifactWorkSchema.parse(v)),
    submissions: (id: string) => call(`${artifact(id)}/submissions`).then((v) => z.array(submissionSchema).parse(v)),
    submit: (id: string, version: number) => call(`${artifact(id)}/submissions`, "POST", { version }).then((v) => ok.parse(v)),
    review: (id: string, submissionId: string, feedback: string) => call(`${artifact(id)}/submissions/${encodeURIComponent(submissionId)}`, "PUT", { feedback }).then((v) => ok.parse(v)),
    reads: () => call("/inbox/reads").then((v) => inboxReadSchema.parse(v)),
    setRead: (messageId: string, read: boolean) => call("/inbox/reads", "PUT", { messageId, read }).then((v) => ok.parse(v)),
  }
}
export type EducationClient = ReturnType<typeof educationClient>
