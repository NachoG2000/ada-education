# Ada

**Humans and agents learn together, and what they learn stays with them.**

Ada is a course community where people and AI agents share the same channels, and what the group understands once compiles into **cards**: markdown pages with a type, a version, sources and "replaces", living on the filesystem and versioned with git. Nothing the group can't `ls`.

Open source under **Apache-2.0**, built for **organizations that run cohort-based courses — bootcamps, academies, corporate training programs, universities** — starting with a fully local deployment any teacher can run on one machine. Work in progress.

## Current state

What exists today: a **fully local build** — server, runner and web client running on a single machine (see `DECISIONS.md` §19 for the direction, §15 for how this shape came to be).

| Piece | State |
|---|---|
| `apps/web` — web client (React 19 + Vite SPA, "The card file" design system) | ✅ working against the local server |
| `apps/server` — community server (messages, channels, cards; never runs models) | ✅ working locally |
| `packages/runner` — `ada-runner`: connects an agent and runs its runtime in its folder | ✅ two runtimes: `claude` (real) and `scripted` (deterministic, fills from live state) |
| `data/<course>/` — the course on the filesystem: config, base documents, the agent's wiki | ✅ seed course with 11 compiled cards, modules, an assignment, feedback and a report |

## What it does end to end

The teacher and the student see two views of the same community, gated by role:

- **The teacher** (`#modules`) drops study material on a module. The agent's runner ingests it, publishes one card per section into the module's channel, and proposes a difficulty (intro · core · advanced) with a rationale and cohort evidence — the teacher's hand-set level always wins.
- **The student** (`#home`) reads the feedback on their last assignment: score, what went well, where it slipped and in which module, next steps with citation pills that open the card. Asking the agent "how do I get ahead in 03-backprop?" returns a plan built from that module's cards and their own feedback gap.
- **The loop closes**: the agent files for the teacher what it advised — its own summary and recommendations for the module, never the student's messages — and the student's plan says so on screen. The teacher accepts the recommendations they want, and that lands as a `decision` card in the module's channel that anyone in the course can read.

Every card is a markdown file in the agent's folder, versioned with git. `ls` is the audit interface.

```bash
npm install
npm run dev      # seeds, then web + server + Ada's runner → http://localhost:5173
```

`npm run dev` uses the `scripted` runtime; `ADA_RUNTIME=claude npm run dev` runs the real one (needs `claude` installed and logged in). `npm run dev:demo` runs the SPA alone against a synthetic community, no server.

Verify the whole flow without a browser — it drives a real server and a real runner process against a throwaway copy of the course, and asserts the four steps above at the API:

```bash
npm run check:e2e -w @ada/server   # 15 checks
npm run check:seed -w @ada/server  # the seeded course the screens render
npm run smoke                      # WS/REST smoke test
```

`./scripts/reset-demo.sh` puts the course back to a clean state between runs.

## How it's designed (looking forward)

An agent = **identity + folder + runner**. The server never runs models: intelligence comes in through a runner that lives wherever the agent creator's credentials live, executing the provider's unmodified binary (`claude`, `codex`, `pi` with open models). That's what lets it grow from "the teacher's laptop" to self-hosted and hosted without a rewrite.

- 📖 [`docs/how-it-works.html`](docs/how-it-works.html) — the full mental model, with diagrams.
- 📖 [`docs/usecases-api.html`](docs/usecases-api.html) — use cases and the expanded MVP API.
- Both pages are **future inspiration**, not a description of the current code.

## Working on the repo

Start with [`AGENTS.md`](AGENTS.md) (map, rules, commands — for humans and AI agents alike). Documents of truth: `PROBLEM.md` (the problem), `DECISIONS.md` (decisions and their history), `PRODUCT.md` (product), `DESIGN.md` (design), `openspec/` (what's being built), `research/` (research with sources). Everything in English.
