# Plan — railway-one-click-template

Ordered so the protocol lands first, the server's two modes stay separable,
and Docker/docs close over verified behavior. Steps name their ACs.

1. **Protocol** (AC-5): `member.joined` event variant in
   `packages/protocol/src/events.ts`; claim/invite/join payload types if
   shared.
2. **Server: db + identity primitives** (AC-3/4/5): `findPersonByToken`,
   person-token generation, `upsertPerson`/`upsertAgent` stop overwriting
   tokens (agent token prefers `ADA_AGENT_TOKEN` at seed), `invites` table in
   `schema.sql`, invite create/consume + join (create student person) in
   `db.ts`.
3. **Server: routes + gating** (AC-2/3/4/5/7): `/health`, `GET /api/course`,
   `POST /api/claim`, `POST /api/invites`, `POST /api/join`,
   `GET /api/modules/:id/materials/:mid/raw` (resolve+prefix guard); gating
   middleware with allowlist; author-mismatch 403 on every write;
   `member.joined` broadcast; static serving of `apps/web/dist` with
   index.html fallback when the dir exists.
4. **Server: WS person auth** (AC-6): gated `/ws` requires a person token in
   the query, close 4401 otherwise; hub wiring for member.joined.
5. **Web** (AC-3/5/6, AC-UI-1/2): join phase on 401 (owner-token form;
   `#join?token=` name form), `ada:token` storage, Authorization header on
   fetches, WS token param, member.joined reducer, Switch person clears the
   token. Person picker path untouched.
6. **Runner: material sync** (AC-7): on ingest mentions, download the
   module's missing materials to local `raw/` via the new endpoint (agent
   token), skip existing files.
7. **check:gated** (AC-11, proves 3-6): `apps/server/scripts/gated-check.ts`
   — claim/401, invite/join/410, mismatch 403, unauthenticated 401, WS 4401
   and member.joined, material raw, scripted runner from a temp agent folder
   outside the course ingesting an upload. Wire npm script.
8. **Run the full existing suite ungated** (AC-11) — must be untouched-green
   before Docker.
9. **Docker** (AC-8/9): `deploy/Dockerfile`, `deploy/Dockerfile.runner`,
   entrypoints (first-boot copy+seed guard; git identity; no env logging),
   `engines` fields, tsx as a real dependency where needed. Verify: build
   both; run server with a fresh named volume (curl /health, /, /api/course,
   401, claim→invite→join); restart container, assert no re-seed; run runner
   container (scripted) against it and see an answer + ingest.
10. **Docs** (AC-1/10): DECISIONS §20; `deploy/README.md` runbook +
    `deploy/AGENTS.md`; README badge + hosted section; AGENTS.md of
    server/runner/web; `scripts/docs-check.mjs` patterns; PRODUCT.md
    terminology (invite, owner token, member) if needed.
11. **Browser evidence** (AC-UI-1/2): gated local server + built SPA; owner
    claim flow and invite-join flow with screenshots; live roster/message in
    the teacher tab.
12. **Full verification pass + diff re-read** against the design and D-001..
    D-006 before completing Implement.
