# Deploying Ada — the Railway template runbook

One course community per deploy (`DECISIONS.md` §20): a **server service**
(UI + API + WS + SQLite on one volume) and an **optional runner service**
(the agent's process, with *your* provider access). Everything here also works
on any Docker host; Railway is the reference because the goal is a published
one-click template (`research/2026-08-23-railway-deploy-template.md`).

## The images

```bash
docker build -f deploy/Dockerfile -t ada-server .
docker build -f deploy/Dockerfile.runner -t ada-runner .
```

- `ada-server` builds the SPA and runs the server from source. First boot on
  an empty volume copies the example course to `$ADA_COURSE` and seeds
  `$ADA_DB` **once**; restarts never re-seed (seeding re-resolves the seed's
  relative timestamps). To start over, wipe the volume.
- `ada-runner` ships git plus the `claude` CLI, copies the agent folders onto
  its own volume on first boot, sets a git committer identity, and syncs the
  course's raw material over HTTP before each ingest — the two services never
  share a disk (Railway volumes can't be shared; FUSE isn't available:
  `research/2026-08-23-shared-filesystem-on-railway.md`).

## Server service

| Variable | Value |
|---|---|
| `PORT` | injected by Railway (image default 8080) |
| `ADA_DB` / `ADA_COURSE` | defaults `/data/ada.db`, `/data/course` — keep them on the volume |
| `ADA_REQUIRE_MEMBERSHIP` | `1` — a public URL must be members-only |
| `ADA_OWNER_TOKEN` | generate with the template's `${{secret(32)}}` |
| `ADA_AGENT_TOKEN` | generate with `${{secret(32)}}`; the seed applies it to the course's single agent, replacing the committed demo token |

Volume mounted at `/data`. Healthcheck path: `/health`. One replica only
(SQLite + volume). WebSockets need no special config on Railway.

## Runner service (optional)

Skip it entirely and run the runner on your machine instead:

```bash
ADA_SERVER=https://<your-app>.up.railway.app ADA_AGENT_TOKEN=<the same secret> \
  ADA_RUNTIME=claude npm run runner
```

That uses *your* `claude` login; `https://` becomes `wss://` on its own. For a
runner that lives in the deploy:

| Variable | Value |
|---|---|
| `ADA_SERVER` | `http://${{ada-server.RAILWAY_PRIVATE_DOMAIN}}:8080` (private network; no egress) |
| `ADA_AGENT_TOKEN` | reference the server's: `${{ada-server.ADA_AGENT_TOKEN}}` |
| `ANTHROPIC_API_KEY` | **yours** — prompted at deploy, stays in your project, never in ours |
| `ADA_RUNTIME` | `claude` (default); `scripted` answers from templates with no key |

Volume at `/data` (the agent's folder and its git history live there). The
runner is a long-running process: it costs while idle. The entrypoint never
prints the environment.

## First run

1. Deploy. Open the URL: the join screen shows only the course's name.
2. Claim as teacher with `ADA_OWNER_TOKEN` (Railway → service → Variables).
   Re-claiming always works and rotates the teacher's token — it's the
   recovery path, not an error.
3. Sidebar → **Invite a student**: each click mints a single-use link
   (`#join?token=…`). The student opens it, types their name, and is in.
4. Connect a runner (either shape above). Drop a markdown file on a module in
   `#modules` and watch the cards land.

## Publishing the template

In Railway: deploy the two services from this repo (root directory `/`,
Dockerfile paths `deploy/Dockerfile` and `deploy/Dockerfile.runner`), attach
the volumes, set the variables above with `secret()` generators and reference
variables, then **Settings → Generate Template from Project** and Publish.
Paste the resulting `railway.com/deploy/<slug>` URL into the README badge.
Deploys attach to this repo and can pull updates as PR-style branch deploys;
users can "Eject" to their own copy.

## Known limitations (v1, on purpose)

- **A member sees the whole course.** Gating is at the course door; there is
  no channel-level read filtering yet, so `#teachers` traffic reaches every
  authenticated client. Don't put secrets in channels.
- **A joining student lands in the `course` channels that already have a
  student in them** — never in a teacher-only channel such as `#teachers`,
  and not in work or private channels. Consequence for a brand-new custom
  course whose only member is the teacher: the first invited student joins no
  channels. Fix it by listing your students in the course's `community.json`
  before the first seed, or add them to the channels by hand.
- The images run TypeScript via `tsx` and carry devDependencies (the web
  build): simple over small, revisit if size matters.
- One agent per course is what `ADA_AGENT_TOKEN` rotates; several agents mean
  editing `community.json` (the seed warns and keeps JSON tokens).
- Replacing the example course: put your own `community.json` + folders at
  `/data/course` (or point `ADA_COURSE` elsewhere) and re-seed on an empty DB.
