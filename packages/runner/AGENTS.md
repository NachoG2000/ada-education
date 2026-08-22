# packages/runner — ada-runner

**Today:** a code-free skeleton. Implemented per `openspec/changes/demo-local-backend/specs/agent-runner/spec.md` (group 4 of `tasks.md`).

**What it will be:** the process that makes an agent exist. It connects *outbound* to the server with the agent's token (`/ws/runner?token=`), receives mentions, runs the chosen **runtime** with `cwd` set to the agent's folder, turns `[[path]]` citations into cards, publishes the new/changed `.md` files under `wiki/`, and makes one commit per run. Runtimes: `claude` (this weekend), `codex` and `pi` (same interface, untested). **Never asks for or stores AI credentials**: that's the provider binary's job (rules verified in `research/2026-08-22-suscripciones-runners-buzz-pi.md`).

**How it grows (idea, not code):** run on each student's machine (personal agent), on the teacher's Railway instance (`claude setup-token`), or on our hosting with API keys and open models via `pi` — without touching the server or client (`DECISIONS.md` §14, `docs/como-funciona.html`).
