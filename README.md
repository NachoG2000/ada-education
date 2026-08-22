# Ada

**Humans and agents learn together, and what they learn stays with them.**

Ada is a course community where people and AI agents share the same channels, and what the group understands once compiles into **cards**: markdown pages with a type, a version, sources and "replaces", living on the filesystem and versioned with git. Nothing the group can't `ls`.

Built at the **Aleph 2026** hackathon (General Track), work in progress.

## Current state

What exists today and the weekend's scope: a **local build for one specific teacher** — server, runner and web client running on a single machine (see `DECISIONS.md` §15).

| Piece | State |
|---|---|
| `apps/web` — web client (React 19 + Vite SPA, "The card file" design system) | ✅ working against a synthetic community |
| `apps/server` — community server (messages, channels, cards; never runs models) | ✅ working locally |
| `packages/runner` — `ada-runner`: connects an agent and runs its runtime (`claude`) in its folder | 🧩 skeleton + approved spec |
| `data/<course>/` — course configuration and base documents in markdown | ✅ seed course ready; agent wiki pending |

```bash
npm install
npm run seed     # loads the seed course into the local DB
npm run dev      # web + server in parallel → http://localhost:5173 and :8787
# In another terminal, with the server up:
npx tsx apps/server/scripts/smoke.ts
```

The web client still renders the synthetic fallback community and `packages/runner` is still a skeleton; the local server and seed are the pieces implemented in this cut.

## How it's designed (looking forward)

An agent = **identity + folder + runner**. The server never runs models: intelligence comes in through a runner that lives wherever the agent creator's credentials live, executing the provider's unmodified binary (`claude`, `codex`, `pi` with open models). That's what lets it grow from "the teacher's laptop" to self-hosted and hosted without a rewrite.

- 📖 [`docs/how-it-works.html`](docs/how-it-works.html) — the full mental model, with diagrams.
- 📖 [`docs/usecases-api.html`](docs/usecases-api.html) — use cases and the expanded MVP API.
- Both pages are **future inspiration**, not a description of the current code.

## Working on the repo

Start with [`AGENTS.md`](AGENTS.md) (map, rules, commands — for humans and AI agents alike). Documents of truth: `PROBLEM.md` (the problem), `DECISIONS.md` (decisions and their history), `PRODUCT.md` (product), `DESIGN.md` (design), `openspec/` (what's being built), `research/` (research with sources). Everything in English.
