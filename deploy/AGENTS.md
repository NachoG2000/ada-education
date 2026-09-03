# deploy/ — the course as a service

**What it is today.** The deployment shape of `DECISIONS.md` §20: `Dockerfile`
(server: builds the SPA, serves UI + API + WS from one container, first-boot
copy + seed onto the `/data` volume, never re-seeds on restart) and
`Dockerfile.runner` (git + the `claude` CLI, agent folders on its own volume,
git committer identity, provider access via env — never logged). The
entrypoints hold the first-boot logic; `README.md` here is the runbook for
composing and publishing the Railway template and for running a laptop runner
against a hosted course. Verified end to end by
`npm run check:gated -w @ada/server` (process level) and by building/running
both images (container level).

**Rules.** `deploy/Dockerfile` must set `ENV VITE_ADA_SERVER=/` before
`npm run build`: Vite inlines that variable at build time and drops the unused
branch, so without it the image ships the synthetic demo and no runtime
variable can bring the real client back (`check-docker.sh` asserts the bundle
carries the connected client). The check owns per-process image/container/
network/volume names and asks Docker for a free host port, because multiple
verification runs may execute concurrently. The server image
must keep the monorepo layout (`repoRoot` in
`apps/server/src/db.ts` is derived from the source tree) and absolute
`ADA_DB`/`ADA_COURSE` on the volume. The runner entrypoint asserts
`ADA_SERVER`/`ADA_AGENT_TOKEN` and must never echo the environment. Seed-once
semantics live in `entrypoint-server.sh` — seeding is row-idempotent but
slides the seed's relative timestamps, so it only runs when `$ADA_DB` is
missing.

**How it grows tomorrow.** A published template slug lands in the README
badge; a compiled (devDependency-free) image and per-agent runner services are
the next steps when size or multi-agent courses demand them; hosted-tier
isolation stays in `DECISIONS.md` §14.7.
