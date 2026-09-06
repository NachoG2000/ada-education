## Why

Issue #1 delivered the hosted-service foundation (`DECISIONS.md` §22): accounts, communities, memberships, channels, DMs, agents, runners and a default-shadcn shell. The UI works but is **primitive in how it interacts**, not in how it looks: creating a channel is an inline input tucked under a "Browse" toggle, agents are managed from a sheet hanging off a sidebar row, there is no Agents page, no settings route, no command palette, no URL for anything, sign-out is a bare icon that discards the only credential the user has, and one global "notice" div stands in for toasts.

`DECISIONS.md` §22 says "UI = Buzz's shell, no more, no less". The shell shape was copied; the **interaction grammar** was not. This change closes that gap: for every use case both products share, Ada presents it the way Buzz does — same entry point, same container (dialog / auxiliary panel / route / popover / hover toolbar), same landing after success, same confirmation rule. Styles stay default shadcn; components are not "improved", they are re-arranged.

Evidence: `research/2026-09-03-buzz-interaction-inventory.md` (Buzz and Ada inventoried side by side, with `path:line` for every claim).

## What Changes

- **A real router.** Community, channel, thread, Agents, new-message and Settings become URLs; reload and back/forward work; the last visited channel per community is restored (Buzz `AppShell.tsx:275-323`).
- **Community actions move to a switcher menu** in the sidebar header (switch, add, invite, settings, leave); the rail shows only when the user has two or more communities.
- **Create channel, browse channels, invite, add community, add agent to channel, create/edit agent, ⌘K search become dialogs** with Buzz's fields, defaults and landings.
- **Channel settings, members and profiles become auxiliary panels** (split pane on wide screens, overlay below), replacing the header pencil/trash icons and the sidebar Members tab.
- **An Agents page** (`/agents`) becomes the management surface for agents; the sidebar Agents section is replaced by a pinned "Agents" nav item.
- **A Settings route** (`/settings`, ⌘,) hosts Profile, Community (teacher), Members (teacher), Invites (teacher), Keyboard shortcuts and Account (sign out with recovery gate).
- **Messages get a hover toolbar** (reply in thread, edit, more-actions menu) and threads get Buzz's open/close mechanics (reply-count affordance, Escape to close, URL).
- **Feedback uses the mounted shadcn toaster**, pending labels on submit buttons and inline errors in dialogs; the bespoke notice div is removed.
- **Ada-only flows** (roles, role-bound invites, runner enrollment, teacher-visible DMs, one-time tokens, last-teacher rule) use the interaction baseline in `design.md` §8. Issue #4 becomes the post-implementation QA pass for those Ada-specific surfaces.

This change supersedes three sentences of `DECISIONS.md` §22 ("no standalone Agents page", "no broad Settings area", "no search surfaces") — recorded as §23.

## Capabilities

### New Capabilities
- `web-client`: navigation model, container per use case, feedback model, keyboard shortcuts, Agents page, Settings route, command palette.
- `community-server`: three small additions the interaction grammar needs and the protocol already hints at — `PATCH /api/communities/:communityId/members/:userId` (role change), `GET`/`DELETE` invites (list, revoke), `PATCH /api/users/me` (display name). All three are required; none changes the tenancy or token model.

## Non-goals

- No visual redesign. Default base-nova shadcn stays; `DESIGN.md` Card File rules stay paused.
- No reactions, attachments, read markers, typing indicators, message search, mute/star, channel templates, ephemeral channels, forums, teams, personas, huddles, workflows, projects, Pulse, mesh compute, mobile pairing. Buzz has them; Ada's hosted protocol does not, and §22 leaves them out.
- No cards UI. `card.published` stays unrendered, including no system line in the conversation.
- No hosted runners, billing, OAuth, notifications.

## Impact

- `apps/web/src/components/hosted.tsx` is split by surface (shell, community, channels, agents, settings, messages, threads) under TanStack Router; `lib/hosted-api.ts` gains wrappers for the three required routes.
- `packages/protocol/src/hosted.ts` gains inputs/projections for role change, invite list/revoke and profile update.
- `apps/server/src/api.ts` / `tenant.ts` gain the corresponding routes and events.
- `DECISIONS.md` §23, `apps/web/AGENTS.md`, `AGENTS.md` root updated in the same change.
- Tasks (`tasks.md`) cover the complete approved baseline; issue #4's hands-on QA follows implementation.
