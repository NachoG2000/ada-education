/* Small formatters shared by the teacher's Modules page and the student's
   study page, so the two screens never disagree on wording. */

import type { DifficultyLevel } from "./types"

/** UI label per difficulty level (PRODUCT.md: intro · core · advanced). */
export const LEVEL_LABEL: Record<DifficultyLevel, string> = { intro: "Intro", core: "Core", advanced: "Advanced" }

/** "just now" · "N min ago" · "N h ago" · "yesterday" · "N days ago". */
export function formatAgo(iso: string, now: Date): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return "recently"
  const minutes = Math.round((now.getTime() - t) / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? "yesterday" : `${days} days ago`
}
