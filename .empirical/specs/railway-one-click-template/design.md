# Design — railway-one-click-template

Grounded in the 08/23 code inventory (facts cited as file:line). Six decision
records in decisions.md; this file is the edit plan.

## Identity

- **Person tokens reuse `members.token`** (`schema.sql:26`, already
  `TEXT UNIQUE`; agent lookup is already scoped `kind='agent'` at `db.ts:208`).
  New `findPersonByToken` scoped `kind='person'`. Tokens:
  `crypto.randomBytes(24)` base64url. `upsertPerson` (`db.ts:114-121`) must
  exclude `token` from its ON CONFLICT update so re-seeds never wipe
  credentials; same guarantee for the agent token when `ADA_AGENT_TOKEN` is
  set (seed prefers the env value over the JSON's — `db.ts:133` currently
  overwrites from JSON unconditionally).
- **Gating** is `ADA_REQUIRE_MEMBERSHIP=1`, read once at server start. Hono
  middleware over `/api/*` with an unauthenticated allowlist: `GET /health`,
  `GET /api/course`, `POST /api/claim`, `POST /api/join`. Everything else
  requires `Authorization: Bearer <person token>`; the resolved person lands
  in context; handlers that accept `authorId` 403 on mismatch and default to
  the token's person. The material-raw endpoint additionally accepts the agent
  token (runner). Owner-token comparison uses `timingSafeEqual`.
- **Claim**: `POST /api/claim {token}` compares against `ADA_OWNER_TOKEN`,
  finds the course's teacher (first `role='teacher'` person), (re)generates
  their person token, returns `{personId, personToken}`. Re-claim rotates —
  the owner token is the root credential and must always recover access.
- **Invites**: additive `CREATE TABLE IF NOT EXISTS invites (token TEXT
  PRIMARY KEY, role TEXT NOT NULL DEFAULT 'student', created_by TEXT NOT NULL,
  created_at TEXT NOT NULL, used_by TEXT, used_at TEXT)` — free because
  `openDatabase` re-execs the schema (`db.ts:75`). `POST /api/invites`
  (teacher-authed) mints; `POST /api/join {token, name}` creates the student
  person (id slug from name + suffix on collision, initials derived, tone
  rotated), marks the invite used (used ⇒ 410), returns the person token, and
  broadcasts the new event.
- **`member.joined`** joins the protocol (`events.ts` union + web whitelist
  `api.ts:205-213` + `applyEvent` dedupe-by-id insert): clients learn about
  new members without reload — the inventory shows events never add members
  today (`community.tsx:513-514`), and a stale roster silently kicks tabs back
  to the picker.
- **WS**: gated `/ws` requires `?token=` resolving to a person (else close
  4401, mirroring the runner's `ws.ts:182-185`); ungated `/ws` unchanged.

## Web

- Connected-mode boot: a 401 from `GET /api/community` switches to a new
  `phase: "join"` (course name from unauthenticated `GET /api/course`). The
  join screen offers the owner-token input, and `#join?token=…` (parsed from
  the hash before the router sees it) shows the name form. Success stores
  `ada:token` + `ada:me`, then hydrates. `api.ts` attaches the header whenever
  the token exists (harmless ungated); the WS URL appends it. "Switch person"
  also clears `ada:token`. The person picker path stays byte-identical for
  ungated servers (`who-are-you.tsx` untouched).

## Material sync (remote runners)

- Server: `GET /api/modules/:moduleId/materials/:materialId/raw` streams the
  stored file (`materials.path` is relative to the course dir; resolve +
  prefix-check against the course root to keep the path-traversal guarantee
  from the previous feature's review). Auth when gated: person or agent token.
- Runner: on an ingest mention (`intent: "ingest"` + `moduleId`), before
  invoking the runtime, list the module's materials from the snapshot it
  already fetches (`cli.ts:495,523`), and for each file missing under its
  local `raw/` download it through the new endpoint with its agent token.
  Existing files are skipped, so same-filesystem setups (local dev) don't
  re-download. Runtimes unchanged — they keep reading `raw/` from disk
  (`cli.ts:247` `--add-dir`).

## Static serving + health

- `serveStatic` (from `@hono/node-server/serve-static`, dep already present)
  rooted at `apps/web/dist` (overridable `ADA_WEB_DIST`), registered only when
  the directory exists; `GET /` and non-`/api` misses fall back to
  `index.html` (hash routing — `App.tsx:24` — needs no path fallbacks beyond
  that). WS upgrade handling stays outside Hono (`ws.ts:207-216`), untouched.
  `GET /health` → `{ok: true}` for Railway healthchecks (today `/` 404s).

## Docker

- **Server image** (`deploy/Dockerfile`): `node:24-slim` (node:sqlite needs
  24; add `engines` to the manifests), copy the monorepo to `/app`
  (preserving the layout `repoRoot` derives from — `db.ts:35`), `npm ci`,
  `npm run build`. Entrypoint (sh): with the volume at `/data`,
  first boot = `/data/course` missing → copy the example course; `/data/ada.db`
  missing → run the seed with `ADA_DB=/data/ada.db ADA_COURSE=/data/course`
  (+`ADA_AGENT_TOKEN` honored by the seed). Restarts skip both — seeding
  slides timestamps (`seed.ts:126,224-236`), so seed-once lives in the
  entrypoint guard, and re-seeds are manual. Start:
  `npx tsx apps/server/src/index.ts` (`tsx` becomes a real dependency of
  `@ada/server` — there is no server build today, `apps/server/package.json`).
- **Runner image** (`deploy/Dockerfile.runner`): `node:24-slim` + `git` +
  `npm i -g @anthropic-ai/claude-code`. Entrypoint: volume `/data`; first boot
  copies `agents/` from the example course to `/data/course/agents` and
  creates `/data/course/raw`; sets a git committer identity (the fresh-folder
  commit path needs one — `cli.ts:308-313` configures none); never echoes env.
  Runs `npx tsx packages/runner/src/cli.ts` with `ADA_AGENT_CWD=
  /data/course/agents/ada`, `ADA_SERVER` (absolute URL — `cli.ts:346`),
  `ADA_AGENT_TOKEN`, `ADA_RUNTIME` (claude default; scripted for tests),
  `ANTHROPIC_API_KEY` passing through the runner's env filter (`cli.ts:253`
  strips only `CLAUDE*`).

## Checks and docs

- `apps/server/scripts/gated-check.ts` (npm `check:gated`): throwaway DB +
  gated env; asserts claim (bad token 401, good token → snapshot with meId),
  invite → join → reuse 410, write-as-other 403, unauthenticated community
  401, WS without token 4401 / with token receives `member.joined`, and the
  material raw endpoint; then spawns the scripted runner from a temp agent
  folder outside the course to prove ingest-with-sync end to end.
- Docs in the same change: `DECISIONS.md` §20 (the three 08/23 decisions +
  this design's outline), `deploy/README.md` runbook + `deploy/AGENTS.md`,
  README badge/section, AGENTS.md of server/runner/web areas,
  `scripts/docs-check.mjs` patterns (§20 dated; runbook exists; README badge).

## Trade-offs / risks

- Rotating the teacher token on every claim invalidates other teacher tabs;
  accepted — the owner token must always recover access, and one teacher is
  the v1 shape.
- Without channel-level filtering, any member's WS receives every broadcast
  (including `#teachers`); explicitly a non-goal, stated in the runbook.
- Full `npm ci` in the images (web build needs devDeps) makes them bigger;
  acceptable v1, noted in the runbook.
- `POST /api/cards` gains auth via the same middleware even though no UI
  publishes cards today (`api.ts:109-120` is unguarded — inventory gotcha 17).
