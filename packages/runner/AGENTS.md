# packages/runner — ada-runner

**Workspace UI boundary (2026-08-24):** the Buzz-parity work does not move model execution into the SPA/server. Agent creation and token rotation now happen in the UI and return a one-time `setupCommand`; this process still connects outbound with that token and keeps provider access in its own environment. Deactivation or deletion revokes the server-side connection. Card/module/report behavior remains available to conversation publications even though their dedicated pages are no longer mounted (`DECISIONS.md` §21).

**Today:** working, subscription-backed `claude` and `codex` runtimes. `src/cli.ts` is opt-in: create an agent in the UI, copy its one-time setup command, then run it from the root or invoke `tsx packages/runner/src/cli.ts --cwd <agent-folder> --token <token> --runtime claude|codex --server http://localhost:8787`. The runner connects outbound and authenticates in the first WebSocket frame, announces presence, receives tenant-scoped mentions, runs the provider CLI in the agent workspace, and publishes replies/cards through the server. Ada never asks for or stores provider API keys; the local Claude/Codex CLI remains responsible for the creator's subscription login.

The old `scripted` fixture runtime is retained only through `src/legacy-fixture-cli.ts` for legacy server/Docker checks; it is not the package binary and is not started by `npm run dev` or the root `runner` command. The agent's rules are bootstrapped into its workspace from the server-provided configuration.

**Execution boundary:** the process makes an agent exist by receiving scoped work, running `claude -p` or `codex exec` with `cwd` set to the agent folder, turning valid `[[path]]` citations into card references, publishing changed `wiki/**/*.md`, posting the answer and making one local git commit per run when the agent folder is its own repository. Materials are supplied to the provider only as bounded read-only excerpts; neither adapter gets an additional writable materials root. Ada transport/provider secrets are redacted from diagnostics and removed from the provider child environment. `npm run check:providers -w @ada/runner` verifies argument shape, auth hints, timeouts, output handling, redaction and API-key stripping; `check:scripted` covers the retained fixture harness.

**How it grows (idea, not code):** distributable runner packaging, durable work delivery and optionally hosted/API-key or open-model runtimes can be added later without moving model execution into the community server (`DECISIONS.md` §14, `docs/how-it-works.html`).

## Automatic installation host (2026-09-06; supersedes manual UI setup above)

`src/host.ts` starts and reconciles agent workers through installation-only
enrollment. `npm run dev` starts it automatically; `npm run runner:host` runs
it separately with administrator configuration. Credentials and workspaces
persist under ignored `.ada/` (override with `ADA_HOST_STATE`). A PID lock
prevents two local hosts using the same state. IPC grants one model invocation
at a time. Unix process groups stop provider descendants on deletion/exit.
Work frames carry current rules; DMs require no mention. The old manual CLI
is retained, but the mounted UI no longer exposes enrollment or model setup.

Subscription-backed execution remains the default and strips provider API keys.
`ADA_PROVIDER_AUTH=api-key` explicitly enables a required provider key and
removes OAuth token overrides. The server never receives these credentials.
`apps/server/scripts/automatic-agents-check.ts` exercises real host/workers
with a fake provider. See `docs/agent-host.md` for recovery and limitations.

**Development reload (2026-09-07):** `npm run dev` uses `runner:host:dev`, with tsx watch explicitly including runner and protocol sources. The host imports only part of the runner graph; its child processes otherwise retain old schemas until restart. Standalone `runner:host` remains unwatched. Source reload may interrupt active work; this is a development tool, not durable job delivery.

## Pi runtime (2026-09-07)

`ADA_RUNTIME=pi` uses the pinned Pi CLI in ephemeral print mode with its own
ChatGPT OAuth login and the `openai-codex` provider. `pi-extension.ts` registers
only three wrappers around official Pi file tools; `pi-workspace.ts` confines
them to wiki markdown/log writes and read-only workspace instructions. Built-in
and discovered tools/resources are disabled. This is not OS sandboxing.
`check:providers` includes real Pi tool/loader and signed-out CLI checks;
`check:agents:pi` in the server verifies the full host path with a fake binary.
See `docs/agent-host.md` for login and `npm run dev:pi`. Existing runtimes remain.

**Shared voice (2026-09-07):** `agent-prompt.ts` supplies role-focused, honest
identity guidance and configured runtime/model facts to every provider's
system/developer instruction channel. `cli.ts` supplies the authenticated agent
name. Keep this separate from editable course rules and preserve existing wiki
files. Meta-conversation is excluded from card creation by prompt guidance.

## Governed memory (§34)

Hosted work now uses `memory-run.ts` and `memory.work` frames. The runner creates
a fresh temporary authorized view, runs Pi with `pi-memory-extension.ts`, parses
strict proposals from result.json, and returns one correlated result. The server
owns admission and publication. Old wiki/material prompts are never mixed in.
Read/write tools validate traversal, links and special files on each operation;
no shell, built-ins, discovered context or sessions are enabled. Cleanup runs on
success and handled failure. This is a model tool boundary, not OS isolation.
Claude/Codex governed work fails closed until equivalent tools exist. Legacy
adapters remain tested separately. Run `check:memory` and the server's real
host/fake-Pi integration check after changing this boundary.
