# Ada

**Humans and agents learn together, and what they learn stays with them.**

Ada is a course community where people and AI agents share the same channels, and what the group understands once compiles into **cards**: markdown pages with a type, a version, sources and "replaces", living on the filesystem and versioned with git. Nothing the group can't `ls`.

Open source under **Apache-2.0**, built for **organizations that run cohort-based courses — bootcamps, academies, corporate training programs, universities**. The current milestone is a hosted-service demo foundation that is also easy to run locally. Work in progress.

## Current state

What exists today: a multi-community hosted-service foundation — a web client, tenant-scoped REST/WS server, and opt-in local Claude/Codex runner (see `DECISIONS.md` §22 and GitHub issue #1).

| Piece | State |
|---|---|
| `apps/web` — React 19 + Vite SPA with the Buzz-shaped shadcn workspace shell | ✅ connected to the local server by default |
| `apps/server` — tenant-scoped community API, SQLite persistence, messages, channels, DMs, agents, invites, and WS events | ✅ working locally |
| `packages/runner` — outbound subscription runner for hosted agents | ✅ Claude and Codex adapters; no API key is handled by Ada |
| cards/filesystem memory | ✅ backend pipeline remains available; card UI is intentionally not mounted in this milestone |

## What it does end to end

Users create an account once, then belong to many communities with a role per membership. The shell supports a community switcher, public channels, private user-agent DMs, threads, mentions, member management, invite codes, and agent setup. Messages and moderation events are persisted and projected over authenticated first-frame WebSockets.

The former Modules/My study/card-file screens remain in the source tree as history but are not product routes in this phase. Cards are still markdown files in the runner's workspace and can be published through the backend; there is no card UI yet.

```bash
npm install
npm run dev      # fresh web + server → http://localhost:5173
```

## Connect an agent locally

Create an agent in the UI and run the one-time setup command it provides. The
runner authenticates with its agent token over the first WebSocket frame and
uses the creator's logged-in Claude or Codex subscription; Ada stores no
provider API keys. It is intentionally opt-in, and an empty local database
starts with the normal account/community onboarding flow.

Deployment and hosted runners are deliberately outside issue #1. `deploy/`
retains the earlier single-course Railway work and its compatibility check as
history; it is not the runbook for this multi-community milestone.

Verify the whole flow without a browser — it drives a real server and a real runner process against a throwaway copy of the course, and asserts the four steps above at the API:

```bash
npm run check:e2e -w @ada/server    # 15 checks
npm run check:gated -w @ada/server  # membership gating + remote runner, 25 checks
npm run check:seed -w @ada/server   # the seeded course the screens render
npm run smoke                       # WS/REST smoke test
```

`npm run check:issue1` runs the hosted protocol, tenant/API/WS, and runner-provider checks. Legacy fixture checks remain available for the preserved Neural Networks import.

## How it's designed (looking forward)

An agent = **identity + folder + runner**. The server never runs models: intelligence comes in through a runner that lives wherever the agent creator's credentials live, executing the provider's unmodified binary (`claude`, `codex`, `pi` with open models). That's what lets it grow from "the teacher's laptop" to self-hosted and hosted without a rewrite.

- 📖 [`docs/how-it-works.html`](docs/how-it-works.html) — the service, runner, and card-memory mental model.
- 📖 [`docs/usecases-api.html`](docs/usecases-api.html) — use cases and API direction.
- The pages retain future-facing material, with the current issue #1 boundary called out where it differs.

## Working on the repo

Start with [`AGENTS.md`](AGENTS.md) (map, rules, commands — for humans and AI agents alike). Documents of truth: `PROBLEM.md` (the problem), `DECISIONS.md` (decisions and their history), `PRODUCT.md` (product), `DESIGN.md` (design), `openspec/` (what's being built), `research/` (research with sources). Everything in English.
