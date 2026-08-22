## Context

- There's a Vite + React 19 SPA (`apps/web/src/`) with an already-defined domain model (`lib/types.ts`) and a single state context (`lib/community.tsx`) fed by `demo.ts`. None of that changes shape; the source changes.
- No backend, no git, no Docker. Node 24 brings `node:sqlite`.
- `DECISIONS.md` §14 fixes the topology: **server = bus and archive; runner = a separate process owned by whoever created the agent; runtime = the provider's unmodified binary**. Anthropic's rules (see `research/2026-08-22-subscriptions-runners-buzz-pi.md`) forbid us from brokering subscription credentials; that's why the runner never touches them.
- ~8 h left until the cutoff. The demo runs entirely on one laptop with Claude Code logged in.
- **Scope pivot (`DECISIONS.md` §15):** the weekend is built as a custom build for one specific teacher. Agents by configuration (not UI), plain token, no multi-tenant. The server/runner separation stays because it's what allows growing without a rewrite; the per-area `AGENTS.md` files document that future.

## Goals / Non-Goals

**Goals:**
- Demonstrate the `DECISIONS.md` §11 script end to end with real agents over a real wiki in `data/`.
- Make the public repo read as an open source project with three separately hostable pieces (`apps/server`, `packages/runner`, `apps/web`).
- Make adding a runtime (`codex`, `pi`, open models via pi/Ollama) mean adding an adapter in the runner.

**Non-Goals:**
- Real auth, permissions, multi-course, hosting, mention queue, Nostr, Buzz. Nothing from `DECISIONS.md` §9.
- Local optimism in the client, sophisticated reconnection, DB migrations.
- Rewriting `components/ada` components: they adapt, they don't get redone.

## Decisions

1. **Monorepo with npm workspaces, no Turborepo.** `apps/web`, `apps/server`, `packages/runner`, `packages/protocol`, `data/`. Alternative: leave the SPA at the root and put `server/` next to it. Discarded: the public repo has to show the separation of pieces; moving `src/` to `apps/web/src` is mechanical (15–20 min) and happens first to avoid dragging paths.

2. **`packages/protocol` = the current `types.ts` + events.** Domain types move as-is from `src/lib/types.ts` (the client re-exports them to avoid cascading import changes). `ServerEvent` (`message.created`, `thread.created`, `card.published`, `member.presence`, `agent.created`) and `RunnerEvent` (`agent.mention`, and toward the server `message.create`, `card.publish`, `presence`) are added, validated with `zod`. One place of truth for three processes.

3. **Server: Hono + `@hono/node-server` + `@hono/node-ws` + `node:sqlite`.** No ORM: one `schema.sql` and small functions. Tables: `members`, `agents` (token_hash, runtime, model), `channels`, `channel_members`, `messages` (paragraphs as JSON), `threads`, `cards` (unique key `(author_id, path)`), optional `card_versions`. Alternative Postgres + Drizzle: more "serious", but costs an hour that doesn't exist and forces Docker for the demo. SQLite in one file is also coherent with the "nothing the group can't `ls`" thesis.

4. **Mentions are detected by the server, not the client.** Regex `@<handle>` over `text` blocks; handle = the member's `id`. That way a message written by another agent or by `curl` also triggers the mention, and the client doesn't need to know what an agent is.

5. **No mention queue.** Disconnected runner = away agent; the mention is lost and the UI says so. It's what Buzz does and avoids a job system. Hosted (future) solves "always on".

6. **Cards are published from the filesystem, not from the model.** The runner snapshots `wiki/` before and after the run and publishes what changed. The runtime needs no publish API or MCP: it writes files, which is what it does best. "From the card" = nothing changed in `wiki/` and there's a citation. A deterministic rule, without a second model call.

7. **Citations use `[[path]]` syntax.** They resolve to a `cardId` by `(agent, path)` on the server. Saves the model from having to know ids.

8. **Runtime `claude` = `claude -p` with narrow permissions.** Base command (verify against `claude --help` when implementing): `claude -p <prompt> --output-format json --permission-mode acceptEdits --allowedTools "Read,Write,Edit,MultiEdit,Glob,Grep,Bash(git add:*),Bash(git commit:*)" --add-dir <data/<course>/raw>`. `--add-dir` because base documents live outside `cwd`. Also, `agents/<agent>/.claude/settings.json` with `deny` rules (`Write(../../raw/**)`, `Edit(../../raw/**)`, `Read(../../../**)` outside the course) so `raw/` is read-only and the agent doesn't leave its course: it's isolation layer 1 from `DECISIONS.md` §14.7 (policy, not wall; the wall is a per-agent container in hosted). The binary isn't modified or wrapped: it's spawned. `codex` (`codex exec --cd <cwd> --json`) and `pi` (`pi -p --mode json`) follow the same interface; they're written down but untested.

9. **Client identity = `localStorage["ada:me"]`.** No auth. The server trusts `authorId`. Enough for a local demo; hosted will need per-member keys (invite by link, `PRODUCT.md`), out of scope.

10. **Demo mode is kept.** `demo.ts` isn't deleted: it's the serverless fallback and serves a static client deploy in the README.

## Risks / Trade-offs

- **`claude -p` latency.** A run with wiki reads + card writes can take 30–90 s. Mitigation: visible `thinking` presence, 180 s timeout, and short questions in the demo. If time remains, use `--output-format stream-json` to show progress.
- **Non-interactive permissions.** If the permission flags fall short, Claude Code can refuse to write and the card won't appear. Try the command by hand against `agents/ada` before wiring the runner (task 5.2).
- **Moving the SPA breaks paths** (`components.json`, `tsconfig.app.json`, `vite.config.ts`, `@/` alias). Mitigation: move first, run `npm run build` before continuing.
- **Personal-plan rate limits.** Irrelevant for the demo; noted in `DECISIONS.md` §14 for the hosted tier.
- **Without local optimism**, the UI takes a round trip to show what you wrote. Acceptable on localhost.
- **Time.** Tasks are ordered by the demo script: if something must be cut, cut from the end (the pre-seeded personal-agent extension goes first; then `codex`/`pi` as adapters).
