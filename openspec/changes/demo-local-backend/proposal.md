## Why

The SPA runs against a synthetic community (`apps/web/src/lib/demo.ts`). There's no server, no real agents and no filesystem wiki: nothing of the `DECISIONS.md` §1–§6 thesis can be demonstrated yet. The Buzz fork (§7) didn't happen and the 14:00 checkpoint passed, so this change executes §7's **Plan B** (our own server + the same `data/` + the agent CLI), with the §14 topology: **an agent = identity + folder + runner**, and the server never runs inference.

**Scope (mentor's pivot, `DECISIONS.md` §15): a custom build for one specific teacher, everything on their machine.** Course, channels, people and agents defined in `data/<course>/community.json`; no agent creation from the UI, no student personal agents, no token hashing, no hosting. The repo will be public: the structure still makes it clear that server, runner and client are separate pieces that grow separately tomorrow (each area's `AGENTS.md` describes that future).

## What Changes

- **Monorepo with npm workspaces.** The SPA moves to `apps/web`. `apps/server` (community server), `packages/runner` (the `ada-runner` CLI that runs agents) and `packages/protocol` (shared types and events) are born. Courses live in `data/<course>/`.
- **Community server** (`apps/server`): Node 24 + Hono + `node:sqlite` + WebSocket. Stores members, channels, messages, threads and **published cards**; detects mentions of agents and forwards them to the connected runner; broadcasts presence. It calls no model.
- **Runner** (`packages/runner`): a separate process that connects *outbound* to the server with an agent's token, receives mentions, executes the chosen runtime (`claude` this weekend; `codex` and `pi` as adapters with the same interface) with `cwd` in the agent's folder, converts citations to cards, detects new/modified cards in `wiki/` and publishes them, and makes one commit per run.
- **Agent wiki** (`data/<course>/agents/<agent>/`): `CLAUDE.md`/`AGENTS.md` with the §6 rules, `wiki/index.md`, `log.md`, fixed frontmatter. Seed course `neural-networks-2026` with `raw/martin/modules/03-backprop/backprop.md`.
- **Web client** (`apps/web`): replaces `demo.ts` with a client of the server (REST bootstrap + WS events) behind the same `CommunityProvider`; shows agent presence. Without `VITE_ADA_SERVER`, it keeps working with the synthetic demo. Agent creation from the UI stays out of the weekend (§15): agents are defined in the course configuration.

## Capabilities

### New Capabilities
- `community-server`: community state (members, channels, messages, threads, published cards), REST API for bootstrap and writing, WS events for clients and runners, mention detection, agent presence, course seed.
- `agent-runner`: CLI that connects an agent to the server, executes the runtime with `cwd` in its folder, builds the prompt with the immediate layer, publishes cards and answers, reports presence, and exposes the runtime interface (`claude` | `codex` | `pi`).
- `agent-wiki`: the agent folder's layout, card frontmatter, agent rules (`CLAUDE.md`), the citations and "answered from the card" contract, ingest and git versioning.
- `web-client`: the client's live connection to the server, local user identity, presence, composing with mentions, agent creation, and the serverless demo mode.

### Modified Capabilities
<!-- No prior specs in openspec/specs: everything is new. -->

## Impact

- `src/` → `apps/web/src/` (move, don't rewrite). `vite.config.ts`, `tsconfig*.json`, `components.json`, `index.html`, `public/` come along.
- The root `package.json` becomes the workspace; the `dev`, `build`, `lint` scripts are redefined for the whole monorepo.
- New dependencies: `hono`, `@hono/node-server`, `@hono/node-ws`, `zod`, `commander` (or `citty`), `ws` in the runner. No ORM, no Postgres, no Docker this weekend.
- `AGENTS.md`/`CLAUDE.md` and `README.md` get updated to the new layout (they stop saying "this repo holds only the UI").
- Requires `git init` of the repo (it isn't a repository today) and, separately, `git init` inside each agent folder for wiki versioning.
- Claude Code installed and logged in on the demo laptop; the runner handles no credentials.
