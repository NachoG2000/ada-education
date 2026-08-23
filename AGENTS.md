# AGENTS.md

Repo rules for any agent working here (Claude Code, Codex, Cursor, whichever). `CLAUDE.md` imports this file: **edit this one, not that one.**

## What this repo is

**Ada** (working name "Ada Education"): a course community where humans and AI agents share channels and knowledge compiles itself into **cards** (markdown pages with a type, a version, sources and "replaces"). **Open source (Apache-2.0)** for **organizations that run cohort-based courses — bootcamps, academies, corporate training programs, universities**; no specific organization is named in this repo (`DECISIONS.md` §19).

**Current scope (`DECISIONS.md` §19, 08/23):** Ada is the open-source product for course-running organizations. The code today is a **fully local deployment on one machine** — the shape §15 set. The full architecture (remote runners, hosted, tiers) is future direction, not code.

**Actual state of the code today:** a Vite + React 19 SPA (`apps/web/`) with three views in one shell — the channel, the teacher's **Modules** (`#modules`) and the student's **My study** (`#home`), gated by `Person.role` (`DECISIONS.md` §18) — that runs by default against the local server (`apps/web/.env` sets `VITE_ADA_SERVER=/`, proxied by Vite; the synthetic community in `apps/web/src/lib/demo.ts` is the opt-in demo mode via `npm run dev:demo`), a local server implemented in `apps/server/`, shared types/events in `packages/protocol/`, the example seed in `data/neural-networks-2026/` (with `agents/ada/CLAUDE.md`, the agent's rules) and `packages/runner/` (two runtimes: `claude` — mentions → `claude -p` in the agent's folder → cards + answer — and `scripted`, the demo default, which fills its answers from the live community state and publishes cards through the same pipeline). The plan to fork Buzz was discarded (`DECISIONS.md` §7 → §14). Read `DECISIONS.md` §14-§15 and §19 before touching architecture, agent memory or scope.

**Every area of the repo has its own short `AGENTS.md`** with what it is today and how it grows tomorrow (`apps/web/`, `docs/`, and every new workspace must bring its own). If you touch an area, keep its file up to date.

Documents of truth, in order of authority:
- `PROBLEM.md` — the problem before the solution: who suffers it, evidence as of 2026, root causes, what the problem is not. If a feature doesn't attack something in there, it doesn't ship.
- `DECISIONS.md` — vision, theses, memory model, stack, build order, demo script, out of scope.
- `PRODUCT.md` — users, fixed terminology, states that must be visible, brand constraints.
- `DESIGN.md` — "The card file" design system (tokens, typography, named rules). The real tokens live in `apps/web/src/index.css` and may differ in detail; the code wins.
- `research/` — research with sources, one file per session. Backing for `PROBLEM.md`; not an authority by itself.
- `openspec/` — specs and changes: what's being built and in what order. The active change is `demo-local-backend`.
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

Monorepo with **npm workspaces** (no Turborepo): `apps/web` (SPA), `apps/server` (local API), `packages/runner` (skeleton), `packages/protocol` (shared types and events), `data/<course>/` (courses). Every area has its `AGENTS.md`.

```bash
npm install            # once, at the root (installs all workspaces)
npm run seed           # loads data/neural-networks-2026 into the local DB
npm run dev            # seed (idempotent) + web + server + ada's runner (scripted runtime by default) → http://localhost:5173 (proxied to :8787)
ADA_RUNTIME=claude npm run dev   # same, with the real `claude` runtime (needs `claude` installed and logged in)
npm run runner         # ada's runner alone (`ADA_RUNTIME=scripted|claude`; see packages/runner/AGENTS.md)
npm run dev:demo       # SPA only against the synthetic demo community (no server)
npm run dev:web        # SPA only, with HMR → http://localhost:5173
npm run dev:server     # server only → http://localhost:8787
npm run check -w @ada/server # server typecheck
npm run smoke          # WS/REST smoke test against a throwaway copy of the course (seeds a temp DB, spare port; never touches the demo DB)
npm run build          # tsc -b && vite build of apps/web → apps/web/dist/
npm run lint           # oxlint over apps and packages; known warnings: only-export-components (card.tsx, ui/sidebar.tsx, community.tsx, identity.tsx, tabs.tsx, button.tsx) and one set-state-in-effect (community.tsx)
npm run typecheck      # tsc -b apps/web (noUnusedLocals/Parameters active: one unused variable breaks the build)
cd apps/web && npx shadcn add <component>   # primitives into src/components/ui (base-nova style, Base UI, lucide icons)
```

No tests. Figure-generator dev screen: open `http://localhost:5173/#figures`.

## Architecture

> Paths in this section are relative to `apps/web/` (the SPA lived at the repo root until 08/22). The types (`types.ts`) now live in `packages/protocol` and `apps/web/src/lib/types.ts` re-exports them.

**No router.** `src/App.tsx` picks the screen from `location.hash` (`#figures` → `FigureSheet`; otherwise `ChannelScreen`). In demo mode it pins `NOW` (`2026-08-22T12:00-03:00`): messages with `at > now` are filtered out and the "today/yesterday" labels are computed against that date; in connected mode `now` is the real clock.

**State = a single context.** `src/lib/community.tsx` → `CommunityProvider` / `useCommunity()`. It receives the full `Community` (immutable in demo mode; hydrated from `GET /api/community` and updated by WS events through `src/lib/api.ts` in connected mode) and exposes:
- `activeChannelId` + `setActiveChannelId`.
- `panels`: the right contextual panel stack, **max 2** (`{kind:"thread"}` | `{kind:"card"}`). `openThread` replaces the previous thread; `openCard` dedupes by `cardId`; the top of the stack is `panels[0]`. `popPanel` goes back, `closePanel` empties it (and the channel takes the full width).
- `member/card/thread/message(id)` lookups that **throw** if the id doesn't exist: one broken id in `demo.ts` takes the whole screen down.
- helpers: `isNew(card, now)` (state `new` and < 24 h), `isAgent`, `formatTime`, `dayLabel` (locale `en-US`).

**Domain model** in `src/lib/types.ts` (commented against `PRODUCT.md`). The non-obvious parts:
- A `Message` isn't text: it's `paragraphs: MessageBlock[][]`, with `text | cite | code` blocks. A `cite` block points to a `Card` (+ optional section) and renders as a citation pill that opens the card in the panel.
- `message.fromCard` = an answer **composed from the card file** (the demo's key moment: the "already on file · N days ago" seal). `message.publishes` = the message is a card's publication card in the flow. `thread.publishedCardId` = the card that closes the thread.
- `Card.state` (`new | updated | superseded | compiling`), `Card.base` (a channel base document, doesn't come from conversation), `Card.replaces`.
- `Agent.scope` (`community | personal`) is a product distinction that must be visible in the UI; `Agent.figureSeed`/`figureColor` feed the agent's figure.
- `Channel.group` (`course | work | private`) and `Channel.work.status` (`active | submitted | archived`) are the sidebar's "drawers".

**Component layers:**
- `src/screens/` — screens. `Channel.tsx` assembles the sidebar (shadcn inset) + two `ResizablePanel`s (channel · context); layout persists in `localStorage["ada:layout:channel"]`. The file's header comment is the screen's design-direction statement.
- `src/components/ada/` — product components. `folder` (tabbed folder panel; `Folder`, `FolderTab`, `FloatingButton`), `channel` (header, `CardRow`, `Conversation`, `Composer`), `panel` (`PanelStack`: Thread and Card), `card` (folded tab `Tab`, `Pill`, `CardState`, `CardTab`, `Cite`, `CardMessage`, and the `TAB_BG/INK/DOT/FILL` maps per `CardType`), `message` (`MessageRow`, `Inline`), `identity` (avatars: people = pastel circle with initials, agents = `Figure`; `agentInk` gives the agent's name color), `markdown` (minimal in-house renderer: `##`, paragraphs, numbered lists, `**`, `*`, `` ` ``; supports nothing else).
- `src/components/ui/` — shadcn-generated primitives. They can be touched, but prefer composing from `components/ada`.
- `src/lib/figure.ts` — **deterministic, seed-based** generator of agent figures (solid silhouette + crown + feet + two eyes; `FIGURE_COLORS` palette). `figureParams(seed)` → `silhouette(p)` (SVG). A new agent = a new seed; "roll another" = change the seed.

**Data:** in connected mode the source is the server (seed in `data/<course>/community.json`); `src/lib/demo.ts` is the demo-mode source (course "Neural Networks 2026"; people `martin`, `sofia`, agents `ada`, `tutor-sofia`; initial channel `questions`, thread `t-explodes`). Everything is fictional and presented as a demo; don't invent figures, testimonials or customers. `CARD_TYPE_LABEL` (type labels) also lives there.

## Design system in the code

Tokens as Tailwind v4 `@theme` in `src/index.css`: colors `ground/panel/panel-2/panel-3/line/ink/ink-2..4/sun/sun-soft/seal/alert/ok`, `tab-<type>` and `tab-<type>-ink` per card type, `status-<status>`; fonts `font-sans` (Inter, UI) · `font-serif` (Literata, cards) · `font-mono` (Geist Mono, code/version); radii `rounded-panel/card/card-tab/control/pill`; `shadow-card/pop`. The shadcn semantic variables (`background`, `primary`, `sidebar-*`…) are mapped to these tokens in `@theme inline`; don't use raw Tailwind colors or violets.

In-house utility classes: `.panel`, `.label`, `.meta`, `.pill`, `.animate-archive`, `.animate-seal`. Source x-ray: `html[data-xray]` dims `[id^="msg-"]` except `[data-xray-target]`.

Named rules that affect code (details in `DESIGN.md`):
- **Tab Rule:** a type color appears only on the folded tab or on a citation's dot. Never on backgrounds, buttons or text.
- **One Sun Rule:** `sun` (#ffd43b) covers one single large surface per screen (the new card) and the "already on file" pills.
- **Three Voices:** Literata for what's read/archived, Inter for what's conversed/operated, Geist Mono for code and version. Don't title cards in Inter.
- Agents: silhouette and two eyes only (no mouths, gradients or shadows); never a "BOT" badge. People: circles.
- No chat bubbles, no violet gradients, no sparkles, no 1 px borders as a depth system.
- Animations only on state changes (archive 360 ms, seal 380 ms, x-ray 300 ms); respect `prefers-reduced-motion`.

## Decisions and open questions (don't resolve them on your own)

- **The "already on file · N days ago" seal.** It can read as a cache ("here's what I already answered"). The correct semantics is "composed from the card file" (see `DECISIONS.md`, commitment 3): a fresh answer, built from existing cards. Copy in `demo.ts`/`card.tsx` to review with the user before changing it.
- **MVP API (from `docs/usecases-api.html` §8):** `fromCard` should become plural (`fromFile: { cardIds[], oldestAgo }`) because composing involves several cards — it changes `types.ts`, `demo.ts`, `message` and `card`; a card's id would be its path in the wiki; the frontmatter has 7 types and the UI 5 (`difficulty` and `person` aren't published to channels); automatic ingest every N messages stays off in the MVP. None of this is decided: ask before implementing.
- **The example agent's name.** `DECISIONS.md` and `demo.ts` call it "Ada"; `PRODUCT.md` says Ada is the product and agents carry other names. Ask before renaming.
- Backend: Buzz fork (`just dev`) vs Plan B (local server + Agent SDK-style runner). The UI and the memory model are the same in both; this SPA is the shell.
- Out of scope for now (don't build): permissions, submission grading, collaborative editing, vector/global search, multi-course, mobile, notifications, work channels beyond the design. Nor gamification or per-student algorithmic personalization: `PROBLEM.md` §9 explains why they miss the problem.

## HTML docs

`docs/` holds self-contained HTML pages (no build, open by double-click) that explain the system to people. They are **future inspiration**: they describe the full product, not today's code, and each says so in its banner. `docs/how-it-works.html` = the mental model (server / runner / runtime / folder, the sequence of a mention, isolation, tiers). `docs/usecases-api.html` = use cases and the expanded MVP API. If `DECISIONS.md` §14-§15 or the OpenSpec change moves, they're updated in the same task.

<!-- empirical-sdd:start -->
## Empirical repository workflow

When `.empirical/config.json` has `schemaVersion: 5` and
`setupComplete: true`, automatically use the repository-local Empirical
workflow for requests to build, add, implement, change, fix, refactor, remove,
migrate, upgrade, change tests, or continue repository work. The user does not
need to mention Empirical. Read-only explanation and inspection stay outside
the workflow.

Read `.agents/skills/empirical/SKILL.md` (or the native project copy) for the
full contract. Use Empirical MCP operations first and private
`empirical __internal` fallbacks only when MCP is unavailable. If the config
is missing, invalid, or incomplete, do not initialize implicitly; tell the user
to invoke `empirical-init` explicitly.
<!-- empirical-sdd:end -->
