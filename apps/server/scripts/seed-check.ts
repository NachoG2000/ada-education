/* Seeds the course into a temp DB and checks what the snapshot must contain for
   the demo (spec AC-1): modules 01–03 ready with cards, the assignment, Sofia's
   feedback, and the prior conversation in `sofia-ada` and `#teachers`.
   Run: `npm run check:seed -w @ada/server`. Never touches the real DB. */

import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { getCommunitySnapshot, openDatabase } from "../src/db.js"
import { seedCourse } from "../src/seed.js"
import { makeHarness } from "./lib.js"

const { check, finish } = makeHarness()

const scratch = mkdtempSync(join(tmpdir(), "ada-seed-check-"))
const dbPath = join(scratch, "seed.db")
try {
  seedCourse({ dbPath })
  seedCourse({ dbPath }) // idempotent: the second run must change nothing below
  const db = openDatabase(dbPath)
  const s = getCommunitySnapshot(db)
  db.close()

  for (const key of ["modules", "assignments", "feedback", "reports"] as const) check(Array.isArray(s[key]), `snapshot has ${key}[]`)
  const byId = (id: string) => s.modules.find((m) => m.id === id)
  for (const id of ["01-perceptron", "02-mlp", "03-backprop"]) {
    const m = byId(id)
    check(!!m && m.status === "ready" && m.cardIds.length >= 2 && m.cardIds.every((c) => s.cards.some((card) => card.id === c)), `module ${id} is ready with ≥2 resolving cards`)
    check(!!m && s.channels.some((c) => c.id === m.channelId), `module ${id} links to an existing channel`)
    check(!!m && m.materials.length >= 1, `module ${id} has material`)
  }
  const a = s.assignments.find((x) => x.moduleId === "03-backprop")
  check(!!a, "an assignment on 03-backprop")
  const f = s.feedback.find((x) => x.studentId === "sofia" && x.assignmentId === a?.id)
  check(!!f && f.gaps.some((g) => g.moduleId === "03-backprop" && g.cardId && s.cards.some((c) => c.id === g.cardId)), "Sofia's feedback on it with a gap pointing at a 03-backprop card")
  check(!!f && /^\d{4}-\d{2}-\d{2}T/.test(f.at), "feedback.at is an ISO timestamp (ago resolved)")
  check(s.messages.filter((m) => m.channelId === "sofia-ada").length >= 2, "prior messages in sofia-ada")
  check(s.messages.filter((m) => m.channelId === "teachers").length >= 2, "prior messages in #teachers")
  check(s.messages.some((m) => m.paragraphs.some((p) => p.some((b) => b.kind === "cite" && s.cards.some((c) => c.id === b.cite.cardId)))), "seeded messages carry resolving citations")
  check(s.messages.some((m) => m.fromCard && s.cards.some((c) => c.id === m.fromCard?.cardId)), "a seeded answer carries the 'from the file' seal")
  check(s.cards.filter((c) => c.authorId === "ada").every((c) => c.path && c.id === `card:ada:${c.path}`), "Ada's seeded cards have deterministic ids and paths")
  check(s.cards.every((c) => c.state !== "updated"), "re-seeding doesn't mark cards as updated")
  const priv = s.channels.filter((c) => c.group === "private")
  check(priv.length >= 3 && priv.every((c) => c.memberIds.length === 2 && c.memberIds.includes("ada")), "private channels hold exactly the student and Ada")
  check(s.channels.find((c) => c.id === "teachers")?.memberIds.every((id) => ["martin", "ada"].includes(id)) ?? false, "#teachers holds only Martin and Ada")
  const r = s.reports[0]
  check(Boolean(r && r.status === "reconciled" && r.reconciled?.cardId && s.cards.some((c) => c.id === r.reconciled?.cardId)), "a reconciled report pointing at its decision card")
  const dangling = [
    ...s.messages.filter((m) => !s.members.some((x) => x.id === m.authorId) || !s.channels.some((c) => c.id === m.channelId)).map((m) => `message ${m.id}`),
    ...s.feedback.filter((x) => !s.members.some((m) => m.id === x.studentId) || !s.assignments.some((y) => y.id === x.assignmentId)).map((x) => `feedback ${x.id}`),
    ...s.reports.filter((x) => !s.members.some((m) => m.id === x.studentId) || !s.modules.some((m) => m.id === x.moduleId)).map((x) => `report ${x.id}`),
  ]
  check(dangling.length === 0, `no dangling references (${dangling.join(", ") || "none"})`)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

finish("Seed OK")
