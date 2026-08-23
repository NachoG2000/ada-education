# Teacher modules, student progress and agent reports (hackathon demo flow)

## Request

> Build the hackathon demo flow for Ada (one teacher, fully local, everything mocked but convincing):
> (1) Teacher (Martin) loads modules and study material on a dedicated full page, with a difficulty level adapted to the course and its students; the course agent (Ada) derives the adequate study plan from the material plus student context.
> (2) Student (Sofia) logs in and sees the agent's feedback on her last assignment; if she failed module X she can learn that module; she asks the agent how to advance and prioritize in module X and gets a plan.
> (3) The agent notifies the teacher what it told the student and what it recommended.
> (4) The teacher sees that report and reconciles it, improving the subject without leaving its learning goals.
> Mock: pressing Enter must produce a context-aware scripted agent response with a realistic delay, and prior seeded conversation so it doesn't feel empty or hardcoded.

## Goal

Two new full-page views inside the existing shell (sidebar + floating panels) and one new agent behaviour, all running on the real local server and the real runner protocol, so that the demo never shows a canned string:

- **Teacher → Modules** (`#modules`, teacher only): the course's modules with their study material, a difficulty level calibrated to the cohort with Ada's stated rationale, the cards Ada compiled from the material, and Ada's reports about students with a "reconcile" action.
- **Student → My study** (`#home`, student only): Ada's feedback on the last assignment (score, what went well, where it slipped and in which module, next steps with citations), the module list with the slipped module marked and openable, and a private conversation with Ada where pressing Enter on "how do I get ahead in 03-backprop?" returns a prioritized plan built from the module's cards, the student's feedback and the module's difficulty — with a visible line that Ada shared a summary with the teacher.
- **Scripted runtime**: `ada-runner --runtime scripted` answers mentions from templates filled with live community state (module titles, material names, the student's feedback gaps, the difficulty level), with a thinking delay, writes wiki files so cards publish through the real pipeline, and files a report to the teacher after a study-plan conversation.

Terminology added to the product (English, fixed): **module**, **material**, **difficulty** (intro · core · advanced), **feedback**, **report**, **reconcile**.

## Acceptance Criteria

- [ ] [AC-1] `GET /api/community` returns `modules`, `assignments`, `feedback` and `reports` arrays seeded from `data/neural-networks-2026/community.json`; the seed contains at least 3 modules (01-perceptron, 02-mlp, 03-backprop), 1 assignment on 03-backprop, 1 feedback for Sofia on that assignment, prior messages in the private channel `sofia-ada` and in `#teachers`, and compiled cards for modules 01–03.
- [ ] [AC-2] `POST /api/modules/:id/materials` with `{name, kind, size, text}` stores the file under `data/<course>/raw/martin/modules/<nn>-<slug>/<name>`, records the material, sets the module `status` to `compiling`, broadcasts `module.updated`, and triggers an `agent.mention` (`ingest` intent) to Ada's runner for the module's channel.
- [ ] [AC-3] `PATCH /api/modules/:id` accepts `{difficulty: {level, rationale?}}` and `{objectives}`; the change is broadcast as `module.updated` and is visible to every connected client without reload.
- [ ] [AC-4] `POST /api/reports/:id/reconcile` with `{accepted: string[], note: string}` publishes a `decision` card in the module's channel authored by the teacher (title `<module> · revision after <assignment>`, body listing the accepted recommendations and the note), sets the report `status` to `reconciled` with the note, and broadcasts `card.published` and `report.updated`.
- [ ] [AC-5] The runner accepts `--runtime scripted`: on a mention it announces `thinking`, waits 1.2–2.5 s, and answers from templates filled with live state; an `ingest` mention for a module writes one `topic` card per material section under `wiki/modules/<nn>-<slug>/` (published through the existing diff → `card.publish` path) and sets the module to `ready` with a suggested difficulty via `module.suggest`; a study-plan mention from a student in their private channel answers with a prioritized plan that cites at least two cards of the named module and mentions the student's feedback gap, then posts a report (`report.create`) and a message in `#teachers`.
- [ ] [AC-6] Role gating: `Person.role` decides the home view. Martin sees "Modules" in the sidebar and `#home` redirects him to `#modules`; Sofia sees "My study" and `#modules` redirects her to `#home`. The sidebar footer offers "Switch person", which clears the stored identity and returns to the picker.
- [ ] [AC-UI-1] [UI] As Martin, `#modules` shows the module list (number, title, status pill, difficulty, card count) and, for the selected module, its objectives, difficulty control (Intro · Core · Advanced) with Ada's rationale and cohort evidence, its materials, its compiled cards (opening one shows it in the context panel) and its reports.
- [ ] [AC-UI-2] [UI] As Martin, dropping or choosing a markdown/PDF/slides file on a module shows it in the material list immediately, flips the module to "compiling" with Ada's presence "publishing a card", and within 6 s new cards appear in the module (the newest in full yellow) and the module reads "ready" with a suggested difficulty the teacher can accept or change.
- [ ] [AC-UI-3] [UI] As Sofia, `#home` shows the feedback on "Assignment 2 · Backprop by hand" (score, strengths, the slipped module 03-backprop, next steps with citation pills that open cards), the module list with 03 marked "slipped · learn it" linking to its cards, and the private conversation with Ada with prior seeded messages.
- [ ] [AC-UI-4] [UI] As Sofia, pressing Enter on the suggested question "How do I get ahead in 03-backprop?" shows Ada thinking, then a plan message with at least two citation pills and a line "Ada shared a summary of this plan with Martin"; the message is persisted (visible after reload).
- [ ] [AC-UI-5] [UI] As Martin, after Sofia's conversation, `#modules` shows a new report on 03-backprop ("What I told Sofia", "What I recommend for the module" as checkable items) and `#teachers` shows Ada's message; choosing recommendations, writing a note and pressing "Apply to module" publishes the decision card in `#03-backprop` (visible in the channel's card row) and marks the report "reconciled".
- [ ] [AC-7] `npm run typecheck`, `npm run check -w @ada/server`, `npm run lint` (no new warnings) and `npm run build` pass; `npx tsx apps/server/scripts/smoke.ts` passes against a seeded server.
- [ ] [AC-8] Documentation lands in the repo in the same change: `DECISIONS.md` gains a dated §16 (per-student report with student-visible transparency; scripted runtime as a runner runtime, not a UI mock), `PRODUCT.md` gains the new terminology and the two views, and the `AGENTS.md` of `apps/web`, `apps/server`, `packages/runner` and `data` describe the additions.

## Scope

- `packages/protocol`: `Module`, `Material`, `Assignment`, `Feedback`, `Report` types on `Community`; new server events `module.updated`, `feedback.created`, `report.updated`; new runner messages `module.suggest`, `report.create`; the `agent.mention` payload carries an optional `intent` (`ingest | plan | question`) and `moduleId`.
- `apps/server`: tables `modules`, `materials`, `assignments`, `feedback`, `reports`; seed of the new keys plus seeded `messages` and `cards`; routes `POST /api/modules/:id/materials`, `PATCH /api/modules/:id`, `POST /api/reports/:id/reconcile`; WS handling of the new runner messages; `npm run dev` starts the scripted runner by default (`ADA_RUNTIME=claude` switches back).
- `packages/runner`: `--runtime scripted` (`src/runtimes/scripted.ts`), templates in `src/runtimes/script/`, the ingest/plan/question intents, report posting.
- `apps/web`: `#modules` and `#home` views in the shell, sidebar entries by role, "Switch person", `api.ts` client additions and reducer cases, `Composer` bound to an explicit channel, new components under `src/components/ada/` (`modules`, `study`, `report`).
- `data/neural-networks-2026`: modules 01–03 with material files under `raw/martin/modules/`, compiled cards under `agents/ada/wiki/modules/`, the assignment, Sofia's feedback, the `#teachers` and `sofia-ada` channels, prior messages.
- Docs listed in AC-8.

## Non-goals

- No real model calls in the demo path (the `claude` runtime stays available and untouched).
- No grading engine, no permissions model, no notifications system beyond the `#teachers` message and the report list, no multi-course, no mobile, no PDF parsing (a PDF's text is taken from the upload's `text` field when present, otherwise the material name seeds the cards).
- No per-student algorithmic personalization of content: the plan is composed from the module's cards and the student's own feedback, and the report to the teacher is a recommendation about the module, not a transcript or a profile (`PROBLEM.md` §9).
- No edits to the discarded design mockups or the `docs/*.html` inspiration pages.

## Risks

- Product rule tension: `docs/usecases-api.html` UC8 keeps teacher-facing signals aggregate. Mitigation: the report is visible to the student on her own screen ("Ada shared a summary with Martin") and contains Ada's recommendation, not her words verbatim; recorded as a decision in `DECISIONS.md` §16.
- The runner commits inside the agent folder on every run; seeded wiki cards must be present before the first run so the diff only picks up new files.
- `useCommunity()` lookups throw on unknown ids: every new seeded id must resolve (modules ↔ channels, feedback ↔ assignment ↔ module, reports ↔ module/student).
- Timing: the UI criteria assume the scripted runner is connected; if it isn't, the mention is dropped silently by the server. The Modules page shows Ada's presence so the demo operator can see it.

## Verification

- Static: `npm run typecheck`, `npm run check -w @ada/server`, `npm run lint`, `npm run build`.
- Runtime: `npm run seed && npm run dev:server`, `npx tsx apps/server/scripts/smoke.ts`; `npm run runner` (scripted) connected; REST checks with `curl` for AC-2/3/4.
- Browser (real browser, screenshots): AC-UI-1..5 as Martin and as Sofia on http://localhost:5173, plus a reload after AC-UI-4 to prove persistence.

## Capability Deltas

See `deltas/course-modules.md`, `deltas/student-study.md`, `deltas/agent-reports.md`, `deltas/scripted-runtime.md`.
