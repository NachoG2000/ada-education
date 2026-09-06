# apps/server — the community server

## Hosted service domain (current, 2026-09-04)

Schema versions 3-5 add the hosted domain alongside the retained fixture tables: global `tenant_users`; role-bearing `tenant_memberships`; `tenant_communities`; digest-only invite and runner credentials; community-scoped channels, channel membership, agents, messages, threads and backend cards. Version 5 adds persisted invite mode/revocation metadata. Version 6 keeps the retained workspace agent table compatible with the shared optional avatar URL. A fresh database starts empty and migrates automatically; `npm run seed` is an optional legacy fixture import, not startup.

`api.ts` exposes account/session endpoints plus authenticated `/api/communities/:communityId/...` resources. The issue #3/#4 additions are `PATCH /api/users/me`, `PATCH /api/communities/:communityId/members/:userId`, and safe invite `GET`/`DELETE` routes; invite redemption now reports whether it consumed the credential. The user bearer identifies the actor and the path identifies the tenant. `tenant.ts` owns tenant queries, atomic invite redemption, unique user-agent DMs, channel authorization, moderation tombstones, agent lifecycle and the last-teacher invariant. Channel create/update accepts explicit user and agent assignments while preserving tenant and role validation. `ws.ts` requires browser and runner authentication in the first frame, filters events per viewer/channel, projects community-specific agent presence and sends correlated runner acknowledgements. Tokens never belong in URLs, logs, snapshots, ordinary events or model prompts. The server never runs a provider model or stores provider credentials.

Run `npm run check:issue1 -w @ada/server` for the multi-community REST/WS/privacy/lifecycle flow and `npm run check -w @ada/server` for its typecheck. The older workspace, seed, gated, e2e and smoke checks remain required because the previous card/module/import paths are preserved.

Configuration remains `PORT` (default `8787`), `ADA_DB` (default `apps/server/data/ada.db`) and optional `ADA_COURSE` for seed/legacy flows. Normal `npm run dev` does not seed.

## Running and checking

`npm run dev -w @ada/server` starts the API with file watching;
`npm run start -w @ada/server` starts it without a watcher. The root
`npm start` uses the latter and serves `apps/web/dist` after `npm run build`.
A fresh database is migrated automatically; no seed is needed for hosted
accounts or communities.

`npm run check:hosted` at the root checks current contracts and all
workspaces; `npm run check:legacy` covers retained compatibility behavior.
`npm run check` combines both with lint and documentation checks. Checks
own throwaway data; never aim a mutation/smoke script at a real course.

## Retained compatibility paths

Legacy `db.ts`, workspace modules, seed import, and singleton routes retain
modules, materials, reports, cards, and gated `/api/claim` behavior under
`ADA_REQUIRE_MEMBERSHIP`. They are not the hosted identity contract.
Read [the historical server guide](../../docs/history/server-fixture-api-2026-08.md)
for their routes and fixtures. They remain covered by seed, workspace,
end-to-end, gated, and smoke checks.

## Growth boundary

Put tenant lifecycle and permission invariants in `tenant.ts`, transport in
`api.ts`/`ws.ts`, schema upgrades in `migrations.ts`, and shared payloads in
`packages/protocol`. Keep migrations compatible with both retained and
hosted data. Model execution remains in the runner. Hosted runner operations,
stronger login methods, and durable mention delivery are future changes.

## Automatic agents (2026-09-06)

`POST /api/runner-host/enroll` is an installation-only control endpoint,
enabled by `ADA_RUNNER_HOST_TOKEN` (at least 32 characters). It accepts
previous enrollments, rotates only missing/invalid credentials, and returns
active agent configurations. Ordinary user/runner credentials cannot call it.
The separate host executes models; provider API keys never reach this server.
UI community creation requests two starter agents atomically. Work carries
current rules; DMs implicitly address the agent. `check:agents` verifies
the complete automatic lifecycle with fake providers and temporary data.
