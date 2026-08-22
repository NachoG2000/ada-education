## 1. Repo and workspace (≈30 min)

- [x] 1.1 `git init` at the root; `.gitignore` for `node_modules`, `dist`, `apps/server/data/*.db`, and `data/**/agents/*/.git/` (the wiki is versioned, not its inner `.git`).
- [x] 1.2 Move `src/`, `index.html`, `public/`, `vite.config.ts`, `tsconfig.app.json`, `components.json`, `.oxlintrc.json` to `apps/web/`; `apps/web`'s `package.json` with the current scripts. Verify `npm run build` and `#figures`.
- [x] 1.3 Root `package.json` as the workspace (`apps/*`, `packages/*`) with scripts `dev` (server + web in parallel), `dev:web`, `dev:server`, `runner`, `seed`, `build`, `lint`, `typecheck`.
- [x] 1.4a `packages/protocol`: `types.ts` moved; `apps/web/src/lib/types.ts` re-exports.
- [x] 1.4b API events with `zod` in `@ada/protocol` (done together with group 2).
- [x] 1.5 New `README.md` + Apache-2.0 `LICENSE`: what Ada is, server/runner/runtime diagram, "run the demo in 4 commands".

## 2. Community server (≈2 h)

- [x] 2.1 `apps/server` with Hono + `node:sqlite`; `schema.sql`; `db.ts` with per-table functions.
- [x] 2.2 `GET /api/community` returning `Community` (without `meId`; the client sets it).
- [x] 2.3 `POST /api/channels/:id/messages`, `POST /api/threads`; `message.created` / `thread.created` emitted over `/ws`.
- [x] 2.4 `@handle` mention detection → `agent.mention` to the connected runner, with the last 20 messages of context.
- [x] 2.5 `/ws/runner?token=`: plain-token validation (no hashing, per the `DECISIONS.md` §15 pivot), `online`/`away` presence, `presence`, `message.create`, `card.publish` events with `authorId` verification.
- [x] 2.6 `POST /api/cards` + `card.publish`: dedupe by `(authorId, path)`, versioning, `replaces`, message with `publishes`, `card.published` event.
- [x] 2.7 Agents from `community.json` in the seed (plain token per agent); no creation endpoint (§15).
- [x] 2.8 `npm run seed` from `data/<course>/community.json`; base card `backprop.md` with `base: true`.

## 3. Seed course and the Ada agent (≈40 min)

- [x] 3.1 `data/neural-networks-2026/community.json` (course, channels, people, `ada` agent, fixed demo token so it isn't copied live).
- [ ] 3.2 `raw/martin/modules/03-backprop/backprop.md`: base document, ~3 pages, fictional.
- [ ] 3.3 `packages/runner/templates/CLAUDE.md` with the six `agent-wiki` rules, `[[path]]` syntax, ingest, answer format; `agents/ada/CLAUDE.md` = template + Ada's instructions; empty `wiki/index.md`, `wiki/log.md`.
- [ ] 3.4 `git init` inside `agents/ada/` (the runner does it in 5.6; here just verify).

## 4. Runner (≈2 h)

- [ ] 4.1 `packages/runner` CLI (`commander`), flags + env vars, `--cwd` validation, runtime `detect()`, WS connection with simple reconnection.
- [ ] 4.2 `claude` runtime: try `claude -p` by hand with the `design.md` §8 flags against `agents/ada` (reads `index.md`, writes a card, returns text). Adjust flags until it works without interactive prompts.
- [ ] 4.3 Prompt assembly from `agent.mention` (channel, who, chronological context, question).
- [ ] 4.4 Answer parser: paragraphs, `[[path]]` → `cite`, code blocks → `code`.
- [ ] 4.5 `wiki/` snapshot before/after; frontmatter reading; `type` mapping; `supersedes` → `replaces`; publishing over WS; `fromCard` when nothing changed and there's a citation.
- [ ] 4.6 `git init` if missing; one commit per run; serial queue; timeout and agent error message; `thinking`/`publishing` presence.
- [ ] 4.7 `codex` and `pi` adapters with the same interface (written, untested), and the runner's `README` explaining where credentials live.

## 5. Connected web client (≈1.5 h)

- [x] 5.1 `apps/web/src/lib/api.ts` (fetch + WS) and `CommunityProvider` with a reducer for the events; source selection via `VITE_ADA_SERVER`.
- [x] 5.2 "Who are you?" picker → `localStorage["ada:me"]`.
- [x] 5.3 `Composer` that posts over REST, with `@` autocomplete and a disconnected-agent notice.
- [x] 5.4 Live presence in the member list, thread header and agent sheet (`away` = "disconnected", the runner's runtime/model).
- [x] 5.5 `card.published` → card row + publication card; `fromCard` → seal with the existing animation.

## 6. End-to-end demo and docs (≈40 min)

- [ ] 6.1 Rehearse the script (`DECISIONS.md` §11 steps 1-6 + terminal, per §15): seed → `ada`'s runner → ingest → `sofia`'s question → `ignacio`'s similar question (`fromCard`) → decision with `supersedes` → `ls data/` + `git log`. Extension only if time remains: personal agent `tutor-sofia` pre-seeded in `community.json` with its own runner.
- [ ] 6.2 Update the root `AGENTS.md` (Commands and Architecture sections to the new layout) and create each new workspace's `AGENTS.md` (`apps/web`, `apps/server`, `packages/runner`, `packages/protocol`, `data/`): what it is today + how it grows tomorrow.
- [ ] 6.3 Note in `DECISIONS.md` what was left out at the cutoff.
