# Buzz fork vs. own web frontend — where the discussion stands (2026-09-01)

Date: 2026-09-01. Question from Ignacio: the repo has gone back and forth
between (a) forking Buzz to validate the idea fast without building a chat
frontend, and (b) building Ada's own web client + server that deploys to
Railway in one click but whose frontend keeps needing polish that the AI
agents report as done and a human eye does not see. This file collects where
each turn of that discussion is recorded, what was re-verified about Buzz
today, and an assessment of the options. **No decision is taken here**; if one
is taken it goes to `DECISIONS.md` as a new dated section.

Verification levels: **✓ primary** (read in the original source / local
checkout), **~ snippet**, **≈ secondary**.

## 1. Where the discussion lives in the repo

| Turn | Where | What it says |
|---|---|---|
| Fork Buzz as the plan | `DECISIONS.md` §3, §4, §5, §7 | Buzz = relay + desktop + `buzz-acp`; "our work is the wiki, the agent's skill, and the course layer". §5: "same three-panel layout as Buzz and same components, so it feels familiar". §8 discards "building the chat from scratch". |
| The fork fails on the clock | `DECISIONS.md` §7 note, §13 | "The Buzz fork didn't happen before the 14:00 checkpoint" (08/22). Plan B (own server + same `data/` + agent CLI). The cause beyond "`just dev` didn't come up" is not recorded. |
| Plan B becomes the architecture | `DECISIONS.md` §14, `openspec/changes/demo-local-backend/proposal.md` | Identity + folder + runner; server never runs models. Own Hono/SQLite server, own runner, own SPA. |
| Scope narrowed, then widened | `DECISIONS.md` §15 → §19 | One teacher on one machine → open-source product for course-running organizations. Deployment shape unchanged. |
| Buzz as pattern, not code | `DECISIONS.md` §20, `research/2026-08-23-buzz-identity-and-agents.md`, `research/2026-08-23-railway-deploy-template.md` | Railway template copies Buzz's identity pattern with tokens instead of Nostr keys; runners outside; "beat Buzz on plug-and-play" (no desktop install, no key generation). |
| Buzz's UI as a catalogue | `research/2026-08-23-buzz-ui-map.md` §11 | Inventory of the desktop shell; "copy vs omit" boundary for a first Ada chat/config pass. Never executed. |
| The polish gap, measured once | `research/2026-08-22-frontend-audit.md` | Pre-fix health 10/20 ("Acceptable"); fixes were checklist items (a11y, tokens, named rules, dead controls). Nothing in it measures how the UI reads against a reference product. |

Net: §8 discarded "building the chat from scratch" on 08/22 at noon, and by
08/22 at night the repo was doing exactly that (`apps/web`), because the fork
missed a two-hour checkpoint. The "same components as Buzz" intent of §5 was
never carried into Plan B.

## 2. Buzz re-verified today (✓ primary, local checkout fetched 2026-09-01)

Checkout `/Users/ignaciogarcia/Desktop/Personal/buzz`, `origin/main` at
`e5a7e26a1` (2026-09-01); **128 commits since `0720f53` (08/23)**, i.e. ~14
per day.

- **Client is a Tauri desktop app.** `desktop/src`: 1,532 `.ts/.tsx` files
  (tests excluded), 75 of them import `@tauri-apps/*`. `desktop/README.md:13`
  says `pnpm dev` "runs the web frontend", and `App.tsx` guards Tauri-only
  calls with `isTauri()`, so the React app renders in a browser for
  development and e2e — but identity is an OS keyring for `nsec` keys
  (`desktop/src-tauri/Cargo.toml:25-42`, `features/onboarding/*Keyring*`),
  agent runtimes are installed/spawned from the desktop, and native chrome,
  tray, updater and notifications are Tauri plugins. `web/` is a public
  repository browser, `mobile/` is Flutter, `admin-web/` is "Buzz admin".
  There is no hosted web chat client to fork.
- **UI stack is close to Ada's.** React 19, Tailwind v4 (`@tailwindcss/postcss`
  4.3), Radix primitives, lucide, TipTap composer, `tailwind-merge`. Ada:
  React 19, Tailwind v4, shadcn on Base UI, lucide. Porting components is
  adaptation, not a rewrite.
- **Identity is Nostr keypairs + NIP-42 everywhere** (relay in Rust, client,
  harness). Ada decided against students managing keys (§20).
- **Buzz's own direction is software teams** (`VISION.md` opens with a 2am
  production incident; `VISION_PROJECTS.md`, `VISION_MESH.md`,
  `VISION_SOVEREIGN.md`, `VISION_MODERATION.md`). Block accepts no external
  PRs (§3), so a fork only diverges.
- **Ada today:** `apps/web/src` 8,382 lines; `apps/server` + `packages/runner`
  + `packages/protocol` 4,173 lines. Server, protocol, runner, seed, gated
  membership check and the Railway Dockerfiles exist and are verified by
  `npm run smoke` / `npm run check:gated` (see `deploy/README.md`).

## 3. Assessment

**What forking Buzz would actually cost now.** The polished part of Buzz is
a desktop client; the one-link, no-install story of §20 would need a web
client that Buzz doesn't have. Replacing Nostr identity with tokens touches
the Rust relay, the client and the harness. The stack becomes Rust + Postgres
+ Redis + MinIO + pnpm + Tauri for a one-to-two-person team, on a codebase
~10× Ada's that moves ~14 commits a day with no upstream path. And Ada's
differentiators (typed, versioned, superseding cards; the "from the file"
seal; card strip; Modules; My study; agent reports) are not in Buzz — its
Canvas is the nearest thing and the UI map excludes it — so the product work
would still have to be built, inside someone else's conventions. The fork
buys a polished *Slack*, not a polished *Ada*.

**Why the own frontend keeps reading as unpolished.** The shell (sidebar,
message list, composer, thread panel) is a commodity judged against Slack,
Discord and Buzz. The audit and the agents' "polished" reports measure
checklists (contrast, tokens, named rules, dead buttons), which is not what a
human eye compares. The gap is density, behaviors and states (unread, hover,
loading, empty, keyboard), not defects.

**Middle path worth costing: port Buzz's shell into Ada, keep Ada's
platform.** Apache-2.0 allows lifting components with attribution in
`NOTICE`. Same React/Tailwind v4/Radix-family stack. Candidates from the UI
map §11: sidebar sections and rows, stream + thread conversation, composer
with mentions, channel browser/create, member/profile panels, keyboard
registry, loading/empty/error states. Ada keeps server, protocol, runner,
token identity, Railway template, cards and `DESIGN.md` tokens (Buzz's
structure and behaviors under Ada's skin). This is §5's original intent
applied to Plan B. Risk: `DESIGN.md`'s identity (Literata cards, One Sun,
folded tabs) has to be reconciled with a denser shell; that is a design
decision, not a code one.

**If the goal is validating the thesis, not shipping a chat.** The cheapest
validation of `PROBLEM.md` §7.1–7.3, 7.6, 7.7 needs no chat UI at all: the
runner + wiki + cards attached to a chat the course already uses, plus a
read-only web page for the card file. It weakens 7.8 ("one more member, not
the platform's bot") and the "community owns the platform" commitment, so it
is a validation shortcut, not the product.

**Process fix regardless of path.** "Polished" is not an agent's claim to
make. Define it as a side-by-side against one reference (Buzz desktop or
Slack) at a fixed viewport for a fixed list of screens and states, judged by
a person on screenshots; agents diff against the reference, they don't grade
themselves.

## 4. Open for Ignacio

1. Fork Buzz's platform, port Buzz's shell into Ada, keep building Ada's
   shell by hand, or validate without a chat UI first.
2. If porting: which `DESIGN.md` rules survive a Slack-density shell.
3. Record the outcome as `DECISIONS.md` §21 with the date.
