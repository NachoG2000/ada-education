# Railway one-click deploy template for Ada — feasibility

Date: 2026-08-23. Question from Ignacio: can Ada's hosted story be a Railway
template like `https://railway.com/deploy/onyx--onyx` or
`https://railway.com/deploy/buzz--buzz-1` — one click, minimal configuration?
Short answer: **yes**, and the current code is closer than expected. This file
records what was verified (docs read in the original page vs. search snippet)
and what the gaps are. No decision is taken here; if we commit to building the
template, that goes to `DECISIONS.md` as a new dated section.

## How Railway templates work (verified 2026-08-23)

- **Create**: from scratch in the template composer, or **"Generate Template
  from Project"** on an existing Railway project. Each service configures its
  source (GitHub repo — public or private — or Docker image), variables,
  volumes, root directory. Source: https://docs.railway.com/templates/create
  (original).
- **Publish**: Workspace → Templates → Publish; that lists it in the
  marketplace and yields the deploy URL. Docs say
  `railway.com/new/template/<slug>`, but the live product uses
  `railway.com/deploy/<slug>` (both example templates return 200 there; the
  docs URL returned 500) — use the link Railway generates at publish time.
  Source: https://docs.railway.com/templates/publish-and-share (original) +
  direct curl checks.
- **Deploy button** for the README: badge `https://railway.com/button.svg`
  linking to the template URL. Source: same publish-and-share page (original).
- **No fork on deploy**: user services attach directly to *our* repo; users
  can "Eject" to mirror it into their GitHub. GitHub-sourced deploys can
  receive our updates as a PR-style branch deploy they merge — good for open
  source. Source: https://docs.railway.com/templates/deploy (original).
- **Kickbacks**: 15% of the usage costs of deployed instances, 25% if we
  support users via the Template Queue. Payout as credits or Stripe cash.
  Source: https://docs.railway.com/templates/kickbacks (original). This is a
  first (small) revenue drip consistent with `DECISIONS.md` §16 ("hosted is
  the commercial engine").
- **Monorepo**: root directory per service; Railway auto-detects JS workspaces
  and sets per-package watch paths. Caveat: `railway.json` paths don't follow
  the service root directory. Source:
  https://docs.railway.com/deployments/monorepo (original).
- **WebSockets**: supported, exempt from inactivity timeouts; bind `0.0.0.0`
  and read `PORT`. Source: https://docs.railway.com/guides/socketio (original).
- **Volumes**: one per service; two deployments can't mount the same volume at
  once (brief downtime on redeploy) and volumes are incompatible with
  replicas — fine for one course community on SQLite, and a known ceiling.
  Source: https://docs.railway.com/reference/volumes (original).
- **Builder**: a Dockerfile in the repo takes priority; otherwise Railpack
  (Nixpacks' replacement — snippet only for the replacement claim). Source:
  https://docs.railway.com/builds/build-configuration (original).
- **The examples**: `onyx--onyx` is a 10-service bundle (FastAPI + Next.js +
  workers + Postgres/Redis/OpenSearch/S3 behind nginx); `buzz--buzz-1` deploys
  the official `ghcr.io/block/buzz` image + Postgres/Redis/S3, with a single
  prompted variable ("zero config"). Verified by fetching both pages. Buzz —
  the same relay architecture family Ada's §14 is inspired by — being a
  template validates the model: **relay hosted, runners connect from wherever
  the credentials live**.

## What Ada already has (verified in code, same date)

- Server reads `process.env.PORT` (`apps/server/src/index.ts:79`), DB path via
  `ADA_DB` (`apps/server/src/db.ts:71`), course via `ADA_COURSE` — all
  volume-friendly.
- The runner builds its WS URL as `server.replace(/^http/, "ws")`
  (`packages/runner/src/cli.ts:318`), so `ADA_SERVER=https://…` already yields
  `wss://` — the "runner accepts wss" TODO in `apps/server/AGENTS.md` is de
  facto done. A teacher can keep the runner on their laptop pointing at the
  hosted URL: exactly the §14 credential model.
- Runner auth: token checked against the course (`apps/server/src/ws.ts:180`).

## Gaps before a template is honest

1. **Serve the SPA from the server** (one public service, like Buzz's single
   entry point) or add a second static service + CORS. Today nothing serves
   `apps/web/dist`.
2. **Dockerfile** for the monorepo: build web, seed the course into the volume
   on first boot (`ada.db` + `data/<course>/raw`), start the server.
3. **Person identity**: the server trusts `authorId` — fine on localhost,
   not on a public URL. Minimum viable: an invite/course token. This is the
   only real feature gap.
4. **Per-deploy runner token**: generate with the template's `secret()`
   variable function instead of the seed's plain token.
5. **Optional runner service** on Railway for teachers without a laptop
   process: image with the provider binary, the teacher pastes their own API
   key as a prompted variable (legal rule from
   `research/2026-08-22-subscriptions-runners-buzz-pi.md`: the credential is
   the teacher's, never ours). Scripted runtime as a zero-credential preview.

Estimate: items 1-2-4 are the ~1-2h "Deploy to Railway" sketch already in
`apps/server/AGENTS.md`; 3 and 5 make it a real public template — roughly a
focused day. Fits `DECISIONS.md` §19 (open source first) and §16 (hosted as
the sequence): the template is the middle rung between "laptop" and "hosted by
us".
