# Decisions: Railway one-click template

Record concise, externally reviewable evidence and choices here.

## D-001: Person access reuses members.token

Status: Accepted

### Evidence

- `schema.sql:26` already has `token TEXT UNIQUE` on `members`; only the agent lookup uses it (`db.ts:208`, scoped `kind='agent'`).
- There is no sessions/tokens table and no migration machinery beyond re-executing `CREATE TABLE IF NOT EXISTS` (`db.ts:75`).

### Options

1. A new `sessions` table with expiry and multi-device tokens.
2. One value per member in the existing `members.token` column, person lookups scoped `kind='person'`.

### Chosen approach

Option 2. One deploy = one course with a handful of members; a single stable token per person matches the product's "plain tokens instead of Nostr keys" decision and adds zero schema risk. Seed upserts are adjusted to never overwrite tokens.

### Trade-offs and risks

- No multi-device token rotation or expiry; re-claim/re-join rotates the single token. Acceptable v1; a sessions table can supersede this without breaking the column.

### Verification

- AC-3/AC-4/AC-5 via `check:gated`; re-seed token preservation in AC-8's restart check.

## D-002: Gating is an opt-in server flag with an allowlist, not a new default

Status: Accepted

### Evidence

- Local dev UX depends on the unauthenticated picker and writes (`community.tsx:426-467`, `api.ts:85-201`); every existing check (smoke, e2e, seed, scripted) runs ungated.
- The template must be private-by-default to be honest as a public URL (contrast: Buzz's template ships membership OFF — `research/2026-08-23-buzz-identity-and-agents.md`).

### Options

1. Always-on auth, seeding tokens for the demo people.
2. `ADA_REQUIRE_MEMBERSHIP=1` opt-in flag; unauthenticated allowlist (`/health`, `GET /api/course`, `POST /api/claim`, `POST /api/join`); template sets it on, local dev leaves it off.

### Chosen approach

Option 2. Zero churn on local dev and the existing suite; the deployed default is still private because the template sets the flag. Improves on Buzz's open-by-default footgun.

### Trade-offs and risks

- Two behavioral modes to test: mitigated by keeping the entire existing suite ungated and adding `check:gated` for the new mode.

### Verification

- AC-3 (mismatch 403, ungated unchanged), AC-11 (both suites green).

## D-003: New member.joined protocol event instead of resync-only

Status: Accepted

### Evidence

- Events never add members today; the web client validates stored identity against the snapshot and silently kicks unknown ids back to the picker (`community.tsx:513-521`); no membership event exists in the union (`events.ts:228-262`).

### Options

1. Rely on the existing resync (new members appear on next reconnect/visibility change).
2. Add `member.joined` to the protocol, server broadcast on join, client reducer insert.

### Chosen approach

Option 2. A teacher watching the roster while students join is the template's first-run experience; "appears on the next accidental resync" is not demoable. The event is one zod variant + one reducer case on each side.

### Trade-offs and risks

- The web client still hand-mirrors protocol types (`api.ts:1-29` drift note); both sides must land together — asserted end to end by AC-5.

### Verification

- AC-5 in `check:gated` (WS receives member.joined) and AC-UI-2 in the browser.

## D-004: Runner pulls materials over HTTP; mention payload stays lean

Status: Accepted

### Evidence

- Materials store only a path (`schema.sql:100-108`), the mention payload carries no content (`events.ts:266-281`), and the runner reads `raw/` from its own disk (`cli.ts:60,247`) — remote runners cannot ingest today.

### Options

1. Embed material text in the `agent.mention` payload.
2. A material-raw HTTP endpoint + runner-side sync of missing files before running the runtime.

### Chosen approach

Option 2. Keeps the runtimes' contract ("`claude` runs over real local files") and handles multi-file/large materials; the pull is idempotent (existing files skipped) so same-machine setups are unaffected. Option 1 bloats every mention and still leaves the folder incomplete for follow-up questions.

### Trade-offs and risks

- One more authenticated endpoint to guard against path traversal — same resolve+prefix pattern the previous feature's review already established for the upload path.

### Verification

- AC-7 in `check:gated`: scripted runner from a temp folder outside the course ingests an uploaded material.

## D-005: Images run TypeScript from source with the monorepo layout intact

Status: Accepted

### Evidence

- `repoRoot` is derived as three levels up from the running source file (`db.ts:35`); there is no server build or start script (`apps/server/package.json`), and the runner's bin points at `src/cli.ts`.

### Options

1. Introduce a server/runner build (tsc to dist) and run node on compiled output.
2. Copy the monorepo into `/app`, run via `tsx` (promoted to a real dependency), keep absolute `ADA_DB`/`ADA_COURSE` pointing at the volume.

### Chosen approach

Option 2. Matches how every script already runs, avoids inventing a build pipeline inside this feature, and sidesteps the repoRoot layout trap. First-boot semantics live in the entrypoint: copy course + seed only when the volume is empty (seeding is row-idempotent but slides relative timestamps — `seed.ts:126,224-236`).

### Trade-offs and risks

- Bigger image (devDeps needed for the web build; tsx at runtime). Accepted v1, noted in the runbook; a compiled image can come later without changing the template's surface.

### Verification

- AC-8: docker build/run, first boot vs restart assertions over the same volume.

## D-006: The org's provider access lives in their own runner service, never ours

Status: Accepted

### Evidence

- The runner strips only `CLAUDE*` from the child env (`cli.ts:253`), so the provider's own variables reach its binary; the legal rule (provider access belongs to the teacher/org) is recorded in `research/2026-08-22-subscriptions-runners-buzz-pi.md`; Buzz has no hosted-agent option at all (`research/2026-08-23-buzz-identity-and-agents.md`).

### Options

1. Server-side proxying of AI calls.
2. Optional runner service in the org's own Railway project, provider access as a prompted variable; laptop runner stays the default.

### Chosen approach

Option 2. The server keeps its "never runs models" invariant (DECISIONS §14); provider access lives in infrastructure the org owns; deleting the service removes it. Entrypoint never logs env.

### Trade-offs and risks

- A runner container is a long-running cost even when idle; the runbook says so and keeps the laptop runner as the default path.

### Verification

- AC-9 (image runs scripted against a live server container; claude path documented), review checklist for environment logging.
