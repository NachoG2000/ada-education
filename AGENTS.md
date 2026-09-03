# AGENTS.md

Repo rules for any agent working here (Claude Code, Codex, Cursor, whichever). `CLAUDE.md` imports this file: **edit this one, not that one.**

## What this repo is

**Ada** (working name "Ada Education"): a course community where humans and AI agents share channels and knowledge compiles itself into **cards** (markdown pages with a type, a version, sources and "replaces"). **Open source (Apache-2.0)** for **organizations that run cohort-based courses — bootcamps, academies, corporate training programs, universities**; no specific organization is named in this repo (`DECISIONS.md` §19).

**Current scope (`DECISIONS.md` §22, 09/03; GitHub issue #1):** a hosted-service demo foundation with global users, role-bearing memberships across multiple communities, UI-created communities/channels/members/agents, local Claude/Codex subscription runners, and Buzz's shell in default shadcn styles. The local TypeScript server + SQLite + external runner topology from §14 stays. There is no cards UI, Modules, My study, Inbox, standalone Agents page, or broad Settings area in this phase.

**Active change:** GitHub issue #1 moves the local demo to user accounts,
multi-community memberships, UI-created communities/channels/agents, and local
Claude/Codex runners. The issue and `DECISIONS.md` §22 are the scope contract.

**Actual state of the code today:** a Vite + React 19 SPA (`apps/web/`) with a responsive default-shadcn Buzz-style workspace: community switcher, channels, private user-agent DMs, live messages/threads, members, invites and agent setup. `#home` and `#modules` and the old card UI remain only as unmounted implementation history. Connected mode uses real tenant-scoped REST/first-frame WS mutations; there is no `dev:demo` mode. The Hono/SQLite server owns global users, memberships, communities, channels, agents, messages, DMs, viewer-filtered snapshots and channel-authorized events. `packages/protocol/` owns shared Zod inputs/events and `packages/runner/` provides Claude/Codex subscription adapters. Cards remain backend memory without mounted card UI. Read `DECISIONS.md` §14, §21 and §22 before touching architecture, agent memory or scope.

**Every area of the repo has its own short `AGENTS.md`** with what it is today and how it grows tomorrow (`apps/web/`, `docs/`, and every new workspace must bring its own). If you touch an area, keep its file up to date.

Documents of truth, in order of authority:
- `PROBLEM.md` — the problem before the solution: who suffers it, evidence as of 2026, root causes, what the problem is not. If a feature doesn't attack something in there, it doesn't ship.
- `DECISIONS.md` — vision, theses, memory model, stack, build order, demo script, out of scope.
- `PRODUCT.md` — users, fixed terminology, states that must be visible, brand constraints.
- `DESIGN.md` — "The card file" design system (tokens, typography, named rules). The real tokens live in `apps/web/src/index.css` and may differ in detail; the code wins.
- `research/` — research with sources, one file per session. Backing for `PROBLEM.md`; not an authority by itself.
- `openspec/` — older specifications and archived change history.
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
npm install            # once, at the root (installs all workspaces)
npm run seed           # loads data/neural-networks-2026 into the local DB
npm run dev            # fresh web + server → http://localhost:5173 (proxied to :8787)
npm run runner         # opt-in hosted runner; use the one-time setup command from the UI
npm run check:issue1   # protocol, server tenant-flow, and runner-provider checks
npm run dev:web        # SPA only, with HMR → http://localhost:5173
npm run dev:server     # server only → http://localhost:8787
npm run check -w @ada/server # server typecheck
npm run smoke          # WS/REST smoke test against a throwaway copy of the course (seeds a temp DB, spare port; never touches the demo DB)
npm run check:gated -w @ada/server  # membership gating end to end: claim, invites, token-derived authorship, WS auth, remote material sync (throwaway copy)
npm run check:workspace # migration/reseed, private access, channel/agent/message/attachment API invariants (throwaway data)
npm run build          # tsc -b && vite build of apps/web → apps/web/dist/
npm run lint           # oxlint over apps and packages; known warnings: only-export-components (card.tsx, ui/sidebar.tsx, community.tsx, identity.tsx, tabs.tsx, button.tsx) and one set-state-in-effect (community.tsx)
npm run typecheck      # tsc -b apps/web (noUnusedLocals/Parameters active: one unused variable breaks the build)
cd apps/web && npx shadcn add <component>   # primitives into src/components/ui (base-nova style, Base UI, lucide icons)
```

Targeted executable checks live under each workspace; there is no unit-test framework. Figure-generator dev screen: open `http://localhost:5173/#figures`.

## Architecture

**Mounted web client.** `apps/web/src/App.tsx` mounts `HostedApp` for every normal URL and keeps only `#figures` as a developer screen. `components/hosted.tsx` owns account restoration, one-time token display, onboarding, community selection and the responsive workspace state. `lib/hosted-api.ts` is the Zod-validated REST/WS client. There is no product router and no synthetic demo mode. The older context, workspace, card, Modules and My study code is retained but unmounted.

**Hosted domain.** A `User` is global. A `Membership` joins that user to one `Community` with a teacher/student role. Every community resource carries a `communityId`: channels, user-agent DMs, agents, messages, threads, invitations, card records and runner presence. REST identifies the user from a bearer token and the tenant from `/api/communities/:communityId`; browser and runner sockets send credentials in their first frame. The server stores only SHA-256 token digests.

**Persistence and projection.** `apps/server/src/migrations.ts` upgrades the SQLite file without requiring a seed. `tenant.ts` owns tenant-aware queries and lifecycle rules; `api.ts` owns authenticated REST; `ws.ts` filters each event for the receiving user or runner. Full history is returned only to channel members, agent DMs are visible to their user/agent pair plus teachers, and public directory entries reveal only browseable metadata. Legacy course/card/module tables and fixture import remain available behind the current UI.

**Runner.** `packages/runner/src/cli.ts` consumes the UI-generated setup command, bootstraps an isolated agent workspace, connects outbound, authenticates in the first frame and processes mentions serially. `claude` and `codex` run through their own subscription-authenticated CLIs; Ada strips provider API-key environment variables and never receives provider credentials. Changed wiki markdown is published as backend cards through correlated runner acknowledgements.

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

## HTML docs

`docs/` holds self-contained HTML pages (no build, open by double-click) that explain the system to people. They are **future inspiration**: they describe the full product, not today's code, and each says so in its banner. `docs/how-it-works.html` = the mental model (server / runner / runtime / folder, the sequence of a mention, isolation, tiers). `docs/usecases-api.html` = use cases and the expanded MVP API. If `DECISIONS.md` §14-§15 or the OpenSpec change moves, they're updated in the same task.
