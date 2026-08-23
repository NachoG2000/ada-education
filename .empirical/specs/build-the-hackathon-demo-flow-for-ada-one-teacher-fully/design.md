# Design: Teacher modules, student progress and agent reports

Decisions: `decisions.md` D-001 (scripted runtime in the runner), D-002 (transparent per-student report), D-003 (hash views in the shell). Everything below is in English and follows `DESIGN.md` ("The card file") and `AGENTS.md`.

## 1. Protocol (`packages/protocol/src/types.ts`, `events.ts`)

```ts
export type DifficultyLevel = "intro" | "core" | "advanced"
export type ModuleStatus = "empty" | "compiling" | "ready"
export interface Material { id: string; name: string; kind: "markdown" | "pdf" | "slides" | "link"; size?: number; path: string; uploadedAt: string }
export interface Difficulty { level: DifficultyLevel; rationale?: string; evidence?: string[]; suggestedBy?: string; setBy?: string }
export interface Module {
  id: string; index: number; slug: string; title: string; summary: string; channelId: string
  objectives: string[]; difficulty: Difficulty; status: ModuleStatus; materials: Material[]
  cardIds: string[]            // computed by the server: cards in the module's channel, newest last
  revision?: string            // one line, set by reconcile
}
export interface Assignment { id: string; moduleId: string; channelId: string; title: string; due: string; status: WorkStatus }
export interface Feedback {
  id: string; assignmentId: string; studentId: string; agentId: string; at: string
  score: { got: number; of: number }; summary: string; strengths: string[]
  gaps: Array<{ moduleId: string; note: string; cardId?: string }>
  nextSteps: Array<{ text: string; cardId?: string }>
}
export interface Report {
  id: string; agentId: string; studentId: string; moduleId: string; assignmentId?: string; at: string
  told: string; recommendations: Array<{ id: string; text: string }>; cardIds: string[]
  status: "new" | "reconciled"
  reconciled?: { at: string; by: string; accepted: string[]; note: string; cardId: string }
}
// Community gains: modules: Module[]; assignments: Assignment[]; feedback: Feedback[]; reports: Report[]
// Card gains: path?: string (the wiki path the server already stores; lets a runtime cite seeded cards)
```

Events (Zod + inferred types; `apps/web/src/lib/api.ts` mirrors them):
- server → web: `module.updated {module}`, `feedback.created {feedback}`, `report.updated {report}`.
- server → runner: `agent.mention` gains `intent?: "ingest" | "plan" | "question"` and `moduleId?: string`.
- runner → server: `module.suggest {ref, payload: {moduleId, status?: "ready", difficulty: {level, rationale, evidence}}}`; `report.create {ref, payload: {studentId, moduleId, assignmentId?, told, recommendations, cardIds}}`. Acks reuse `ack` (+ optional `report`).

The snapshot is the same for every client (there is no auth this weekend); the client filters `feedback`/`reports` by `me`. `demo.ts` gets the four arrays as `[]`.

## 2. Server (`apps/server`)

Schema (`schema.sql`): `modules(id, idx, slug, title, summary, channel_id, objectives JSON, difficulty JSON, status, revision)`, `materials(id, module_id, name, kind, size, path, uploaded_at)`, `assignments(id, module_id, channel_id, title, due, status)`, `feedback(id, assignment_id, student_id, agent_id, at, body JSON)`, `reports(id, agent_id, student_id, module_id, assignment_id, at, body JSON, status, reconciled JSON)`.

Seed (`community.json`, all idempotent upserts by id):
- `modules[]` with `materials[]` (files under `raw/martin/modules/<nn>-<slug>/`), `assignments[]`, `feedback[]`, `reports[]`.
- `messages[]`: `{id, channelId, authorId, ago: "2d" | "3h" | "15m" | ISO at, text, cites?: [{cardPath, label}], threadOf?: messageId}`; text is split into paragraphs on blank lines; `[[path]]` in text becomes a cite block resolved against seeded cards by (authorId ada, path).
- `wikiCards: true` → every `agents/ada/wiki/**/*.md` except index/log is upserted as a card by `ada` into the channel named in its frontmatter `channel:` (default: the module channel for `modules/<nn>-<slug>/…`, `questions` for `questions/…`, `general` otherwise). Frontmatter keys: `title, type (topic|question|decision|difficulty|assignment|submission), channel?, sources?, supersedes?, visibility?`. `publishedAt` from frontmatter `published:` or the seed time minus an offset so seeded cards are not "new".

Routes (`api.ts`):
- `POST /api/modules/:id/materials` `{name, kind, size?, text?, authorId}` → writes `raw/martin/modules/<id>/<name>` (text or a one-line placeholder for binary kinds), inserts material, status `compiling`, broadcast `module.updated`, then `createMessage` in the module channel authored by `authorId`: `@Ada ingest <name> into <module.id>` — the normal mention path fires with `{intent: "ingest", moduleId}`.
- `PATCH /api/modules/:id` `{difficulty?, objectives?, authorId}` → sets `difficulty.setBy = authorId`, broadcast `module.updated`.
- `POST /api/reports/:id/reconcile` `{accepted, note, authorId}` → `publishCard` (type `decision`, channel = module channel, path `martin/decisions/<module>-revision-<assignment>.md`, title `<module.title> · revision after <assignment.title>`), module `revision`, report `reconciled`, broadcast `card.published` + `report.updated` + `module.updated`.
- `GET /api/community` includes the four arrays and `cardIds` per module.

WS (`ws.ts`): `mention(message, hint?)` forwards `intent`/`moduleId`; handle `module.suggest` (only overwrite `level` if `difficulty.setBy` is empty; always store rationale/evidence/suggestedBy; `status: "ready"` when given) and `report.create` (insert, broadcast, ack).

`npm run dev` → runner with `ADA_RUNTIME=${ADA_RUNTIME:-scripted}`.

## 3. Runner (`packages/runner`)

`src/cli.ts`: accept `--runtime scripted`; `refreshMembers()` becomes `refreshSnapshot()` (members + cards with `path` + modules + feedback); dispatch `runtime === "scripted" ? runScripted(job) : runClaude(prompt)`; after the answer is posted, run the runtime's `after()` hook (module.suggest / report.create / extra `message.create`). The diff → `card.publish` path, cites and commit stay as they are; `cardMap` is pre-filled from the snapshot's `path` so `[[path]]` resolves for seeded cards.

`src/runtimes/scripted.ts` — pure functions over `{mention, snapshot, wikiDir, rawDir, agentId}`:
- `detectIntent(mention)`: `ingest` when the hint says so or the text starts with "ingest"; `plan` when the text matches /(get ahead|advance|prioriti|plan|catch up|improve|what should I (do|study))/i and a module is named (by id, slug, index "03", or title) or the private channel + the student's latest feedback gap gives one; otherwise `question`.
- `ingest`: read the material (`rawDir/martin/modules/<id>/<name>`), split on `## ` headings (fallback: three sections "What it is", "How it works", "Where it breaks"), write `wiki/modules/<id>/<slug>.md` per section (frontmatter `type: topic`, `sources: [raw/...]`), answer: "Filed N cards from <name> into <module>: …" listing `[[path]]`; `after`: `module.suggest` with a level chosen from the material (length, presence of "matrix"/"derivative"/"proof" → core/advanced; else intro) and evidence from feedback gaps on that module ("2 of 3 students slipped on σ′ in Assignment 2").
- `plan`: find the student's feedback gap for the module; steps: (1) the gap card, (2) the scalar walkthrough / next cards in module order, (3) the vectorized/advanced card, (4) redo the assignment exercise; write `wiki/questions/plan-<student>-<module>.md` (type `question`, title "Plan for <student>: get ahead in <module>"); answer = intro naming the gap + numbered steps with `[[path]]` + closing line "I shared a summary of this plan with <teacher>, so the module can improve too."; `after`: `report.create` (told = the steps in one paragraph; recommendations = 3 items derived from the gap, e.g. "Add a worked scalar example before the vectorized form", "State σ′ explicitly in the chain-rule card", "Mark partial derivatives as a prerequisite of 03") and a `message.create` in `#teachers` citing the plan card.
- `question`: match words against card titles of the mentioned module (or all); answer with one or two `[[path]]` ("This is in the card file: …"); no match → "I checked <modules> and found nothing on that yet — ask with the module name or a card title and I'll file it."
- Delay: `thinking` 1.2–2.5 s (seeded PRNG on message id so reruns are stable), `publishing` while writing.

## 4. Web (`apps/web`)

- `App.tsx`: `view(hash)` → `"modules" | "home" | "channel"`; `ChannelScreen` gets `view`; inside, `me.role` mismatch → `location.replace(...)`.
- `lib/api.ts`: the three new events in the mirror type and `applyEvent`; `sanitizeSnapshot` defaults the four arrays and drops feedback/reports whose ids don't resolve; REST helpers `uploadMaterial`, `patchModule`, `reconcileReport`.
- `lib/community.tsx`: expose `modules`, `assignments`, `feedback`, `reports` via `community`; helpers `moduleCards(moduleId)`, `myFeedback()`, `switchPerson()` (clears `ada:me`, reloads). Private channels are listed only if `me` is a member.
- `components/ada/channel.tsx`: `Composer` gets `channelId?` (defaults to active) and `suggestions?: string[]` (chips that fill the field).
- `screens/Modules.tsx` (teacher): `Folder` with tab "Modules", actions = Ada's presence + "New module". Body: module list (left, 248 px: mono index, Literata title, meta `status · n cards · level`) and module sheet (right): title (display), summary, `#channel` link; Difficulty (segmented pills Intro · Core · Advanced, black = current; Ada's suggestion line with her 20 px figure, rationale, evidence bullets, "Use <level>" when it differs); Material (rows by kind + drop zone with hidden `<input type=file>`; "compiling" pill with pulsing dot while `status === "compiling"`; Ada offline notice when her presence is `away`); Cards (`CardTab` rows → `openCard`, newest `sun` if new); Reports (tiles: Ada's figure, "about <student> · <ago>", told, recommendation checkboxes, note textarea, "Apply to module"; reconciled tiles show the note and a `Cite` to the decision card).
- `screens/Study.tsx` (student): `Folder` with tab "My study". Two columns (stack under 760 px): left = Feedback tile (Literata title, mono score, "What went well", "Where it slipped" with module chip, "Next steps" with `Cite` pills) + Modules list (done ✓ / slipped · "Learn it" → expands `CardTab`s and opens the first); right = "Ada · your conversation": `Conversation` of the private channel + suggestion chips + `Composer channelId=<private>`.
- `components/app-sidebar.tsx`: role entry above Course ("Modules" / "My study", active by hash; choosing a channel clears the hash); footer "Switch person".
- Tokens only from `index.css`; Tab Rule and One Sun Rule respected (sun only on the newest card tile; status via pills).

## 5. Data (`data/neural-networks-2026`)

- People: Martin (teacher), Sofia, Ignacio, Lucia (students). Channels: `general`, `questions`, `teachers` (martin, ada), `01-perceptron`, `02-mlp`, `03-backprop`, work `assignment-2-backprop` (submitted, due 2026-08-20), private `sofia-ada`, `ignacio-ada`, `lucia-ada`.
- Modules 01–03 `ready` with 3–4 wiki cards each (real content, Literata-friendly markdown limited to `##`, paragraphs, numbered lists, `**`, `*`, `` ` ``); materials: `01-perceptron/perceptron.md`, `02-mlp/mlp.md`, `03-backprop/backprop.md`.
- Assignment 2 on 03; feedback: Sofia 6/10 (gap: σ′ in the chain rule), Lucia 5/10 (same gap), Ignacio 9/10.
- Seeded messages: `#general` (Martin announces feedback), `#questions` (Ignacio asks about XOR, Ada answers from the file), `#teachers` (Martin asks how Assignment 2 went; Ada answers with the 2-of-3 signal citing the chain-rule card), `sofia-ada` (Ada's note two days ago, Sofia's reply), one reconciled report on 02-mlp about Ignacio with its decision card.

## 6. Docs

`DECISIONS.md` §18 (dated 2026-08-23), `PRODUCT.md` (terminology + the two views + the report rule), `AGENTS.md` of `apps/web`, `apps/server`, `packages/runner`, `data`; root `AGENTS.md` commands (`ADA_RUNTIME`).

## 7. Work split and order

1. Protocol types + events (shared; first, by hand).
2. In parallel: (a) server schema/seed/routes/ws; (b) seed content (wiki cards, materials, community.json); (c) web plumbing + sidebar + routing + Composer; (d) Modules page; (e) Study page + report tiles; (f) scripted runtime.
3. Integration: seed → server → scripted runner → browser run of AC-UI-1..5 with screenshots; typecheck/lint/build; docs.

## 8. Cross-slice interfaces (binding for every implementation slice)

### Web plumbing exposes (slice 2c) — pages (2d, 2e) code against these

`apps/web/src/lib/api.ts`:
```ts
export async function uploadMaterial(server: string, moduleId: string, input: { name: string; kind: Material["kind"]; size?: number; text?: string; authorId: string }): Promise<Module>
export async function patchModule(server: string, moduleId: string, input: { difficulty?: { level: DifficultyLevel; rationale?: string }; objectives?: string[]; authorId: string }): Promise<Module>
export async function reconcileReport(server: string, reportId: string, input: { accepted: string[]; note: string; authorId: string }): Promise<Report>
```
`apps/web/src/lib/community.tsx` (`useCommunity()` gains):
```ts
view: "channel" | "modules" | "home"          // from the hash
showChannel(id: string): void                  // sets the active channel and clears the hash
goTo(view: "modules" | "home"): void           // sets the hash
switchPerson(): void                           // clears ada:me and reloads into the picker
uploadMaterial(moduleId, input): Promise<Module>      // authorId = me.id added by the provider
patchModule(moduleId, input): Promise<Module>
reconcileReport(reportId, input): Promise<Report>
moduleCards(moduleId: string): Card[]          // cards in the module's channel, oldest first, base docs excluded
myFeedback(): Feedback[]                        // feedback addressed to me, newest first
presenceOf(memberId: string): Presence          // member's presence (away when unknown)
```
`Composer` props: `{ placeholder: string; compact?: boolean; threadId?: string; channelId?: string; suggestions?: string[]; autoFocus?: boolean }`. A suggestion chip fills the field and focuses it; Enter sends (connected mode).

`Conversation` props unchanged: `{ channel: Channel; messages: Message[] }`.

Pages export: `apps/web/src/screens/Modules.tsx` → `export function ModulesScreen()`; `apps/web/src/screens/Study.tsx` → `export function StudyScreen()`. Each renders ONE `Folder` (from `components/ada/folder`) that fills the channel panel; the shell (`Channel.tsx`) decides which of `ChannelScreen` body / `ModulesScreen` / `StudyScreen` goes inside the left `ResizablePanel`, and keeps the context panel (`PanelStack`) for cards.

### Server REST contract (slice 2a) — web plumbing codes against this

- `POST /api/modules/:id/materials` body `{name, kind, size?, text?, authorId}` → `200 Module` (status `compiling`, material appended). Side effects: file under `raw/martin/modules/<id>/<name>`; broadcast `module.updated`; message `@Ada ingest <name> into <id>` by `authorId` in the module channel (so `message.created` follows) with the mention hint `{intent:"ingest", moduleId}`.
- `PATCH /api/modules/:id` body `{difficulty?: {level, rationale?}, objectives?, authorId}` → `200 Module`; `difficulty.setBy = authorId` when `difficulty` is present; broadcast `module.updated`.
- `POST /api/reports/:id/reconcile` body `{accepted: string[], note, authorId}` → `200 Report`; publishes the decision card (authored by `authorId`, channel = module channel, path `<authorId>/decisions/<moduleId>-revision-<assignmentId|report.id>.md`, title `<module.title> · revision after <assignment.title|'report'>`, body = "## Accepted" numbered list of accepted recommendation texts + "## Note" paragraph); module `revision` = `"Revised after <assignment.title> · <n> changes accepted"`; broadcast `card.published`, `report.updated`, `module.updated`.
- Errors: `404 {error}` for unknown module/report, `400 {error}` on bad bodies.

### Seed contract (slice 2b writes it, slice 2a reads it)

`community.json` top-level keys (all optional except the existing ones): `modules[]` (`{id, index, slug, title, summary, channelId, objectives[], difficulty{level, rationale?, evidence?[], setBy?, suggestedBy?}, status, materials[]: {id, name, kind, size?, path, uploadedAt}, revision?}`), `assignments[]`, `feedback[]` (shape = protocol `Feedback`, with `at` ISO or `ago`), `reports[]` (shape = protocol `Report`, `at` ISO or `ago`; `reconciled.cardId` may be a wiki path of a seeded card, resolved at seed time), `messages[]` (`{id, channelId, authorId, ago?: "2d"|"3h"|"15m", at?: ISO, text, fromCard?: {cardPath, ago}}` — `text` paragraphs split on blank lines; `[[wiki/path.md|label]]` or `[[wiki/path.md]]` inside the text becomes a cite block resolved to the seeded card with that path; unresolved cites become plain text with a console warning), `wikiCards: true`.
`feedback[].gaps[].cardId`, `feedback[].nextSteps[].cardId`, `reports[].cardIds[]` may be wiki paths (`modules/03-backprop/chain-rule.md`) — the seeder resolves them to card ids after cards are upserted. Seeded card ids are deterministic: `card:<authorId>:<path>` so that re-seeding is idempotent and paths stay citable.

Wiki card frontmatter (`agents/ada/wiki/**/*.md`, except `index.md`/`log.md`):
```
---
title: Chain rule through the activation
type: topic            # topic|note|difficulty → note · question|answer → answer · decision · assignment · submission
channel: 03-backprop   # optional; default from the path (modules/<id>/… → <id>; questions/… → questions; decisions/… → the channel named here or general)
published: 2026-08-12T10:00:00-03:00   # optional; default = seed time − 7 days
sources:
  - raw/martin/modules/03-backprop/backprop.md
supersedes: modules/02-mlp/forward-pass.md   # optional wiki path
---
body markdown (## headings, paragraphs, numbered lists, **bold**, *italic*, `code`)
```
