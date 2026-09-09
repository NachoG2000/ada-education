import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { openDatabase } from "../src/db.js"
import { seedExploration } from "../src/seed-exploration.js"
import { CourseMemory } from "../src/memory.js"
import { claimMemoryWork, queueMemoryMessage } from "../src/memory-jobs.js"
import { createTenantMessage, listTenantAgents } from "../src/tenant.js"

const directory = mkdtempSync(join(tmpdir(), "ada-exploration-check-"))
const db = openDatabase(join(directory, "test.db"))
try {
  const accounts = join(directory, "accounts.json")
  const seed = seedExploration(db, accounts)
  assert.equal(seed.courses.length, 2)
  assert.deepEqual(seedExploration(db, accounts), seed, "repeat seeding does not duplicate accounts or courses")
  const teacher = seed.accounts.find((account) => account.name === "Nacho")!
  const learner = seed.accounts.find((account) => account.name === "Alex Chen")!
  for (const course of seed.courses) {
    const memory = new CourseMemory(db, course.id)
    const student = memory.snapshot(memory.actor(learner.userId))
    assert(student.records.some((record) => record.id === course.cases.earlyQuestion && record.state === "resolved"))
    assert(student.records.some((record) => record.id === course.cases.progress && record.state === "current"))
    assert(student.records.some((record) => record.id === course.cases.newQuestion && record.state === "current"))
    assert(student.records.some((record) => record.id === course.cases.correction && record.verified.length === 1))
    assert(!student.records.some((record) => record.scope.kind === "learner" && record.scope.learnerId !== learner.userId))
    const faculty = memory.snapshot(memory.actor(teacher.userId))
    assert(faculty.records.filter((record) => record.kind === "example").length >= 2)
    assert(faculty.records.some((record) => record.state === "needs_review"))
    assert(faculty.records.some((record) => record.state === "expired"))
    const ada = listTenantAgents(db, course.id, teacher.userId).find((agent) => agent.systemRole === "ada")!
    const message = createTenantMessage(db, course.id, learner.userId, course.learnerDmId, { text: "Can we revisit my earlier question and the example that helped?" })
    queueMemoryMessage(db, message)
    const work = claimMemoryWork(db, course.id, ada.id)!
    assert(work.payload.view.records.some((record) => record.id === course.cases.progress), "the seeded evidence feeds real future agent work")
    assert(!JSON.stringify(work).includes(seed.courses.find((item) => item.id !== course.id)!.cases.progress))
  }
  console.log("Exploration seeds OK: two isolated courses, idempotent preload, linked examples, evolving learner evidence, reviewed correction, pending decisions, past events and real follow-up retrieval.")
} finally { db.close(); rmSync(directory, { recursive: true, force: true }) }
