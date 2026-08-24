# Review — railway-one-click-template

An independent security-focused reviewer (separate agent, no shared context)
audited the whole diff against AC-1..AC-11 and D-001..D-006, running live
attacks against a throwaway server, real WS connections, and BuildKit
experiments. The orchestrating agent reviewed the same diff in parallel and
confirmed both findings before fixing them.

## Findings and remediation

1. **[high] The image would have shipped the synthetic demo, not the real
   client.** `apps/web/.env` was gitignored *and untracked*, so a build from a
   clean clone (which is what Railway does) had no `VITE_ADA_SERVER`; Vite
   inlines that variable at build time and the bundler dropped the entire
   connected branch. A runtime variable could not have fixed it. Invisible to
   local verification because `COPY . .` picked up the untracked file from the
   working copy.
   **Fixed three ways:** `apps/web/.env` is now tracked via an explicit
   `.gitignore` exception (it holds no secret); `deploy/Dockerfile` sets
   `ENV VITE_ADA_SERVER=/` before `npm run build` so the image never depends
   on that file; and `deploy/check-docker.sh` now asserts the built bundle
   carries the connected client. **Confirmed by A/B:** built from a context
   with no `.env`, the pre-fix Dockerfile produced a bundle with zero
   occurrences of the connected branch and the demo present; the fixed one
   produces the connected client and the join door. Documented in
   `deploy/AGENTS.md` and `apps/web/AGENTS.md`.
2. **[medium] The runner wrote synced material without a path-traversal
   guard**, unlike every other path handler in the diff — and the runner is a
   separate trust domain (often the teacher's own laptop) that takes
   `material.path` from the server's snapshot, or from a hand-written
   `community.json` when an operator replaces the example course.
   **Fixed** in `packages/runner/src/cli.ts` with the same resolve+prefix
   check the server applies, logging and skipping anything outside `raw/`.
3. **[medium, found by the orchestrating agent mid-review and fixed] The first
   invited student could land in `#teachers`.** The join rule was "every
   already-registered person is a member", which is trivially true when the
   teacher is the only person — the realistic fresh-deploy case. Now a student
   joins only `course`-group channels that already have a student member, so
   it fails closed; the reviewer independently reproduced the old bug and
   re-verified the new code. The consequence (a course with no students yet
   gives its first student no channels) is documented in
   `deploy/README.md`'s known limitations and in the capability delta.
4. **[low, orchestrating agent] `check:gated` defaulted to port 8799**, the
   same port `smoke` uses, so running them back to back could collide (it did
   once). Moved to 8797.

## Verified clean (attacks tried that failed as designed)

Gating allowlist bypass (trailing/double slash, case, query string, `%2f`,
HEAD) — never reached protected data; `safeEqual` (SHA-256 then
`timingSafeEqual`) leaks neither length nor content; token scoping verified
live in all four combinations (agent token reads but cannot POST; person
tokens rejected on `/ws/runner` and agent tokens on `/ws`, both 4401); no
token substring appears in a live `/api/community` response and `authorOr403`
echoes ids only; ten concurrent joins on one invite → exactly one success and
nine 410s; no path to mint a teacher invite; `initials` never throws on
single-character, emoji or multi-word names; static traversal (`../`,
`%2e%2e`, backslashes) always falls back to `index.html`; an unset
`ADA_OWNER_TOKEN` makes claim fail closed; `.dockerignore`'s bare `*.md`
matches root level only, so the agent's `CLAUDE.md` and the 13 wiki cards do
reach the image (a hypothesis the reviewer raised and then disproved); and a
re-seed cannot revert a person's rotated token (`upsertPerson` never touches
`token`), while the agent token's overwrite is the documented AC-8 behavior
and only runs on an empty volume.

## Decisions

No contradictions with D-001..D-006. The fixes strengthen D-004 (the runner
guard is what its own risk note asked for) and D-005 (the image is now
independent of an untracked file).

## Re-verification after the fixes

`check:gated` (25), the docker deploy check (11, including the new bundle
assertion), typechecks for web/server/runner, `check:seed`,
`check:scripted`, `lint` (exit 0), `build`, `smoke`, `check:e2e` (15) and
`docs-check` (21 files) — all green on the final tree.
