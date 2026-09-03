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

The user requested GPT-5.6 Luna implementation workers with primary-agent
review. Each worker has an exclusive file area; no worker may declare the issue
complete. Review findings and reruns will be added here as their diffs land.

- Shared protocol: pending.
- Server/database/WebSocket: pending.
- Local runner adapters: pending.
- Web/session/shell: pending.
- Documentation and final issue checklist: pending.
