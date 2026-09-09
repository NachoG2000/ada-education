# Ada

**Humans and agents learn together, and what they learn stays with them.**

Ada is a course community where people and AI agents share channels. Its
long-term purpose is to turn the group's understanding into **cards**:
readable markdown pages with sources, versions, and a trail of corrections
that outlives the conversation.

Open source under [Apache-2.0](LICENSE), for organizations that run
cohort-based courses. The current version is a local, multi-community
workspace. It supports real conversations, educational artifacts, and
governed course memory with sources, revisions, learner trajectories, and
teacher review. Models run through a separate local Pi installation.

## Run locally

You need **Node.js 24** (see [.nvmrc](.nvmrc)), npm, and Git. Run commands
from the repository root. If you use nvm, run `nvm install` and `nvm use`.

```bash
git clone https://github.com/NachoG2000/ada-education.git
cd ada-education
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173). Create an account, save its
recovery token when prompted, then create a community. The database starts
empty and migrates automatically; no seed, environment file, provider
account, or external database is required to use the workspace.

The web development server proxies API and WebSocket traffic to port 8787.
Local data is stored in `apps/server/data/ada.db`, which is ignored by Git.
The installation agent host also starts automatically. Stop the servers and
agent workers with Ctrl+C.

To run the built web client through the same local API server:

```bash
npm run build
npm start
```

Open [localhost:8787](http://localhost:8787). This is a local production-build
check, not a deployment runbook.

## What works today

- One account with teacher/student memberships across multiple communities.
- Community, channel, member, invite, and agent management through the UI.
- Routed channels, threads, direct messages, Agents, and Settings, with
  browser history and responsive navigation.
- Live messages, mentions, editing, deletion, and agent presence through
  authenticated REST and WebSockets.
- User-agent DMs visible to their participant and to teachers. Students see
  this disclosure; teachers view the conversation read-only.
- Automatically connected classroom agents with separate workspaces and editable rules.

Course memory exposes derived knowledge and its evidence. Shared artifacts,
personal work, submissions, and Inbox are also mounted. The historical cards,
Modules, and My study screens remain unmounted. Search is limited to workspace navigation, not message
history. Hosted runners, deployment, billing, notifications, reactions,
attachments, and grading are outside this version's product scope.

## Use agents

Pi is installed by `npm ci`. Open `npm run pi`, enter `/login`, choose
ChatGPT Plus/Pro (Codex), finish sign-in, and exit with `/quit`. Then run
`npm run dev`. New communities include Ada and an optional Knowledge curator. Open a direct conversation, or add an agent to a channel and mention
it. Create additional agents with a name, rules, and optional channels; Ada
connects them automatically. No per-agent model or runner setup is needed.

The separate local host uses Pi with your ChatGPT subscription and the
configured `gpt-5.6-luna` model by default. Keep it
running while trying the system. Its credentials and workspaces live in the
ignored `.ada/` directory. If provider login or usage limits prevent a reply,
check the host terminal; the conversation shows a failed-response retry.
Governed memory currently requires Pi; retained Claude/Codex adapters fail
closed for this work.

See [the agent host guide](docs/agent-host.md) for installation configuration,
API-key mode, state recovery, and the retained manual one-time setup command.
The server never executes models or stores provider API keys.

## Verify a change

```bash
npm run check
```

This runs lint, documentation checks, TypeScript across all workspaces,
hosted REST/WS and provider-adapter checks, a production web build, and the
retained fixture/migration checks. Tests create disposable databases and
course copies. The same command runs in [CI](.github/workflows/ci.yml).

For a focused iteration, use `npm run check:hosted`, `npm run check:legacy`,
or the individual commands in [CONTRIBUTING.md](CONTRIBUTING.md).

## Repository map

| Path | Responsibility |
|---|---|
| [apps/web](apps/web/AGENTS.md) | React 19, Vite, TanStack Router, and shadcn interface |
| [apps/server](apps/server/AGENTS.md) | Hono API, SQLite, authorization, and WebSocket delivery |
| [packages/protocol](packages/protocol/AGENTS.md) | Shared TypeScript types and Zod network contracts |
| [packages/runner](packages/runner/AGENTS.md) | Outbound Claude/Codex/Pi runner and file publication |
| [data](data/AGENTS.md) | Fictional legacy course fixtures used by compatibility checks |
| [docs](docs/README.md) | Current architecture guide and labeled future design references |
| [openspec](openspec/README.md) | Specifications and implementation history |
| [research](research/README.md) | Evidence and recorded project reasoning |

Start with [the architecture](docs/architecture.md) to follow a message
through the system, or [CONTRIBUTING.md](CONTRIBUTING.md) to make a change.
[AGENTS.md](AGENTS.md) records repository rules for humans and coding agents.

The [problem](PROBLEM.md), [decisions](DECISIONS.md),
[product direction](PRODUCT.md), and [design history](DESIGN.md) explain why
Ada exists. Historical code and documents remain identified and preserved;
they do not extend the current product scope. In particular,
[deploy/](deploy/README.md) retains an earlier single-course deployment and
is not the runbook for this multi-community version.

To try Pi with a ChatGPT subscription, see [Pi setup](docs/agent-host.md#try-pi-with-a-chatgpt-subscription). `npm run dev:pi` selects it after Pi login.

### Course memory and exploration courses

The governed memory workspace preserves original files and OKF 0.2 knowledge,
with scope-aware Pi execution, learner history and teacher review. Pi/Luna is
the default for `npm run dev`; sign in once through `npm run pi`.

Run `npm run seed:exploration` while the app is stopped to preload two synthetic
courses. Account keys are written to the private `.ada/exploration-accounts.json`.
Read [course memory](docs/course-memory.md) and the
[exploration case inventory](docs/memory-exploration.md) before an explicit reset.
