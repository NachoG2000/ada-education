# Pi as an Ada runtime candidate

Date: 2026-09-07. Status: exploration, no runtime or memory decision adopted.

The user supplied https://pi.dev/ and asked whether Pi could use an OpenAI
subscription instead of Claude, whether it is lighter, and whether it is worth
considering before implementing course memory.

## Verified documentation

All external sources below were opened and verified in their original pages on
2026-09-07, not inferred from search snippets.

- Pi documents ChatGPT Plus/Pro (Codex) subscription login through `/login`:
  https://github.com/earendil-works/pi/tree/main/packages/coding-agent
  (Providers & Models). This is Pi's compatibility claim; no live login was tested.
- OpenAI documents ChatGPT sign-in for subscription access in Codex CLI, distinct
  from usage-based API-key access: https://learn.chatgpt.com/docs/auth
  (OpenAI authentication). This page does not establish a blanket entitlement
  to operate a hosted multi-user service through Pi on one subscription.
- Pi offers a minimal harness, configurable context, extensions, JSON output,
  RPC and an embedded SDK: https://pi.dev/ (Why Pi, Context engineering, Four modes).
- Its SDK supports explicit tool selection, disabling built-in tools, custom
  tools and event subscriptions: https://pi.dev/docs/latest/sdk (Tools,
  Custom Tools, Extensions). A working directory is not by itself an OS sandbox.
- Pi leaves permission flows and sandboxing to additional integration:
  https://pi.dev/ (What we didn't build).

## Existing Ada implementation

- `packages/runner/src/runtimes/providers.ts` already supports Claude and Codex.
  Codex runs through `codex exec` in the agent workspace with workspace-write
  sandboxing; subscription mode strips provider API-key environment variables.
- `docs/agent-host.md`, Administrator configuration, exposes `ADA_RUNTIME=codex`
  and subscription authentication. Switching providers does not require Pi.
- `DECISIONS.md` §§6, 14, 24–25 retains filesystem memory and independent agent
  workspaces. Pi would be an execution option inside the external runner; it
  does not determine shared-memory ownership or replace Ada's SQLite server.

## Assessment and proposed evaluation

Pi is plausibly a better fit when Ada needs direct control over course tools,
context assembly and memory writes. This is an architectural assessment, not a
measured performance result. No RAM, startup, latency, token or answer-quality
benchmark was performed, so smaller core scope does not prove faster or cheaper
replies. Custom tool restrictions and isolation would require deliberate work.

Recommendation: use the existing Codex adapter if the immediate goal is OpenAI
subscription access. Before committing to a richer memory implementation,
evaluate Pi through a bounded runtime experiment using the same model, source
files and prompts: answer with a valid citation, preserve reusable knowledge,
handle a correction, and reject access outside the authorized course context.
Keep durable course knowledge in Ada-owned files and contracts, independent of
the selected harness and its session history. This experiment is proposed only;
no packages were installed, authentication attempted, or application code changed.

## Implementation authorized and completed (2026-09-07)

The user's follow-up, “ok lets try pi then. implement that please,” authorized
the optional adapter described in `DECISIONS.md` §28. This supersedes the
exploration-only status above. Pi 0.85.1 is pinned in `@ada/runner`; `npm run pi`
opens its CLI and `npm run dev:pi` selects it for the installation. The default
Claude path is retained. No live instance was switched during this task.

Additional original sources verified on 2026-09-07:

- https://pi.dev/docs/latest/usage — print mode accepts stdin, ephemeral
  sessions, explicit extensions, resource-discovery switches and tool allowlists.
- https://pi.dev/docs/latest/extensions — extension tool registration; official
  tool definitions can be wrapped with application-specific execution logic.
- https://pi.dev/docs/latest/providers — Pi owns OAuth login and refresh in its
  auth directory; ChatGPT Plus/Pro uses the Codex subscription provider.
- https://www.sqlite.org/lang_altertable.html §8 — create/copy/drop/rename
  procedure for changing table constraints. Migration 8 preserves every agent
  column and restores the index. No current table has an incoming foreign key
  to tenant_agents, so its rebuild retains foreign-key enforcement throughout.
- Installed 0.85.1 declarations and source: `createReadToolDefinition`,
  `createWriteToolDefinition`, `createEditToolDefinition`,
  `DefaultResourceLoader`, and CLI argument handling. The npm binary is the
  package's bundled CLI. Login is interactive `/login`; this version does not
  expose an `auth login` subcommand.

The adapter uses official print mode and three explicitly registered wrappers
around Pi's file tools. It confines writes to visible wiki markdown and log.md,
allows read-only local instructions, rejects links/hidden paths/outside paths,
and disables built-in tools and resource discovery. This application-level
boundary assumes no external process races filesystem mutations; it does not
claim OS sandboxing. Provider API-key mode and provider-qualified model
overrides are refused. Ada's existing wiki publication pipeline is retained.

Validation completed:

- `npm run check` passed: lint (existing warnings), docs, all TypeScript,
  hosted/legacy REST and WebSocket flows, providers, both automatic-agent
  runtime checks, educational checks, build, migrations and smoke tests.
- The real Pi resource loader loaded the extension with exactly its three tools.
  Real read/write/edit operations preserved markdown and refused outside,
  symlink, hard-link, hidden, instruction-write and non-markdown targets.
- The actual bundled Pi executable accepted the adapter options and produced
  the expected actionable authentication failure with a fresh temporary auth
  directory. No subscription call was made.
- Fake Pi host checks verified starter enrollment, DMs, first-mention replies,
  rule updates, serialized execution, restarts, deletion and correlated wiki
  publication acknowledgements. Version-7 migration checks retained active and
  deleted agent fields/digests and accepted Pi after reopening.
- `git diff --check` passed. npm audit reported fast-uri 3.1.5 and qs 6.15.3;
  both versions were already present in HEAD and were unchanged by this task.

Pi has no OpenAI OAuth credential on this machine. A live model/answer-quality
test remains dependent on the user's interactive Pi login. No comparative
speed, RAM, token-efficiency or memory-quality claim is established.

## Requested Luna model (2026-09-07)

The user reported completing Pi login and selected GPT-5.6 Luna.
`npm run pi -- --list-models luna` verified `openai-codex/gpt-5.6-luna`
in the installed Pi catalog. The original OpenAI model page was also opened:
https://developers.openai.com/api/docs/models/gpt-5.6-luna (verified 2026-09-07).
`npm run dev:pi` now explicitly passes `ADA_MODEL=gpt-5.6-luna` to the server
and host; this supersedes the unspecified model for that convenience command.

Live verification passed using the real Pi adapter, the user's subscription
login, and `gpt-5.6-luna` in a disposable workspace: the model read the wiki
index and returned its verification phrase, “Luna ready.” Temporary files were
removed; no course conversation or wiki was used. Documentation checks passed.
