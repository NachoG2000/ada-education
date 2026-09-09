# AGENTS.md

Repo rules for any agent working here (Claude Code, Codex, Cursor, whichever). `CLAUDE.md` imports this file: **edit this one, not that one.**

## What this repo is

**Ada** (working name "Ada Education"): a course community where humans and AI agents share channels and knowledge compiles itself into **cards** (markdown pages with a type, a version, sources and "replaces"). **Open source (Apache-2.0)** for **organizations that run cohort-based courses — bootcamps, academies, corporate training programs, universities**; no specific organization is named in this repo (`DECISIONS.md` §19).

**Current scope (`DECISIONS.md` §22–§24; GitHub issues #1, #3 and #4):** a hosted-service demo foundation with global users, role-bearing memberships across multiple communities, UI-created communities/channels/members/agents, local Claude/Codex subscription runners, route-backed channels/threads/Agents/Settings, and Buzz's interaction grammar rendered with deliberately plain default-shadcn components. The local TypeScript server + SQLite + external runner topology from §14 stays. There is no cards UI, Modules, My study, broad search, notifications, reactions, or attachments in this phase.

**Foundation status:** the Buzz interaction parity and Ada-only QA from
issues #3/#4 are complete and consolidated. The change is archived at
`openspec/changes/archive/2026-09-05-buzz-interaction-parity/`; current
requirements live in `openspec/specs/`. `DECISIONS.md` §23–§24 and
`research/2026-09-05-repository-consolidation.md` record the baseline and
verification. The older demo plan retains historical unchecked items;
`openspec/README.md` explains why it is not the expansion backlog.

**Actual state of the code today:** a Vite + React 19 SPA (`apps/web/`) with TanStack Router and a responsive three-ring workspace: conditional community rail, course sidebar, routed channel/DM/Agents/Settings surfaces, and split-or-overlay thread/channel/agent context. Buzz is only the interaction reference; the mounted look is ordinary default shadcn with neutral surfaces and no Buzz gradient, inset-window, or decorative avatar treatment. Account backup/sign-out gates, role-aware community/channel/invite/member/agent flows, private user-agent DMs, teacher read-only student conversations, live messages/threads, mentions, and automatically connected agents are mounted. `#home`, `#modules`, and the old card UI remain only as unmounted implementation history. Connected mode uses real tenant-scoped REST/first-frame WS mutations; there is no `dev:demo` mode. The Hono/SQLite server owns global users, memberships, communities, channels, agents, messages, DMs, viewer-filtered snapshots and channel-authorized events. `packages/protocol/` owns shared Zod inputs/events and `packages/runner/` provides Claude/Codex subscription adapters. Cards remain backend memory without mounted card UI. Read `DECISIONS.md` §14, §21, §22 and §23 before touching architecture, agent memory or scope.

**Every area of the repo has its own short `AGENTS.md`** with what it is today and how it grows tomorrow (`apps/web/`, `docs/`, and every new workspace must bring its own). If you touch an area, keep its file up to date.

Documents of truth, in order of authority:
- `PROBLEM.md` — the problem before the solution: who suffers it, evidence as of 2026, root causes, what the problem is not. If a feature doesn't attack something in there, it doesn't ship.
- `DECISIONS.md` — vision, theses, memory model, stack, build order, demo script, out of scope.
- `PRODUCT.md` — users, fixed terminology, states that must be visible, brand constraints.
- `DESIGN.md` — "The card file" design system (tokens, typography, named rules). The real tokens live in `apps/web/src/index.css` and may differ in detail; the code wins.
- `research/` — research with sources, one file per session. Backing for `PROBLEM.md`; not an authority by itself.
- `openspec/specs/` — current interaction contracts; `openspec/README.md` distinguishes these from implementation history.
- `docs/architecture.md` — the mounted implementation map; `docs/README.md` indexes current guides and history.
- `docs/*.html` — **future inspiration** (full architecture, use cases, expanded API). They don't describe the current code; where they contradict the code or the spec, those win.
- `design/BRIEF.md` and `design/mockups/` — history, not authority. The HTML mockups are discarded.

Language: everything (UI, content, comments, docs, names) in **English**. Keep it that way.

## Rule: all information lands in the repo

Whatever was used to think about or decide something for the project gets written into a markdown file in the repo **before the task is closed**. Nothing lives only in a chat, a Drive PDF, a Discord thread or someone's head. It's the product's own thesis applied to ourselves: knowledge lives in files the group owns.

Where each thing goes:
- `PROBLEM.md` — the problem, who suffers it, evidence and causes. Updated when new evidence appears; every figure carries its source.
- `DECISIONS.md` — decisions and their rationale. A decision that changes is not deleted: it's marked as superseded and the new one is added, with a date.
- `PRODUCT.md` / `DESIGN.md` — product and design.
- `research/YYYY-MM-DD-<topic>.md` — research: every claim with source, URL, date, and whether it was verified in the original source or only in a search snippet. Summaries of external documents the user provides also go here, with the path or URL of the original.
- If something fits nowhere, it still goes in `research/`, with a note on why.

How an agent applies this:
- If during a task you learned something about the domain, the user, the market or a decision that another agent or person would need to know, write it in the corresponding file before finishing, and say in your wrap-up which file you touched.
- If the user hands you an external document (PDF, link, screenshot, transcript), leave a summary in `research/` with what matters and where it came from. The original can stay out of the repo if it holds personal data; the summary can't.
- Don't invent sources or figures. A figure without a source is marked as an estimate. A figure from 2012 is stated to be from 2012.
- Cite by path and section ("see `PROBLEM.md` §3.2"), never "as discussed earlier".
- The same principles the product demands of its agents (read the index before answering, cite, don't edit the old — replace with `supersedes`) apply to working in this repo.

## Commands

Monorepo with **npm workspaces** (no Turborepo): `apps/web` (SPA), `apps/server` (local API), `packages/runner` (local subscription runner), `packages/protocol` (shared types and events), `data/<course>/` (legacy fixture courses), `deploy/` (retained pre-issue deployment history; deployment is outside issue #1). Every area has its `AGENTS.md`.

```bash
npm ci                 # Node 24; install the locked root workspaces
npm run seed           # optional legacy fixture import; does not populate hosted communities
npm run dev            # fresh web + server → http://localhost:5173 (proxied to :8787)
npm run runner:host    # installation host (already started by npm run dev)
npm run runner         # retained manual per-agent runner
npm run check          # complete local/CI gate: lint, docs, hosted, and legacy
npm run check:hosted   # all TypeScript, hosted REST/WS, providers, and web build
npm run check:legacy   # retained fixture, migration, gated, and smoke checks
npm run check:issue1   # compatibility alias for check:hosted
npm run dev:web        # SPA only, with HMR → http://localhost:5173
npm run dev:server     # server only → http://localhost:8787
npm run check -w @ada/server # server typecheck
npm run smoke          # WS/REST smoke test against a throwaway copy of the course (seeds a temp DB, spare port; never touches the demo DB)
npm run check:gated -w @ada/server  # membership gating end to end: claim, invites, token-derived authorship, WS auth, remote material sync (throwaway copy)
npm run check:workspace # migration/reseed, private access, channel/agent/message/attachment API invariants (throwaway data)
npm run build          # tsc -b && vite build of apps/web → apps/web/dist/
npm start              # API + built SPA at :8787, without a watcher
npm run check:docs     # current and historical documentation contracts
npm run lint           # oxlint over apps and packages; known warnings: only-export-components (card.tsx, ui/sidebar.tsx, community.tsx, identity.tsx, tabs.tsx, button.tsx) and set-state-in-effect (community.tsx, use-mobile.ts)
npm run typecheck      # protocol, server, runner, and web TypeScript
npm run typecheck:web  # web only (noUnusedLocals/Parameters active)
cd apps/web && npx shadcn add <component>   # primitives into src/components/ui (base-nova style, Base UI, lucide icons)
```

Contributor setup and validation live in `CONTRIBUTING.md`. CI installs with `npm ci` on Node 24 and runs `npm run check`; provider checks use fake binaries and never require model credentials. Targeted executable checks live under each workspace; there is no unit-test framework. Figure-generator dev screen: open `http://localhost:5173/#figures`.

## Architecture

**Mounted web client.** `main.tsx` mounts the TanStack Router from `router.tsx`; `App.tsx` selects `HostedApp` and retains only `#figures` as a developer screen. `components/hosted.tsx` owns account restoration, one-time token display and zero-community onboarding. `components/hosted-surface.tsx` hydrates tenant data into the shared context; `components/workspace/shell.tsx` composes the routed workspace and auxiliary surface. `lib/hosted-api.ts` is the Zod-validated REST/WS client. There is no synthetic demo mode. The old fixture client, Modules, My study and card UI remain unmounted; shared workspace/context components are active. See `docs/architecture.md` for the entry-point map and `docs/history/` for older descriptions.

**Hosted domain.** A `User` is global. A `Membership` joins that user to one `Community` with a teacher/student role. Every community resource carries a `communityId`: channels, user-agent DMs, agents, messages, threads, invitations, card records and runner presence. REST identifies the user from a bearer token and the tenant from `/api/communities/:communityId`; browser and runner sockets send credentials in their first frame. The server stores only SHA-256 token digests.

**Persistence and projection.** `apps/server/src/migrations.ts` upgrades the SQLite file without requiring a seed. `tenant.ts` owns tenant-aware queries and lifecycle rules; `api.ts` owns authenticated REST; `ws.ts` filters each event for the receiving user or runner. Full history is returned only to channel members, agent DMs are visible to their user/agent pair plus teachers, and public directory entries reveal only browseable metadata. Legacy course/card/module tables and fixture import remain available behind the current UI.

**Runner.** `packages/runner/src/host.ts` manages installation enrollment and workers; `packages/runner/src/cli.ts` bootstraps an isolated agent workspace, connects outbound, authenticates in the first frame and processes mentions serially. `claude` and `codex` run through their own subscription-authenticated CLIs; Ada strips provider API-key environment variables and never receives provider credentials. Changed wiki markdown is published as backend cards through correlated runner acknowledgements.

**Shared contracts.** `packages/protocol/src/hosted.ts` is the issue #1 boundary for hosted inputs, safe projections, events and runner frames. Network payloads are parsed at the web and runner boundaries. Raw user, invite and runner tokens occur only in their creation/rotation response or auth frame, never in ordinary projections or events.

## Design system in the code

The issue #1 surface intentionally uses default base-nova shadcn styling and ordinary responsive sheets. Compose official primitives from `apps/web/src/components/ui/`; use `render` for composed triggers so interactive elements are not nested. Messages are open rows rather than bubbles. Icon-only controls need accessible names, mutations need pending/error states, and destructive changes need confirmation.

The Card File tokens, figures and named visual rules remain in `apps/web/src/index.css`, `src/components/ada/` and `DESIGN.md` for the paused card UI. Do not apply those unmounted rules to the hosted shell unless a later decision explicitly restores them. Do not delete that design history.

## Decisions and open questions (don't resolve them on your own)

- **The "already on file · N days ago" seal.** It can read as a cache ("here's what I already answered"). The correct semantics is "composed from the card file" (see `DECISIONS.md`, commitment 3): a fresh answer, built from existing cards. Copy in `demo.ts`/`card.tsx` to review with the user before changing it.
- **MVP API (from `docs/usecases-api.html` §8):** `fromCard` should become plural (`fromFile: { cardIds[], oldestAgo }`) because composing involves several cards — it changes `types.ts`, `demo.ts`, `message` and `card`; a card's id would be its path in the wiki; the frontmatter has 7 types and the UI 5 (`difficulty` and `person` aren't published to channels); automatic ingest every N messages stays off in the MVP. None of this is decided: ask before implementing.
- **The example agent's name.** `DECISIONS.md` and `demo.ts` call it "Ada"; `PRODUCT.md` says Ada is the product and agents carry other names. Ask before renaming.
- Backend is settled by §§14/21: the local TypeScript server + external runner stays; Buzz is only the UI/interaction reference.
- Out of scope for now (don't build): granular permissions, submission grading, collaborative editing, vector/global search, billing, OAuth/email auth, hosted runners, notifications, work-channel lifecycle, or a separate mobile product. Multi-community tenancy and responsive web are implemented. Nor gamification or per-student algorithmic personalization: `PROBLEM.md` §9 explains why they miss the problem.

## Human documentation

`docs/README.md` indexes the current `architecture.md`, contributor guide, historical workspace descriptions, and future references. Keep the current map aligned with code.

`docs/` also holds self-contained HTML pages (no build, open by double-click) that explain the system to people. They are **future inspiration**: they describe the full product, not today's code, and each says so in its banner. `docs/how-it-works.html` = the mental model (server / runner / runtime / folder, the sequence of a mention, isolation, tiers). `docs/usecases-api.html` = use cases and the expanded MVP API. If `DECISIONS.md` §14-§15 or the OpenSpec change moves, they're updated in the same task.

**Current agent experience (§25, 2026-09-06):** create name/rules/channels and
Ada connects it automatically. UI-created communities get two editable
starter agents. Runtime/authentication are installation concerns. Read
`docs/agent-host.md`; the retained manual enrollment endpoints are not the
mounted product flow. `npm run dev` starts web, server, and agent host.

## Current interface system (§26, 2026-09-06)

The user authorized a coherent educational interface system beyond the previous default-only styling. DESIGN.md and semantic tokens now govern mounted screens; the former Card File design remains in docs/history/design-system-2026-09-05.md. Use shared page-layout.tsx frames, headers, navigation, and action sections in Settings, Agents, and future pages. Variants express state without changing component geometry. Developer examples live at /#design-system. Mentions use stable IDs and Tiptap; teacher-only recruitment happens atomically on message creation. See the scoped workspace guides.

## Educational extension (2026-09-07, §27)

The user's later scope approval supersedes the foundation-only exclusion of
mounted artifacts and Inbox above. Shared channel artifacts now have typed
manual templates and versions; personal work is owner-only and explicit
submissions expose snapshots to teachers for human feedback. The channel
header collection and detail reuse the single auxiliary panel. Ask privately
stages a contextual DM draft without sending. Inbox has its own route and
persisted personal read state. Existing DM teacher visibility remains.
See `docs/educational-artifacts.md`. Agent memory cards, automatic generation,
mastery inference, grading and proactive notifications remain deferred.
`npm run check:education -w @ada/server` is included in `npm run check`.

## Pi subscription runtime (2026-09-07, §28)

`npm run dev:pi` selects the optional Pi runtime for the installation. `npm run
pi` opens Pi for its own ChatGPT subscription login (`/login`). Existing agent
workspaces and database data are retained; migration 8 adds the runtime value.
Only scoped official file tools are exposed. See `docs/agent-host.md` for setup,
limitations, and validation. Course-memory expansion remains separate.

## Governed course memory (§34, 2026-09-08)

The user authorized filesystem/OKF memory, learner inferences with evidence,
teacher/self access, source ingestion/review, and exploration seeds. This
supersedes earlier memory deferrals above. `docs/course-memory.md` describes
canonical files, the Pi-only scoped runtime boundary, persisted processing,
revocation and the new memory route. New communities always get primary Ada;
Pi/Luna is the default. Old wikis and legacy runners remain isolated history.
`npm run seed:exploration` preloads two synthetic courses; explicit `--reset`
requires stopping the app first and discards the chosen DB/memory. Never run
checks against those live courses. See `docs/memory-exploration.md` for cases.
