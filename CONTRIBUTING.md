# Contributing to Ada

Start with the [README](README.md) for setup and the
[architecture guide](docs/architecture.md) for the mounted code paths.
Read [AGENTS.md](AGENTS.md) and the `AGENTS.md` in each area you change.
Use English for code, UI, documentation, and sample data.

## Development

Use Node 24 and the root npm workspace lockfile. `npm ci` reproduces the
locked installation; use `npm install` when intentionally changing
dependencies and include the updated `package-lock.json`. Do not create
workspace-local lockfiles.

`npm run dev` starts the API, web client, and automatic agent host together.
Sign in to Pi once with `npm run pi` → `/login` → ChatGPT Plus/Pro (Codex) to use agents; see `docs/agent-host.md`. `npm run seed` imports the
legacy course for compatibility work; it is not required for onboarding and
does not populate the current hosted community model.

| Command | What it verifies |
|---|---|
| `npm run check` | Complete local/CI gate |
| `npm run check:hosted` | All TypeScript, hosted protocol and REST/WS flows, provider adapters, web build |
| `npm run check:legacy` | Retained workspace, fixture runner, seed, end-to-end, membership-gated, and smoke flows |
| `npm run typecheck` | Protocol, server, runner, and web TypeScript |
| `npm run typecheck:web` | Web TypeScript only |
| `npm run lint` | Oxlint over apps and packages |
| `npm run check:docs` | Current-state and historical documentation contracts |
| `npm run check:workspace` | SQLite migrations/reseed, access, CRUD, attachments, and WebSockets in retained APIs |
| `npm run build` | Web TypeScript and production bundle |

The old `npm run check:issue1` name remains an alias for `check:hosted`.
Provider checks use fake local binaries; fixture end-to-end checks use the
scripted runner. They prove transport and adapter behavior, not live model
quality. Tests create throwaway databases/course folders and may open local
ports. Keep checks sequential: some fixture scripts reserve fixed ports.

`npm run check:docker` separately validates retained deployment history and
requires Docker. It is outside the standard hosted-development gate.

## Making a change

1. Identify the problem, affected workspace, and current requirement before
   changing code. Keep each change focused enough to review on its own.
2. Put network schemas in `packages/protocol`, authorization and persistence
   in `apps/server`, interface composition in `apps/web`, and provider/file
   execution in `packages/runner`. Follow the existing boundaries.
3. Extend the executable checks for changed behavior. Validate unauthorized
   access, state transitions, and failures when those are part of the
   change. Use the existing checks rather than adding a test framework for
   a small task.
4. Run the relevant focused checks while iterating, then `npm run check`
   before submitting. Interface changes also need teacher/student and
   narrow-browser verification; the command suite does not replace it.
5. Update affected documentation and area instructions. Explain the problem,
   resulting behavior, validation, and limitations in the pull request.

For new product capabilities, record scope and design before implementation
using the [OpenSpec workflow](openspec/README.md). Routine fixes and
documentation maintenance can stay in a focused PR. Product decisions go
in `DECISIONS.md` as dated additions; research and external evidence go in
`research/`. Preserve superseded decisions and historical design artifacts.

## Interface and generated code

Compose the existing official shadcn/Base UI primitives. Follow the
interaction rules in [apps/web/AGENTS.md](apps/web/AGENTS.md); use the
supported library APIs and consult their documentation before adding a
workaround. Include pending, error, empty, keyboard, and permission states.

TanStack Router generates `apps/web/src/routeTree.gen.ts` from `src/routes/`
during development/build. Change route source files and include the
generated result; do not edit the generated file by hand. CI checks that
building does not leave a route-tree diff.

## Local data and credentials

Use fictional course data in examples and throwaway storage in checks.
Real account tokens, invite codes, runner credentials, personal notes, and
runtime databases do not belong in commits. `private/`, local environment
files, and server data are ignored; `apps/web/.env` is intentionally tracked
because it contains only the public same-origin setting.

## Known verification limits

Oxlint currently reports existing Fast Refresh export and
`set-state-in-effect` warnings; these are visible and are not suppressed.
Vite reports an informational bundle-size warning. The Node provider checks
do not call real models, and this project does not yet have automated
browser regression coverage. Report new failures and regressions rather
than folding them into these baseline limitations.

`npm run check:agents -w @ada/server` runs the real server, installation host,
and workers against a fake provider in throwaway directories. It checks
automatic connection, restart, rules, implicit DMs, concurrency and deletion.
