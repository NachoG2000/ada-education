# Goal: implement the API (`apps/server` + events in `@ada/protocol` + seed)

> Goal prompt for an implementing agent (Codex). Authority: this change's specs. If anything here contradicts a spec, the spec wins.

## Objective

In this repo (npm workspaces monorepo, Node 24), implement the community server per `openspec/changes/demo-local-backend/specs/community-server/spec.md`, covering tasks **1.4b, 2.1–2.8 and 3.1** of `openspec/changes/demo-local-backend/tasks.md`. Read first: that full spec, `tasks.md`, `design.md` (decisions 2, 3, 4, 5, 7 and the pivot note), the root `AGENTS.md`, `apps/server/AGENTS.md`, `packages/protocol/AGENTS.md` and `data/AGENTS.md`.

## In scope

1. **`packages/protocol`** (task 1.4b): add `src/events.ts` with `zod` schemas and derived types, re-exported from `src/index.ts`. Add `zod` as a package dependency. Define exactly:
   - `CommunitySnapshot = Omit<Community, "meId">`.
   - `ServerEvent` (server → web clients): `{ type: "message.created", payload: { message: Message } }` | `{ type: "thread.created", payload: { thread: Thread } }` | `{ type: "card.published", payload: { card: Card, message: Message } }` | `{ type: "member.presence", payload: { memberId: string, presence: Presence, runtime?: string, model?: string } }`.
   - `RunnerServerMessage` (server → runner): `{ type: "agent.mention", payload: { channelId: string, threadId?: string, message: Message, from: Member, context: Message[] } }`.
   - `RunnerClientMessage` (runner → server): `{ type: "presence", payload: { presence: Presence, runtime?: string, model?: string } }` | `{ type: "message.create", ref: string, payload: { channelId: string, threadId?: string, paragraphs: MessageBlock[][], fromCard?: { cardId: string, ago: string }, publishes?: string } }` | `{ type: "card.publish", ref: string, payload: CardPublishInput }`.
   - `CardPublishInput = { channelId, path: string, title, type: CardType, visibility: Visibility, sources: Card["sources"], replaces?: string (path), body: string, base?: boolean }` (the `version`, `state`, `id`, `authorId` and `publishedAt` are decided by the server).
   - Replies to messages with `ref`: `{ type: "ack", ref: string, ok: true, message?: Message, card?: Card }` | `{ type: "ack", ref, ok: false, error: string }`.
2. **`apps/server`** (tasks 2.1–2.8): Hono + `@hono/node-server` for REST, `ws` (WebSocketServer over the same http server) for `/ws` and `/ws/runner`, `node:sqlite` (`DatabaseSync`) for storage. Suggested structure: `src/index.ts` (startup), `src/db.ts` (open + `schema.sql` + per-table functions), `src/api.ts` (REST routes), `src/ws.ts` (client + runner hub, broadcast), `src/mentions.ts` (detection + context assembly), `src/seed.ts` (script). Env config: `PORT` (default **8787**), `ADA_DB` (default `apps/server/data/ada.db`), `ADA_COURSE` (default `data/neural-networks-2026`).
   - Tables: `community` (one row: id, name, subtitle, initial), `members` (people and agents; columns for both, `kind` discriminates; agents with plain-text `token`, `runtime`, `model`), `channel_members`, `channels`, `messages` (paragraphs/fromCard/publishes/reactions as JSON), `threads`, `cards` (unique `(author_id, path)`). Presence: **in memory**, not in the DB; on startup, agents `away` and people `online`.
   - `GET /api/community` returns a `CommunitySnapshot` with the same shape `apps/web/src/lib/demo.ts` builds (use it as a shape reference). `threads.replyIds` derives from `messages.thread_id` ordered by `at`.
   - Mentions: regex over `kind:"text"` blocks looking for `@<id>` where `<id>` is the id of a `kind:"agent"` member of the channel; context = the last 20 messages of the thread (or the channel if no thread) in chronological order, excluding future messages. Deliver only to that agent's connected runner; if no runner is connected, queue nothing.
   - `card.publish` / `POST /api/cards`: dedupe by `(authorId, path)` → if it exists, `version+1` and `state:"updated"`; if it carries `replaces` (a path), resolve it to the same author's card and mark it `state:"superseded"`; always create the `Message` with `publishes` in the channel; emit `card.published`.
   - `/ws/runner?token=`: compare the plain token against `members.token`; invalid → close with code 4401. Connected → `online` presence + broadcast; disconnect → `away` + broadcast. Validate that everything the runner writes uses its agent's `authorId`.
3. **`data/neural-networks-2026/community.json`** (task 3.1): course "Neural Networks 2026", channels `general`, `questions`, `03-backprop` (group `course`), people `martin` (teacher, tone `seal-soft`), `sofia`, `ignacio` (students), agent `ada` (`scope:"community"`, `createdBy:"martin"`, in all three channels, `token:"ada-demo-token"`, `figureSeed:"ada"`). Include `baseDocs: [{ channelId:"03-backprop", path:"martin/modules/03-backprop/backprop.md", title:"Backpropagation — base document", type:"note" }]` and create that file in `raw/` with 3–4 placeholder paragraphs (the real content is another task). The seed publishes the baseDocs as `Card` with `base:true` and no `state`.
4. Scripts: in `apps/server/package.json`: `dev` (`tsx watch src/index.ts`), `seed` (`tsx src/seed.ts`), `check` (`tsc --noEmit`). At the root: `dev:server`, `seed` delegating to the workspace, and `dev` runs web+server in parallel (add `concurrently` as a root devDep). `tsx` as a root devDep. Its own `apps/server/tsconfig.json` (module nodenext, strict, as strict as the rest: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`).

## Out of scope (do NOT do)

- Don't touch `apps/web` or `packages/runner` (at all). Don't implement the runner or the client.
- Don't add Postgres, ORMs, Docker, people auth, token hashing, mention queues, or endpoints the spec doesn't ask for (`POST /api/agents` does NOT exist: `DECISIONS.md` §15).
- The server NEVER calls an AI model or reads credentials (`apps/server/AGENTS.md`, golden rule).
- Don't reformat existing files or "improve" things outside the scope.

## Conventions

- Everything in English: comments, error messages, logs, the course JSON.
- Types always from `@ada/protocol`; don't redefine domain interfaces in the server.
- Direct, small code: functions, not classes; no speculative abstraction layers.

## Verification (definition of done)

Run in order and paste the output in the final report:
1. `npm install` (root) and `npm run check -w @ada/server` with no errors; `npm run build` (the web still compiles); `npm run lint` with no new errors.
2. `npm run seed` → logs the created course; running it twice doesn't duplicate (idempotent: recreate the DB or upsert, your call — document it).
3. `npm run dev:server` and with curl:
   - `curl -s localhost:8787/api/community | jq '.channels | length'` → 3; `.members | length` → 4; `.cards | length` → 1 (the base one).
   - POST a message from `sofia` to `questions` with a `text` block "hi @ada" → 200 with the persisted message (with the server's `id` and `at`).
   - `curl -s localhost:8787/api/community | jq '.messages | length'` → 1.
4. WS smoke test (write `apps/server/scripts/smoke.ts`, runnable with `tsx`, and leave it in the repo): opens a client on `/ws`, opens a runner with `?token=ada-demo-token`, verifies that (a) `member.presence` for `ada` online arrives, (b) posting "hi @ada" over REST makes the runner receive `agent.mention` with `context`, (c) the runner sends `card.publish` + `message.create` with a cite and the client receives `card.published` and `message.created`, (d) an invalid token closes with 4401. The script ends with exit 0 and a summary.
5. Update: the `tasks.md` checkboxes (1.4b, 2.1–2.8, 3.1), the "Today" section of `apps/server/AGENTS.md` and `packages/protocol/AGENTS.md`, and the status table in the root `README.md` (server → ✅ working locally).

## Stop conditions (stop and report instead of improvising)

- If the repo doesn't match what this goal describes (paths, types, scripts), stop and report the difference.
- If `node:sqlite` isn't available in the installed Node, report the version and stop (don't swap in better-sqlite3 without saying so).
- If a verification command fails twice for the same cause, stop and report the exact error.
- Final report: which tasks got checked, commands run with their output, decisions made where the spec left freedom, and what was left out.

When done: a single commit whose message starts with `api: `.
