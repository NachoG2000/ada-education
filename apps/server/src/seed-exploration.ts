import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { basename, dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type { DatabaseSync } from "node:sqlite"
import { openDatabase, repoRoot } from "./db.js"
import { CourseMemory } from "./memory.js"
import { createTenantAgentDm, createTenantChannel, createTenantCommunity, createTenantInvite, createTenantMessage, createTenantUser, listTenantAgents, redeemTenantInvite } from "./tenant.js"
import type { MemoryProposal, MemoryRecord, MemoryScope, MemorySource } from "@ada/protocol"

export type ExplorationSeed = { version: 1; createdAt: string; accounts: Array<{ name: string; userId: string; token: string; role: string }>; courses: Array<{ id: string; name: string; channelId: string; teacherDmId: string; learnerDmId: string; cases: Record<string, string> }> }

export function seedExploration(db: DatabaseSync, accountsPath: string): ExplorationSeed {
  if (existsSync(accountsPath)) {
    const previous = JSON.parse(readFileSync(accountsPath, "utf8")) as ExplorationSeed
    if (previous.version === 1 && previous.courses.every((course) => db.prepare("SELECT 1 FROM tenant_communities WHERE id = ?").get(course.id))) return previous
    throw new Error("The exploration account manifest belongs to a different database. Use a new manifest path or explicitly reset the exploration data.")
  }
  const main = createTenantUser(db, "Nacho")
  const faculty = createTenantUser(db, "Maya Rivera")
  const learners = ["Alex Chen", "Sofia Morales", "Sam Taylor", "Jordan Lee"].map((name) => createTenantUser(db, name))
  const result: ExplorationSeed = { version: 1, createdAt: new Date().toISOString(), accounts: [main, faculty, ...learners].map((account, index) => ({ name: account.user.displayName, userId: account.user.id, token: account.token, role: index < 2 ? "teacher" : "student" })), courses: [] }
  const at = (days: number, hour = 16) => { const date = new Date(); date.setUTCDate(date.getUTCDate() + days); date.setUTCHours(hour, 0, 0, 0); return date.toISOString() }
  const definitions = [
    { name: "Thinking in Code", file: "recursion.md", channel: "recursion-lab", concept: "base-case", conceptTitle: "A base case stops recursion", quote: "The base case returns an answer without making another recursive call.", body: "A base case answers the smallest subproblem directly. The recursive step must move toward it. These are two separate conditions for a recursive solution to finish.", example: "factorial", exampleQuote: "For factorial over nonnegative integers, factorial(0) = 1", exampleBody: "For factorial, 0 is the stopping input and 1 is its result. Trace factorial(3) down to factorial(0), then combine the returned results upward.", variant: "A two-column call trace", variantQuote: "When learners confuse calls with returned values, draw two columns.", variantBody: "Use one column for the calls and a second for returned values. Fill the return column from the bottom up. This makes the waiting multiplication visible.", doubt: "I can copy the factorial code, but I do not understand why we return 1 when n is zero.", success: "Now I see it: factorial(0) returns 1 without another call. The waiting multiplication uses that result as the recursion unwinds.", progress: "Alex distinguishes the stopping condition from the returned value and explains how it composes in factorial. This supports understanding in this exercise, not every recursive algorithm.", next: "I understand factorial now. With a binary tree, why is stack depth different from the total number of nodes?", nextConcept: "recursion-stack", peer: "I keep mixing up the order of calls and returned values." },
    { name: "Data for Decisions", file: "data-decisions.md", channel: "experiment-clinic", concept: "rates-and-denominators", conceptTitle: "Compare rates with their denominators", quote: "The denominators must be visible when comparing rates.", body: "A count measures how many successes occurred. A rate relates successes to opportunities. Include both denominators when comparing groups of different sizes.", example: "The sign-up experiment", exampleQuote: "20/100 = 20%, compared with 30/200 = 15% for B.", exampleBody: "A has 20 sign-ups from 100 visitors; B has 30 from 200. B has more sign-ups, while A has the higher observed rate. Neither comparison alone establishes a population-level effect.", variant: "Equal groups of 100", variantQuote: "Translate the café example into groups of 100 people.", variantBody: "Express both rates per 100 visitors, then restore the original group sizes. Ask which comparison answers the decision being made.", doubt: "Variant B has 30 sign-ups and A has 20, so is B definitely better?", success: "I forgot the denominators. A is 20 out of 100, or 20%. B is 30 out of 200, or 15%. A has the higher observed rate, although that alone does not prove it will win again.", progress: "Alex now separates absolute counts from observed rates and includes denominators. Their final qualification suggests awareness of uncertainty, but it does not demonstrate a full understanding of experimental design.", next: "If our visitors chose which variant to see, can we still attribute the difference to the design?", nextConcept: "random-assignment", peer: "Would collecting twice as many morning café responses eliminate the bias?" },
  ]
  for (const definition of definitions) {
    const course = createTenantCommunity(db, main.user.id, definition.name, "September cohort · Exploration")
    for (const account of [faculty, ...learners]) {
      const invite = createTenantInvite(db, course.id, main.user.id, account === faculty ? "teacher" : "student", "single-use", 1)
      redeemTenantInvite(db, invite.code, account.user.id)
    }
    const agents = listTenantAgents(db, course.id, main.user.id)
    const ada = agents.find((agent) => agent.systemRole === "ada")!
    const memberIds = [faculty, ...learners].map((account) => account.user.id)
    const general = createTenantChannel(db, course.id, main.user.id, { name: "course-lobby", description: "Announcements and questions about the cohort.", memberIds, agentIds: [ada.id] })
    const channel = createTenantChannel(db, course.id, main.user.id, { name: definition.channel, description: "Compare explanations, ask questions and work through examples.", memberIds, agentIds: [ada.id] })
    createTenantChannel(db, course.id, main.user.id, { name: "teaching-room", description: "Private coordination for the teaching team.", visibility: "private", memberIds: [faculty.user.id], agentIds: [ada.id] })
    const teacherDm = createTenantAgentDm(db, course.id, main.user.id, ada.id)
    const learnerDm = createTenantAgentDm(db, course.id, learners[0]!.user.id, ada.id)
    const peerDm = createTenantAgentDm(db, course.id, learners[1]!.user.id, ada.id)
    const memory = new CourseMemory(db, course.id)
    const teacherAudience = { ...memory.actor(main.user.id), agentId: ada.id }
    const studentAudience = { ...memory.actor(learners[0]!.user.id), agentId: ada.id, channelId: learnerDm.id }
    const bytes = readFileSync(new URL(`../fixtures/${definition.file}`, import.meta.url))
    const source = memory.ingest(main.user.id, { title: `${definition.name} · Study guide`, filename: definition.file, mediaType: "text/markdown", raw: bytes, text: bytes.toString(), scope: { kind: "course" } })
    const evidence = (item: MemorySource, quote: string) => [{ sourceId: item.id, version: item.version, quote }]
    const knowledge = (title: string, kind: MemoryProposal["kind"], body: string, quote: string, relations: MemoryProposal["relations"] = []) => memory.propose(teacherAudience, { title, kind, body, scope: { kind: "course" }, concept: definition.concept, evidence: evidence(source, quote), relations })
    const concept = knowledge(definition.conceptTitle, "concept", definition.body, definition.quote)
    const example = knowledge(definition.example, "example", definition.exampleBody, definition.exampleQuote, [{ kind: "supports", recordId: concept.id }])
    const variant = knowledge(definition.variant, "example", definition.variantBody, definition.variantQuote, [{ kind: "refines", recordId: example.id }, { kind: "supports", recordId: concept.id }])
    const message = (userId: string, channelId: string, text: string, when: string) => {
      const created = createTenantMessage(db, course.id, userId, channelId, { text })
      db.prepare("UPDATE tenant_messages SET created_at = ? WHERE id = ?").run(when, created.id)
      return memory.captureMessage(created.id)!
    }
    message(main.user.id, general.id, `Welcome to ${definition.name}. The study guide is in Course memory. Use this space to compare reasoning and make questions visible.`, at(-14))
    message(faculty.user.id, channel.id, "When you share a solution, explain one step that changed your understanding. A correct answer and a clear explanation give us different evidence.", at(-13))
    const learnerScope: MemoryScope = { kind: "learner", learnerId: learners[0]!.user.id }
    const first = message(learners[0]!.user.id, learnerDm.id, definition.doubt, at(-12))
    const doubt = memory.propose(studentAudience, { title: `An open question about ${definition.concept}`, kind: "question", body: definition.doubt, scope: learnerScope, concept: definition.concept, module: "Module 1", occurredAt: at(-12), evidence: evidence(first, definition.doubt) })
    const later = message(learners[0]!.user.id, learnerDm.id, definition.success, at(-3))
    const observation = memory.propose(studentAudience, { title: "Explains the idea in a new attempt", kind: "observation", body: definition.success, scope: learnerScope, concept: definition.concept, module: "Module 2", occurredAt: at(-3), evidence: evidence(later, definition.success), relations: [{ kind: "supports", recordId: concept.id }] })
    const progress = memory.propose(studentAudience, { title: "Evidence of progress in this exercise", kind: "inference", body: definition.progress, scope: learnerScope, concept: definition.concept, module: "Module 2", occurredAt: at(-3), evidence: evidence(later, definition.success), relations: [{ kind: "resolves", recordId: doubt.id }, { kind: "supports", recordId: observation.id }] })
    const nextSource = message(learners[0]!.user.id, learnerDm.id, definition.next, at(-1))
    const next = memory.propose(studentAudience, { title: "A new question to work on", kind: "question", body: definition.next, scope: learnerScope, concept: definition.nextConcept, module: "Module 3", occurredAt: at(-1), evidence: evidence(nextSource, definition.next) })
    const peer = message(learners[1]!.user.id, peerDm.id, definition.peer, at(-2))
    memory.propose({ ...memory.actor(learners[1]!.user.id), agentId: ada.id, channelId: peerDm.id }, { title: "A different learner, a different question", kind: "question", body: definition.peer, scope: { kind: "learner", learnerId: learners[1]!.user.id }, concept: definition.concept, module: "Module 2", occurredAt: at(-2), evidence: evidence(peer, definition.peer) })
    const rumorText = "I heard the workshop moved to tomorrow. Can someone confirm?"
    const rumorSource = message(learners[2]!.user.id, general.id, rumorText, at(-1, 10))
    const rumor = memory.propose({ ...memory.actor(learners[2]!.user.id), agentId: ada.id, channelId: general.id }, { title: "Unconfirmed workshop change", kind: "event", body: "A learner reports a possible change to tomorrow; the teaching team has not confirmed it.", concept: "workshop-date", scope: { kind: "channel", channelId: general.id }, uncertainty: "The source is learner hearsay.", evidence: evidence(rumorSource, rumorText) })
    const officialText = `Confirmed: the next workshop is ${at(4)}. Bring one worked example and one open question.`
    const official = message(main.user.id, general.id, officialText, at(0, 9))
    const event = memory.propose({ ...teacherAudience, channelId: general.id }, { title: "Next workshop", kind: "event", body: officialText, scope: { kind: "channel", channelId: general.id }, concept: "workshop-date", staleAfter: at(4, 18), occurredAt: at(0, 9), evidence: evidence(official, officialText) })
    const expiredText = `The orientation session is ${at(-10)}.`
    const expiredSource = message(main.user.id, general.id, expiredText, at(-13))
    memory.propose({ ...teacherAudience, channelId: general.id }, { title: "Cohort orientation", kind: "event", body: expiredText, scope: { kind: "channel", channelId: general.id }, concept: "orientation", staleAfter: at(-10, 18), occurredAt: at(-13), evidence: evidence(expiredSource, expiredText) })
    const mistaken = memory.propose(studentAudience, { title: "An interpretation that needs qualification", kind: "inference", body: "Alex may now be comfortable applying this idea to any new problem.", scope: learnerScope, concept: definition.concept, module: "Module 2", occurredAt: at(-2), evidence: evidence(later, definition.success) })
    const correction = memory.propose(studentAudience, { title: "Limit the conclusion to observed evidence", kind: "inference", body: "The successful explanation supports this exercise only. The learner's new question shows that transfer to a different setting is still being explored.", scope: learnerScope, concept: definition.concept, module: "Module 3", occurredAt: at(-1), evidence: evidence(nextSource, definition.next), relations: [{ kind: "corrects", recordId: mistaken.id }] })
    const reviewed: MemoryRecord = memory.review(main.user.id, correction.id, { expectedRevision: 1, decision: "accept", note: "Keep the successful explanation, but narrow the claim. New contexts need their own evidence." })
    result.courses.push({ id: course.id, name: course.name, channelId: channel.id, teacherDmId: teacherDm.id, learnerDmId: learnerDm.id, cases: { concept: concept.id, example: example.id, variant: variant.id, earlyQuestion: doubt.id, progress: progress.id, newQuestion: next.id, review: rumor.id, upcoming: event.id, correction: reviewed.id } })
  }
  mkdirSync(dirname(accountsPath), { recursive: true, mode: 0o700 })
  writeFileSync(accountsPath, JSON.stringify(result, null, 2), { mode: 0o600, flag: "wx" })
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dbPath = resolve(repoRoot, process.env.ADA_DB ?? "apps/server/data/ada.db")
  const accountsPath = resolve(repoRoot, process.env.ADA_EXPLORATION_ACCOUNTS ?? ".ada/exploration-accounts.json")
  if (process.argv.includes("--reset")) {
    if (basename(dbPath) !== "ada.db" && !process.env.ADA_DB) throw new Error("Choose an explicit database path before resetting")
    // The caller must stop the local app first. Never stop unknown processes here.
    for (const path of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}.memory`, accountsPath]) rmSync(path, { recursive: true, force: true })
  }
  const db = openDatabase(dbPath)
  try {
    const seeded = seedExploration(db, accountsPath)
    console.log(`Exploration ready: ${seeded.courses.map((course) => course.name).join(", ")}.`)
    console.log(`Account keys and course links are in ${accountsPath}. Keys are not printed or served by the app.`)
  } finally { db.close() }
}
