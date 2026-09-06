## 1. Shared Contracts and Server Operations

- [x] 1.1 Add protocol schemas and inferred types for profile updates, membership role updates, safe invite lists/revocation, and invite consumption results; verify `npm run check -w @ada/protocol` and `npm run check:hosted -w @ada/protocol` pass.
- [x] 1.2 Add the invite-revocation migration and tenant service operations for profile update, role update, invite listing, and invite revocation; verify migration/reseed and last-teacher invariants with the server checks.
- [x] 1.3 Expose the approved authenticated REST routes and viewer-scoped events, extend the issue #1 tenant-flow check for their authorization and credential boundaries, and verify `npm run check:issue1 -w @ada/server` passes.
- [x] 1.4 Add Zod-validated web API wrappers for all new operations and the invite `consumed` result; verify the web typecheck accepts every request and response boundary.

## 2. Routed Shell and Navigation

- [x] 2.1 Add TanStack Router using its supported React/Vite setup, define the approved workspace/settings routes and redirects, and verify direct URL loads plus browser back/forward in a production build.
- [x] 2.2 Split the hosted UI by shell/surface responsibility while preserving account and tenant hydration, then wire route-driven community, channel, thread, agent, new-message, and Settings selection; verify reload restores each surface.
- [x] 2.3 Implement the three-ring desktop shell, conditional multi-community rail, community switcher menu, top chrome, mobile sidebar overlay, and single responsive auxiliary surface; verify at 1440px, 1024px, 767px, and 360px.

## 3. Account and Community Interactions

- [x] 3.1 Implement the one-time user-token backup gate and the shared gated sign-out confirmation from footer and Settings; verify Continue/Sign out remain disabled until acknowledged.
- [x] 3.2 Implement zero-community onboarding plus the two-step Add community dialog, community switching/restoration, editable Term, confirmed leave, and idempotent-redemption toast; verify each success lands on the correct community channel or empty Inbox.
- [x] 3.3 Implement the intentional role-bound Invite dialog with approved defaults, copy state, Create another, active-invite listing, and revocation; verify raw codes appear only in creation UI.

## 4. Channels, Members, and Direct Messages

- [x] 4.1 Replace inline channel creation/browsing with the create dialog and searchable All/Joined/Archived browser, including Create-from-search and correct join/create landings; verify teacher and student capability variants.
- [x] 4.2 Implement the channel header/menu/context menu and channel-settings/member auxiliary surfaces with inline metadata edits, people/agent assignment, archive, leave, read-only archived state, and identity profile popovers; verify public/private membership and authorization states.
- [x] 4.3 Implement routed New message, agent DM rows, teacher-only read-only Student conversations, the student privacy notice, and retained archived DMs after agent deletion; verify both roles against the same community.

## 5. Agents and Settings Management

- [x] 5.1 Implement the routed Agents list, teacher-only create/edit/delete and add-to-channel dialogs, and student read-only variant; verify successful mutations land or toast as specified.
- [x] 5.2 Implement the agent auxiliary panel, profile popover, four presence states plus Starting grace, and one-time runner enrollment/rotation blocks with live presence; verify tokens are not re-shown outside create/rotate results.
- [x] 5.3 Implement routed Settings sections for Profile, Community, Members, Invites, Keyboard shortcuts, and Account with role-aware visibility, member role menus, last-teacher tooltips, and confirmed removal; verify section changes replace history entries.

## 6. Conversation, Search, and Feedback

- [x] 6.1 Implement message hover/focus actions, More menu, copy text/link, multiline inline editing, confirmed deletion, structured text/code/citation rendering, and edited/tombstone states; verify author/teacher permissions and keyboard behavior.
- [x] 6.2 Implement per-channel drafts, Enter/Shift+Enter composition, keyboard-operable member/assigned-agent mentions, empty/archived/teacher-view states, and send failure feedback; verify agent mentions never offer unassigned agents.
- [x] 6.3 Implement route-backed thread opening, reply-count affordance, root/reply rendering, responsive auxiliary presentation, Escape/close behavior, and thread composition; verify thread URLs survive reload and close on channel navigation.
- [x] 6.4 Implement the command palette, top-chrome trigger, capability-aware result/action sections, direct shortcuts, and visible shortcut reference; verify all approved shortcuts and text-entry conflict handling.
- [x] 6.5 Replace the bespoke notice with the mounted toaster and complete loading, empty, pending, inline-error, reconnecting, permission, and responsive states; verify card publication events remain visually unrendered.

## 7. Documentation and Completion Verification

- [x] 7.1 Update root and touched-area `AGENTS.md`, `DECISIONS.md` §23, and the issue research record with the approved baseline and actual implementation; verify no documentation still describes issue #3/#4 as unimplemented or pre-QA-blocked.
- [x] 7.2 Run protocol, server, runner, migration/workspace, lint, typecheck, and production-build gates; fix any regressions while preserving known lint warnings and record the exact results.
- [x] 7.3 Exercise the production-equivalent app as teacher and student at desktop and phone widths, capture rendered evidence for routes/dialogs/panels/settings/conversation privacy, and fix material accessibility or responsive defects found.
- [x] 7.4 Strict-validate the OpenSpec change, audit every requirement against implementation/runtime evidence, and check every task only after its complete behavior is proven.
