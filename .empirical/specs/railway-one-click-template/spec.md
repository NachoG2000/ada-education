# Railway One Click Template

## Request

> Make Ada deployable as a Railway one-click template: the open-source self-host rung between laptop and hosted (DECISIONS §4b, §16, §19; research/2026-08-23-railway-deploy-template.md, -buzz-identity-and-agents.md, -shared-filesystem-on-railway.md). Decisions taken by Ignacio on 08/23 to record as DECISIONS.md §20: (a) one deploy = one course community; (b) identity copies Buzz's pattern with plain tokens instead of Nostr keys — an owner token bootstrapped from a deploy-time variable claims the teacher, the teacher mints invite links, members live in a server-side table, and membership gating is an explicit flag (off for local dev, on in the template); (c) runners stay outside the deploy by default (teacher's machine, their claude login, wss already works), with an OPTIONAL runner service in the template where the org pastes its own ANTHROPIC_API_KEY. Build: single public service (UI+API+WS), minimal identity, Dockerfiles for server and optional runner, README deploy button + runbook, docs in the same change.

**Refinement during Specify** (from the code inventory): materials live only as
files on the server's disk (`materials.path`, no content in the DB) and the
mention payload carries none — so a runner on another machine cannot ingest
uploaded material today. The contract adds the missing piece: the server
exposes material content over HTTP and the runner syncs its local `raw/`
before running the runtime. Without it the template's core teacher flow would
silently break for every remote runner.

## Goal

An organization that runs cohort-based courses clicks Deploy on Railway and
gets a working course community at a public URL: the teacher claims the deploy
with a generated owner token, invites students with links, and connects an
agent runner — from their own machine with their `claude` login, or as an
optional Railway service with their own API key. Local development stays
exactly as it is (gating off, person picker, `npm run dev`).

## Acceptance Criteria

- [ ] [AC-1] `DECISIONS.md` gains a dated §20 recording Ignacio's 08/23 decisions: Railway template as the self-host rung; one deploy = one course; Buzz's identity pattern with plain tokens and invite links instead of Nostr keys (citing `research/2026-08-23-buzz-identity-and-agents.md`); runner outside by default with an optional runner service holding the org's own key; no shared filesystem (citing `research/2026-08-23-shared-filesystem-on-railway.md`). Root `AGENTS.md`, `apps/server/AGENTS.md`, `packages/runner/AGENTS.md` and the new deploy area's `AGENTS.md` describe the additions; `README.md` gains a "Deploy on Railway" badge (linking the runbook until the template is published) and a short hosted section.
- [ ] [AC-2] After `npm run build`, the server serves the SPA same-origin: `GET /` returns the app shell, hashed assets under `/assets/*` load, `/api/*` and both WS paths behave as before, and `GET /health` returns 200 with `{ok: true}`. `npm run dev` (Vite + proxy) is unchanged.
- [ ] [AC-3] With `ADA_REQUIRE_MEMBERSHIP=1`, every write endpoint (`messages`, `threads`, `cards`, `materials`, `modules PATCH`, `reports reconcile`) and `GET /api/community` require `Authorization: Bearer <person token>`; the server derives the author from the token and rejects a mismatched body `authorId` (403). With the flag unset, behavior is unchanged for local dev (person picker, unauthenticated writes).
- [ ] [AC-4] With `ADA_OWNER_TOKEN` set and gating on: `POST /api/claim` with the owner token returns the course teacher's person id and a person token (stable across repeat claims — re-claiming returns a working token without duplicating people); a wrong token gets 401. An unauthenticated `GET /api/course` returns only `{name, subtitle}` so the join screens can render; unauthenticated `GET /api/community` returns 401 and leaks nothing.
- [ ] [AC-5] A teacher-authenticated `POST /api/invites` returns a single-use invite token; `POST /api/join` with that token and a name creates a `student` person and returns their person token; reusing the invite gets 410. A `member.joined` event reaches connected clients so the new student appears without reload.
- [ ] [AC-6] With gating on, `/ws` requires `?token=<person token>` (invalid or missing closes 4401) and the web client sends it; `/ws/runner` keeps its agent-token check. With gating off, `/ws` stays open as today.
- [ ] [AC-7] The server exposes a material's stored file (auth: agent token or person token when gated), and the runner downloads the mentioned module's materials it lacks into its local `raw/` before running the runtime — proven by a runner working from a directory that is NOT the server's course folder ingesting an uploaded material end to end (scripted runtime; the claude runtime shares the same sync path).
- [ ] [AC-8] `deploy/Dockerfile` builds the server image: on first boot with an empty volume it copies the example course into the volume and seeds the DB exactly once (a restart does not re-seed or slide timestamps); it honors `PORT`, `ADA_DB`, `ADA_COURSE`, `ADA_REQUIRE_MEMBERSHIP`, `ADA_OWNER_TOKEN`, and `ADA_AGENT_TOKEN` (overriding the seeded agent token so Railway's `secret()` can rotate it); verified locally with `docker build` + `docker run` + HTTP checks against the container.
- [ ] [AC-9] `deploy/Dockerfile.runner` builds the runner image: git plus the `claude` CLI installed, a git committer identity configured, and an entrypoint that initializes the agent folder on the runner's own volume from the example course on first boot; with `ADA_SERVER`, `ADA_AGENT_TOKEN` and (for the claude runtime) `ANTHROPIC_API_KEY` it connects and answers. Verified by building the image and running it with the scripted runtime against a live server container; the claude path is documented, not exercised (no credentials in CI).
- [ ] [AC-10] `deploy/README.md` is the runbook: composing the two services on Railway (volumes, env vars with `secret()`, reference variables, healthcheck `/health`), publishing the template, connecting a laptop runner (exact command), inviting students, rotating tokens, and the known limitation that a member sees the whole course (no channel-level read filtering yet).
- [ ] [AC-11] A new gated API check (`npm run check:gated -w @ada/server`) drives claim → invite → join → authed write → 401/403 refusals → WS token gating → material sync against a throwaway server, and passes. Existing checks stay green: `npm run typecheck`, `npm run check -w @ada/server`, `npm run check -w @ada/runner`, `npm run check:seed -w @ada/server`, `npm run check:scripted -w @ada/runner`, `npm run lint` (no new warnings), `npm run build`, `npm run smoke`, `npm run check:e2e -w @ada/server`.
- [ ] [AC-UI-1] [UI] Against a gated server, a fresh browser shows the join screen (course name only, no course data before auth); pasting the owner token lands in the teacher's view; "Switch person" clears the token and returns to the join screen.
- [ ] [AC-UI-2] [UI] An invite link opened in a fresh browser context prompts for a name, lands the new student in `#home`, and their message in `#questions` appears live in the teacher's browser along with the new member.

## Scope

- `apps/server`: static serving + `/health`, membership gating middleware,
  claim/invite/join endpoints, `/api/course`, material raw endpoint, WS person
  token check, member.joined broadcast, `check:gated` script, seed respect for
  `ADA_AGENT_TOKEN`, person-token persistence across re-seeds.
- `packages/protocol`: `member.joined` event; invite/claim payload types.
- `apps/web`: join/claim screens (gated mode), token storage and
  `Authorization` header, WS token param, `#join?token=` handling, member.joined
  reducer; person picker untouched for ungated mode.
- `packages/runner`: raw-material sync before ingest.
- `deploy/`: `Dockerfile`, `Dockerfile.runner`, entrypoint scripts,
  `README.md` runbook, `AGENTS.md`.
- Docs: `DECISIONS.md` §20, the touched areas' `AGENTS.md`, root `README.md`,
  `scripts/docs-check.mjs` additions.

## Non-goals

- Channel-level read filtering (a member still receives every broadcast,
  including `#teachers`; recorded as a known limitation in the runbook).
- Multi-course/multi-tenant, permissions screen, SSO, email, passwords,
  password reset, sessions expiry, rate limiting.
- Publishing the template in Railway's dashboard (manual step; runbook only)
  and publishing `ada-runner` to npm.
- Any shared filesystem service (see research: not feasible on Railway, not
  needed for one-deploy-one-course).
- Changing the demo mode, the scripted runtime's answers, or the seed course
  content.

## Risks

- Auth touches every write path: a regression could break the working demo
  flows. Mitigation: gating is opt-in and off by default; the full existing
  check suite must stay green ungated, and `check:gated` covers the new mode.
- The web client hand-mirrors protocol types (`apps/web/src/lib/api.ts`
  header notes the drift): adding `member.joined` must land on both sides or
  events get dropped by the whitelist. Mitigation: AC-5 asserts the live
  update end to end.
- Docker first-boot seeding interacts with re-seed token overwrites
  (`db.ts:133`): a re-seed must not revert a rotated `ADA_AGENT_TOKEN` or wipe
  person tokens. Mitigation: explicit AC-8 restart check and seed changes.
- `repoRoot` is derived from the source layout (`db.ts:35`); the image must
  preserve the monorepo layout or use absolute env paths. Mitigation: image
  runs from `/app` with absolute `ADA_DB`/`ADA_COURSE`.
- The runner image runs third-party binaries (`claude`) with the org's key;
  the entrypoint must never log the key. Mitigation: review checklist item.

## Verification

- `npm run check:gated -w @ada/server` (new), plus the full existing suite
  (AC-11 list) — all green.
- `docker build` both images; `docker run` the server with a bind-mounted
  empty volume: first boot seeds, restart doesn't re-seed; curl `/health`,
  `/`, `/api/course`, 401 on `/api/community`, claim/invite/join happy path.
  Runner container (scripted) against the server container answers a mention
  and ingests an uploaded material.
- Browser evidence for AC-UI-1/2 with screenshots (policy: browserForUi).
- `node scripts/docs-check.mjs` extended with §20 and runbook patterns.

## Capability Deltas

- `deltas/course-membership.md` — ADDED: owner claim, invites, membership
  gating, token-derived authorship, WS person auth.
- `deltas/deployment.md` — ADDED: single-service serving, health, Docker
  first-boot contract, env contract, optional runner service.
- `deltas/course-modules.md` — MODIFIED: material content over HTTP; runner
  syncs `raw/` before ingest (remote runners ingest correctly).
