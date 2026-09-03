# GitHub issue #1 implementation log

Date: 2026-09-03  
Source: https://github.com/NachoG2000/ada-education/issues/1  
Source status when work began: open; read in full with `gh issue view 1`.

## Objective and fixed scope

This branch implements the local demo foundations for Ada as a hosted service:

- user identity independent from community membership;
- several communities in one deployment, with teacher/student role per
  membership and a community switcher;
- display-name account creation and token restoration;
- UI-created communities, role-scoped single-use/reusable invite codes,
  channels, members, and agents;
- public channel browse/join/leave, rename, and archive;
- one private DM per user/agent pair, visible to that pair and community
  teachers;
- agent configuration for local Claude or Codex subscription runners, with a
  one-time connection token/command and community-scoped presence;
- channel messages, threads, mentions, author edit, teacher moderation, and
  deletion tombstones that converge over scoped events;
- member removal and leave without deleting the global user or other
  memberships, with a last-teacher invariant;
- Buzz's shell structure in default base-nova shadcn styles, limited to the
  community rail, sidebar sections, channel, composer, roster/management, and a
  thread-only right panel;
- card/filesystem memory remains operational behind the server/runner boundary,
  while card strips, folded tabs, seals, panels, Modules, My study, Inbox,
  standalone Agents, and broad Settings routes are absent from the product UI.

This phase does not add deployment changes, billing, email/password/OAuth,
broad permissions, hosted runners, grading, search, notifications, a proactive
agent loop, or a separately designed mobile product.

## Implementation boundaries

- Keep `DECISIONS.md` §14: the Hono/SQLite server stores and relays; an external
  runner process owns provider CLI authentication and model execution.
- User, invite, and agent tokens are 32 random bytes encoded as base64url. The
  server stores only SHA-256 digests and returns raw values only from the
  corresponding creation/rotation result.
- REST community resources are nested under
  `/api/communities/:communityId`. The bearer token supplies the user; the path
  supplies the tenant; bodies never choose their actor or role.
- Browser and runner WebSockets authenticate in their first protocol frame.
  Tokens do not appear in WebSocket URLs, snapshots, events, logs, or provider
  prompts.
- Every stored community resource, query, mutation, event, and runner presence
  key carries or derives one community id. Cross-community identifiers return
  no data and cannot be mutated.
- Public directory metadata is visible to active community members, while full
  channel/message history requires channel membership. Agent DMs have their own
  stricter authorization rule.
- Agent deletion and membership removal are lifecycle changes. They revoke
  access and active roster links but preserve message/card attribution.
- The legacy Neural Networks course remains an explicit, idempotent fixture
  import. Normal empty startup and onboarding do not require `community.json`.

## Starting point and preservation

- `e4bef7b` records the reviewed Buzz-shaped workspace donor on
  `fix/buzz-parity-ui`.
- `a7595c5` removes the repository-local SDD workflow at the user's request.
- `24a5843` semantically reconciles the preserved Railway follow-up snapshot
  `ed4eaae`, retaining binary material sync, server token override behavior,
  Docker collision safety, and related checks without restoring removed
  workflow metadata.
- `cb00e4e` imports the authoritative 09/03 product pivot and its research.
- The original dirty `main` worktree was never stashed, reset, switched, or
  overwritten. Work continues in the isolated
  `feature/issue-1-hosted-service-demo` worktree.

## Baseline evidence before the tenant rewrite

All commands below passed on the issue branch after donor/Railway reconciliation:

- `npm run check -w @ada/server`
- `npm run check -w @ada/runner`
- `npm run typecheck`
- `npm run check:workspace`
- `npm run check:gated -w @ada/server`
- `npm run smoke`
- `npm run build`
- `npm run lint` completed with the donor's existing React Fast Refresh and
  set-state-in-effect warnings, and no errors.

The baseline is evidence for the old singleton workspace only. It does not
prove issue #1 until the new two-community isolation, account/invite, DM,
Claude/Codex, presence, roster, browser, and no-card checks pass.

## Primary review log

The implementation was reviewed in the isolated
`feature/issue-1-hosted-service-demo` worktree. The application work is split
into the following commits (the original dirty worktree remains untouched):

- `0b62fd4`, `a47d400`, `a94e925`: tenant-scoped protocol contracts, correlated
  runner acknowledgements, and explicit authorship in runner work.
- `7f92af9`: multi-community SQLite/API/REST/first-frame WebSocket domain,
  privacy filters, invitations, DMs, membership lifecycle, and issue flow.
- `19c4495`: local Claude/Codex subscription runner with workspace bootstrap,
  provider isolation, scoped prompts, and outbound first-frame authentication.
- `e4bef7b`: reviewed Buzz-shaped shadcn workspace donor; the hosted shell is
  subsequently mounted by the issue implementation while old card/modules
  screens remain unmounted history.
- `a7595c5`, `24a5843`, `5be40c8`: remove repository SDD metadata and preserve
  the independent Railway/material-sync repairs without restoring that workflow.
- `cb00e4e`, `e3afab9`: hosted-service pivot and this implementation record.

Primary checks completed during implementation:

- protocol typecheck and hosted contract check;
- server typecheck and the issue #1 tenant/API/WS flow, including roles,
  invitation rotation/revocation, cross-community isolation, DMs, presence,
  mentions, runner acknowledgements, cards, and membership lifecycle;
- runner typecheck, provider checks, and retained scripted-runtime checks;
- web typecheck/build and lint (existing donor warnings only).

## Final verification

The final code and documentation state passed:

- `npm run check:issue1` (hosted protocol contracts, server typecheck and full
  tenant flow, runner typecheck/provider behavior, web typecheck and production
  build);
- `npm run check:workspace`, `npm run check:seed -w @ada/server`,
  `npm run check:gated -w @ada/server`, `npm run check:e2e -w @ada/server`, and
  `npm run smoke` against their isolated databases and ports;
- `npm run check:scripted -w @ada/runner` for the explicitly retained fixture
  harness;
- `npm run lint`, with no errors and only the pre-existing Fast Refresh and
  set-state-in-effect warnings in retained UI files;
- `node scripts/docs-check.mjs`, shell syntax checks for the retained deploy and
  reset scripts, and `git diff --check`.

Both Docker images built successfully. The remaining runtime portion of
`npm run check:docker` could not allocate a Docker network because the local
daemon reported that all predefined address pools were already subnetted. No
unrelated Docker networks were removed. This check covers the retained
single-course deployment fixture; deployment itself remains outside issue #1.

Browser acceptance used a fresh empty database and exercised:

- display-name account creation and the one-time user token;
- first and second community creation plus rapid switching without stale
  cross-community state;
- channel creation, a message with an agent mention, a desktop thread, a
  mention reply inside the thread, and confirmed message deletion;
- agent creation with the one-time runner credential still visible after the
  server refresh;
- the invite dialog and role/mode controls;
- the 390 × 844 narrow layout, including the workspace and thread sheets.

The pass also caught and fixed two integration defects before completion: the
persisted membership projection includes `updatedAt`, and the hidden mobile
thread sheet no longer closes the visible desktop thread panel. A final UI
review found no high- or medium-severity issue #1 blockers.

The repository-local workflow integration and its standalone editor/MCP
configuration files are removed. A repository-wide search and GitHub issue #1
both contain no reference to it; the old issue link now points at
`DECISIONS.md` §21 instead.
