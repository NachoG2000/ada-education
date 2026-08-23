# Plan

Ordered tasks; each names its files, the acceptance criteria it serves and how it is verified. Tasks 2a–2f run in parallel after task 1.

## 1. Protocol (by hand, first) — AC-1, AC-5

- `packages/protocol/src/types.ts`: `DifficultyLevel`, `ModuleStatus`, `Material`, `Difficulty`, `Module`, `Assignment`, `Feedback`, `Report`; `Community` gains `modules/assignments/feedback/reports`; `Card.path?`.
- `packages/protocol/src/events.ts`: schemas for the new entities; snapshot schema; server events `module.updated`, `feedback.created`, `report.updated`; `agent.mention` `intent?`/`moduleId?`; runner messages `module.suggest`, `report.create`; ack `report?`.
- `apps/web/src/lib/demo.ts`: four empty arrays.
- Verify: `npm run typecheck`, `npm run check -w @ada/server` (server may fail until 2a lands; protocol alone must compile).

## 2a. Server — AC-1, AC-2, AC-3, AC-4

- `schema.sql` tables; `db.ts` upserts/lists for modules, materials, assignments, feedback, reports; `getCommunitySnapshot` includes them and computes `cardIds`; `publishCard` returns `path` on cards.
- `seed.ts`: new seed keys, `messages[]` with `ago`, `wikiCards: true` reading `agents/ada/wiki/**/*.md`.
- `api.ts`: the three routes; `index.ts` wiring; `ws.ts`: `mention(message, hint)`, `module.suggest`, `report.create`.
- `scripts/smoke.ts`: extend with a module patch and a reconcile round-trip.
- Verify: `npm run check -w @ada/server`; `npm run seed`; `curl` the routes; smoke script.

## 2b. Seed content — AC-1, AC-UI-3

- `data/neural-networks-2026/community.json`: people (+Lucia), channels (+teachers, 01, 02, work, privates), modules, assignment, feedback ×3, one reconciled report, messages.
- `agents/ada/wiki/modules/{01-perceptron,02-mlp,03-backprop}/*.md` (3–4 cards each), `wiki/decisions/02-mlp-revision.md`, `wiki/index.md` updated; `raw/martin/modules/{01,02}/…md` materials; `03-backprop/backprop.md` improved to a real base document.
- Verify: every id referenced resolves (script check in 2a's seed: fail loudly on a dangling id).

## 2c. Web plumbing — AC-6

- `lib/api.ts` (events, sanitize, REST helpers), `lib/community.tsx` (`switchPerson`, private-channel filter, helpers), `App.tsx` (`view`), `screens/Channel.tsx` (`view` prop, role redirect), `app-sidebar.tsx` (role entry, Switch person), `channel.tsx` (`Composer channelId`, `suggestions`).
- Verify: `npm run typecheck`; browser: Martin sees "Modules", Sofia "My study", switch works.

## 2d. Modules page — AC-UI-1, AC-UI-2, AC-UI-5

- `screens/Modules.tsx`, `components/ada/modules.tsx` (ModuleList, ModuleSheet, DifficultyControl, MaterialZone, ReportTile).
- Verify: browser as Martin; screenshot.

## 2e. Study page — AC-UI-3, AC-UI-4

- `screens/Study.tsx`, `components/ada/study.tsx` (FeedbackTile, ModuleProgress, AskAda).
- Verify: browser as Sofia; screenshot; reload persistence.

## 2f. Scripted runtime — AC-5

- `packages/runner/src/runtimes/scripted.ts`, `cli.ts` changes, root `package.json` (`ADA_RUNTIME` default `scripted` for `npm run dev`).
- Verify: runner log; ingest and plan round-trips from the browser; cards published via `card.publish`.

## 3. Integration and evidence — AC-7, AC-UI-1..5

- `npm run seed && npm run dev` (scripted), walk the demo as Martin then Sofia then Martin; screenshots per UI criterion; `npm run typecheck`, `npm run check -w @ada/server`, `npm run lint`, `npm run build`, smoke.

## 4. Docs — AC-8

- `DECISIONS.md` §18, `PRODUCT.md`, `AGENTS.md` (root commands, `apps/web`, `apps/server`, `packages/runner`, `data`).
