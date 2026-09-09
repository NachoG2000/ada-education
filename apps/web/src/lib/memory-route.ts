export const MEMORY_SECTIONS = ["knowledge", "operations", "learners", "sources", "review"] as const
export type MemorySection = (typeof MEMORY_SECTIONS)[number]

export function parseMemorySearch(search: Record<string, unknown>): { record?: string; source?: string; version?: number; section?: MemorySection } {
  const version = Number(search.version)
  return {
    record: typeof search.record === "string" ? search.record : undefined,
    source: typeof search.source === "string" ? search.source : undefined,
    version: Number.isSafeInteger(version) && version > 0 ? version : undefined,
    section: MEMORY_SECTIONS.includes(search.section as MemorySection) ? search.section as MemorySection : undefined,
  }
}
