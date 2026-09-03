# deploy/ — retained deployment history

**Current boundary (2026-09-03).** Deployment and hosted runners are outside
GitHub issue #1 (`DECISIONS.md` §22). This directory retains the deployment
shape of `DECISIONS.md` §20: `Dockerfile`
(server: builds the SPA, serves UI + API + WS from one container, first-boot
copy + seed onto the `/data` volume, never re-seeds on restart) and
`Dockerfile.runner` (git + the `claude` CLI and agent folders on its own
volume). Its `scripted` entrypoint exists only for the legacy container check;
the current product runner is local, subscription-backed, and started with the
one-time UI command. The
entrypoints hold the first-boot logic; `README.md` here is the runbook for
historical Railway composition. It is not a current multi-community deployment
runbook. The retained shape is verified by
`npm run check:gated -w @ada/server` (process level) and by building/running
both images (container level).

**Rules.** `deploy/Dockerfile` must set `ENV VITE_ADA_SERVER=/` before
`npm run build`: Vite inlines that variable at build time, so the production
bundle must explicitly target its serving origin (`check-docker.sh` asserts
the bundle carries the connected hosted client). The check owns per-process image/container/
network/volume names and asks Docker for a free host port, because multiple
verification runs may execute concurrently. The server image
must keep the monorepo layout (`repoRoot` in
`apps/server/src/db.ts` is derived from the source tree) and absolute
`ADA_DB`/`ADA_COURSE` on the volume. The runner entrypoint asserts
`ADA_SERVER`/`ADA_AGENT_TOKEN`, additionally requires community and agent ids
for the hosted CLI path, and must never echo the environment. Seed-once
semantics live in `entrypoint-server.sh` — seeding is row-idempotent but
slides the seed's relative timestamps, so it only runs when `$ADA_DB` is
missing.

**How it grows tomorrow.** A new deployment design must cover the issue #1
tenant schema, production identity, migrations, durable runner work and hosted
API-key isolation before this can again be presented as a supported template.
Hosted-tier isolation stays in `DECISIONS.md` §14.7.
