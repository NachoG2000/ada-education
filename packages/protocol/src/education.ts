import { z } from "zod"
const id = z.string().min(1).max(200)
export const artifactContentSchema = z.object({
  title: z.string().trim().min(1).max(160),
  kind: z.enum(["guide", "explanation", "practice", "assignment"]),
  summary: z.string().trim().max(500).default(""),
  body: z.string().max(80_000).default(""),
  objectives: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  prompts: z.array(z.object({ id, text: z.string().trim().min(1).max(4000), hint: z.string().max(4000).default("") }).strict()).max(30).default([]),
  dueAt: z.string().datetime().nullable().default(null),
}).strict().refine((value) => new Set(value.prompts.map((prompt) => prompt.id)).size === value.prompts.length, "Prompt IDs must be unique").refine((value) => !["practice", "assignment"].includes(value.kind) || value.prompts.length > 0, "Practice and assignments need at least one question")
export const artifactSchema = z.object({
  id, communityId: id, channelId: id, authorId: id,
  version: z.number().int().positive(), content: artifactContentSchema,
  createdAt: z.string(), updatedAt: z.string(),
}).strict()
export const artifactWriteSchema = z.object({ content: artifactContentSchema, version: z.number().int().positive().optional() }).strict()
export const workInputSchema = z.object({ answers: z.record(id, z.string().max(20_000)), version: z.number().int().nonnegative(), artifactVersion: z.number().int().positive() }).strict().refine((value) => Object.keys(value.answers).length <= 30, "Too many answers")
export const artifactWorkSchema = z.object({ artifactId: id, userId: id, answers: z.record(z.string(), z.string()), version: z.number().int(), artifactVersion: z.number().int(), updatedAt: z.string().nullable() }).strict()
export const submissionSchema = z.object({ id, artifactId: id, userId: id, displayName: z.string(), artifactVersion: z.number().int(), answers: z.record(z.string(), z.string()), createdAt: z.string(), feedback: z.string(), reviewedAt: z.string().nullable() }).strict()
export const inboxReadSchema = z.array(z.string())
export type ArtifactContent = z.infer<typeof artifactContentSchema>
export type CourseArtifact = z.infer<typeof artifactSchema>
export type ArtifactWork = z.infer<typeof artifactWorkSchema>
export type ArtifactSubmission = z.infer<typeof submissionSchema>
export type ArtifactWrite = z.infer<typeof artifactWriteSchema>
export type WorkInput = z.infer<typeof workInputSchema>
