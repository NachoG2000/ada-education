## Purpose

Ada deploys as a Railway one-click template: one public service serving
UI + API + WS with a volume, and an optional runner service where the org's
own AI credential lives. First boot is self-seeding; restarts are stable.

## ADDED Requirements

### Requirement: One public service serves everything

After `npm run build`, the server serves the SPA same-origin (`GET /` → app
shell, `/assets/*` hashed files), keeps `/api/*` and both WS paths intact, and
answers `GET /health` with 200 `{ok: true}` for platform healthchecks.

#### Scenario: Same-origin production

- GIVEN a built tree and a running server
- WHEN a browser opens the server's URL
- THEN the app loads and connects with `VITE_ADA_SERVER=/` — no CORS, no second origin.

### Requirement: First boot seeds once

The server image copies the example course into the volume and seeds the DB
only when the volume is empty; a restart neither re-seeds nor slides seeded
timestamps. `ADA_AGENT_TOKEN` overrides the seeded agent token so the deploy's
generated secret wins, and re-seeding never reverts it or wipes person tokens.

#### Scenario: Restart is a no-op

- GIVEN a server container that booted once on an empty volume
- WHEN the container restarts
- THEN message timestamps and tokens are unchanged and no duplicate rows exist.

### Requirement: Optional runner service with the org's key

The runner image ships git and the `claude` CLI, configures a git committer
identity, initializes the agent folder on its own volume on first boot, and
runs with `ADA_SERVER`, `ADA_AGENT_TOKEN` and the org's `ANTHROPIC_API_KEY`.
The credential lives only in the org's deploy; the entrypoint never logs it.

#### Scenario: Hosted runner answers

- GIVEN server and runner containers wired by env
- WHEN someone mentions the agent
- THEN the runner answers through the same protocol a laptop runner uses.
