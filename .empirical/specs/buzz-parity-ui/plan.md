# Plan — Buzz parity UI

The implementation follows `design.md` and decisions D-001..D-010. Tasks are
ordered by dependency and each closes with its own narrow check before the next
slice consumes it. All work happens in the approved
`fix/buzz-parity-ui` worktree.

## Phase 0 — Baseline and documents of truth

- [x] **T001 — Preserve and measure the baseline**
  - Record `git status`, install the existing npm workspace dependencies in this
    worktree, and run protocol/server/runner/web typechecks plus the current
    build. Do not import changes from the dirty main worktree.
  - Confirm the pinned Buzz clone commit and the source map file.
  - Evidence: baseline command output; no unexplained worktree changes.
- [x] **T002 — Record the superseding product decision before code**
  - Append `DECISIONS.md` §21 dated 08/24: Buzz UI reference, chat/config-only
    visible scope, retirement of Modules/My study/Card File pages, preservation
    of §14 local server/external runner, excluded Buzz areas.
  - Update root `AGENTS.md` current-state/scope language enough that subsequent
    agents cannot implement against the superseded shell.
  - Criteria: AC-1. Check: `node scripts/docs-check.mjs` after adding patterns in
    the final docs task.

## Phase 1 — Shared protocol

- [x] **T010 — Add domain types** (depends T001/T002)
  - Extend Channel, Agent, Message, Community and supporting types with the
    optional backward-compatible fields from design §2: visibility/status/
    creator timestamps, agent configuration/lifecycle, client/edit/delete IDs,
    attachments and aggregate reactions.
  - Export typed API inputs/results and stable error codes.
  - Files: `packages/protocol/src/types.ts`, exports.
- [x] **T011 — Own validation and events in protocol** (depends T010)
  - Add Zod input schemas for channel/agent/community/profile/message/reaction/
    attachment/read/typing and extend the shared server-event union.
  - Keep every existing runner/server event source-compatible.
  - Files: `packages/protocol/src/events.ts`, `index.ts`.
  - Check: `npm run check -w @ada/server`, `npm run check -w @ada/runner`.

## Phase 2 — Persistent server capability

- [x] **T020 — Add migration v2** (depends T010)
  - Add `migrations.ts`, `PRAGMA user_version` transaction, fresh-schema columns,
    tables, indexes, deterministic backfills, and second-boot idempotence.
  - Preserve tokens/dynamic rows during seed upserts.
  - Files: `apps/server/src/migrations.ts`, `schema.sql`, `db.ts`, `seed.ts`.
  - Criteria: AC-2.
- [x] **T021 — Build viewer-filtered snapshot primitives** (depends T020)
  - Add channel readability/management/membership helpers; filter channels,
    messages, threads, cards, attachments, and member channel IDs from one
    canonical predicate for people and agents.
  - Keep ungated local person-picker compatibility.
  - Criteria: AC-3/7. Check with direct DB snapshot assertions.
- [x] **T022 — Implement transactional channel operations** (depends T020/T021)
  - Create/update/archive/unarchive/join/leave/replace-members/delete-empty,
    work metadata, duplicate-name conflicts, exact history reference checks.
  - Criteria: AC-3.
- [x] **T023 — Implement transactional agent operations** (depends T020/T021)
  - Create/update/channel assignment/deactivate/reactivate/rotate/delete-empty;
    one-time runner enrollment response; revoke token and preserve identity.
  - Criteria: AC-4.
- [x] **T024 — Implement message lifecycle, reactions, reads** (depends T020/T021)
  - Idempotent create by author/client ID; author/teacher edit and tombstone;
    per-member reaction add/remove aggregation; last-read upsert/unread compute.
  - Criteria: AC-5.
- [x] **T025 — Implement attachment byte store** (depends T020/T021)
  - Multipart upload, metadata insert, channel-auth download, unattached delete,
    10 MiB limit, safe generated path, resolve+prefix check, byte fidelity.
  - Criteria: AC-6.
- [x] **T026 — Expose typed REST routes** (depends T022..T025)
  - Add all design §4 routes, actor/capability middleware, stable JSON errors,
    teacher/self/private-owner rules, privacy-preserving 404s.
  - Extend API hooks with the exact new typed mutations.
  - Files: `apps/server/src/api.ts` and narrow helpers.
- [x] **T027 — Deliver authorized WS events and typing** (depends T011/T021/T026)
  - Broadcast channel-scoped events only to readable person sockets; add
    debounced/expiring typing input/output; close revoked agent runner socket;
    retain existing mention/card/module/report protocol behavior.
  - Files: `apps/server/src/ws.ts`, `index.ts`.
  - Criteria: AC-5/7/8.
- [x] **T028 — Add workspace server check** (depends T020..T027)
  - New throwaway DB/course script covers migration twice, seed preservation,
    private filtering, channel and agent lifecycle/conflicts, token redaction/
    rotation, idempotent message retry, edit/tombstone/reactions/read, attachment
    binary/traversal/authorization, typed event counts, malformed input.
  - Register `check:workspace` in server/root package scripts.
  - Criteria: AC-2..8, AC-19.

## Phase 3 — Web data and navigation foundation

- [x] **T030 — Add typed hash routing** (depends T010)
  - Create parser/serializer/navigation helpers for Inbox, channel, Agents,
    Settings section, Join and Figures; retire `#home`/`#modules` to Inbox;
    preserve browser history and last non-settings route.
  - Files: `apps/web/src/lib/routes.ts`, `App.tsx`.
- [x] **T031 — Extend API client, reducer, and provider** (depends T011/T026/T030)
  - Typed REST methods, shared ServerEvent parser, authoritative upsert reducers,
    private-safe snapshot sanitization, optimistic messages/client IDs, drafts,
    uploads, typing map, connection state, route/channel/agent/settings actions.
  - Remove the handwritten event union.
  - Files: `apps/web/src/lib/api.ts`, `community.tsx`, types.
- [x] **T032 — Add persisted appearance/layout state** (depends T030)
  - Light/dark/system, sidebar open/width, auxiliary width and CSS root classes;
    OS-change and reduced-motion handling; versioned localStorage keys.
  - Criteria: AC-UI-1.

## Phase 4 — Buzz shell and discovery

- [x] **T040 — Load UI craft instructions and install primitives** (depends T031)
  - Immediately before UI edits, read the Impeccable craft floor in full.
  - Read the shadcn skill; generate the Command primitive with the official
    shadcn CLI if absent. Do not hand-roll a duplicate primitive.
- [x] **T041 — Build WorkspaceShell, chrome, and sidebar** (depends T032/T040)
  - Full viewport gradients/theme tokens, top history/sidebar/search controls,
    300 px resizable/collapsible sidebar, rounded content surface, Course/Work/
    Private drawers, unread/archive/presence states, profile/settings footer,
    288 px mobile sheet, loading/empty/connection error states.
  - Replace—not layer over—the previous Channel/Card File shell.
  - Criteria: AC-UI-1/2/11.
- [x] **T042 — Build Inbox** (depends T031/T041)
  - Authorized unread/mention/reply/recent activity links, honest empty state,
    no fabricated course metrics.
  - Criteria: AC-UI-3.
- [x] **T043 — Build command palette and global shortcuts** (depends T031/T041)
  - Visible search/actions, keyboard navigation, privacy-safe result corpus,
    shortcuts from AC-UI-10, editable-target guards, Escape/focus restoration.
  - Criteria: AC-UI-10/11.

## Phase 5 — Chat and threads

- [x] **T050 — Rebuild channel header and timeline** (depends T031/T041)
  - Header metadata/members/manage/search; progressively reveal older snapshot
    rows; day/unread separators; empty/loading/offline/typing; jump latest;
    people/agent identities; attachment/edit/tombstone/reaction/pending/error/
    retry message rows and accessible action menus.
  - Criteria: AC-UI-4.
- [x] **T051 — Rebuild composer** (depends T025/T031/T040)
  - Per-channel/thread drafts; mentions; Markdown selection controls and
    shortcuts; emoji; attachment select/drop/progress/remove/retry; reply/edit
    banners; Enter/Shift+Enter; optimistic idempotent send; disabled/error/
    read-only-demo states; focus restoration.
  - Criteria: AC-UI-5.
- [x] **T052 — Rebuild thread auxiliary panel** (depends T050/T051)
  - Root/replies/unread/empty/jump composer; desktop 300–720 px resizable split,
    380 px default; <600 px overlay; bottom anchoring; close/back/focus return.
  - Criteria: AC-UI-6.

## Phase 6 — Channel, agent, and settings configuration

- [x] **T060 — Build channel create/browse/manage flows** (depends T022/T031/T041)
  - Complete fields, member/agent search, work metadata, validation, pending,
    focus, confirmation, archive/unarchive/delete conflict, live navigation.
  - Criteria: AC-UI-7.
- [x] **T061 — Build Agents catalog and dialogs** (depends T023/T031/T041)
  - Catalog density/responsive actions; identity preview; create/edit/reroll/
    assignment/status/delete; one-time enrollment and copy; lifecycle errors.
  - Criteria: AC-UI-8.
- [x] **T062 — Build scoped Settings shell and panels** (depends T026/T031/T041)
  - Course/profile, appearance, runner, invites, shortcuts only; teacher/student
    capability differences; responsive settings nav; Back/Escape; persistence.
  - Criteria: AC-UI-9/11.
- [x] **T063 — Integrate identity gates with the new shell** (depends T041/T062)
  - Fresh gated course, owner claim, invite name form, student landing in Inbox,
    live roster/message, switch-person token clearing; ungated picker unchanged.
  - Criteria: AC-UI-11.

## Phase 7 — Remove retired surfaces and update repo knowledge

- [x] **T070 — Retire visible Ada document/study surfaces** (depends T041/T050)
  - Remove sidebar/routes/panel affordances for Modules, My study, and standalone
    Card File. Keep backend types/data/runner flows and inline citations/card
    publication messages. Remove dead imports and unreachable old view state.
  - Verify excluded Buzz areas do not appear.
  - Criteria: AC-UI-2 and course-module/student-study deltas.
- [x] **T071 — Finish documentation and area contracts** (depends all code)
  - Update `AGENTS.md`, `apps/web/AGENTS.md`, `apps/server/AGENTS.md`,
    `packages/protocol/AGENTS.md`, `packages/runner/AGENTS.md`, PRODUCT/DESIGN only
    where current terminology/design changed, command docs, and docs-check.
  - Record every material implementation/review learning in repo Markdown.
  - Criteria: AC-1.

## Phase 8 — Verification, screenshots, and review

- [x] **T080 — Run backend and build evidence**
  - `npm run check:workspace -w @ada/server`
  - `npm run check -w @ada/server`
  - `npm run check:seed -w @ada/server`
  - `npm run smoke`
  - `npm run check:gated -w @ada/server`
  - `npm run check:e2e -w @ada/server`
  - `npm run check -w @ada/runner`
  - `npm run check:scripted -w @ada/runner`
  - `npm run typecheck`, `npm run lint`, `npm run build`, docs check.
  - Fix code or tests at the owning layer; do not weaken assertions.
- [x] **T081 — Browser interaction and screenshot evidence** (depends T080)
  - Read the in-app browser skill. Start a throwaway gated server/runner.
  - Use fresh teacher and student contexts at 1440×900 and 375×812.
  - Exercise every AC-UI criterion, including two-browser live convergence,
    reconnect, keyboard/focus, reduced motion, dark/system, long/empty/error
    states. Capture shell, chat/thread, channel management, Agents, Settings,
    palette, claim/invite, and mobile screenshots under feature evidence.
- [x] **T082 — Independent Luna reviews and repair** (depends T080/T081)
  - One independent code/security/data-integrity review against AC-2..8.
  - One independent UI fidelity/accessibility review against pinned Buzz source
    and AC-UI-1..11 using screenshots.
  - Resolve every finding, record review Markdown, rerun affected commands and
    screenshots, then collect immutable Empirical receipts.
- [ ] **T083 — Completion audit and integration** (depends T082)
  - Inspect current files/runtime evidence requirement-by-requirement; no intent
    or indirect check counts as completion.
  - Complete Empirical implementation/verify/review/integrate revisions, archive
    capability deltas, and report only the highest proven level. Do not deliver,
    publish, merge, or mutate main without separate authorization.
  - Completion audit passed on 2026-08-24 and Empirical's highest proven level is
    `verified`. Integration and capability archival remain intentionally pending
    because they would mutate the independent target and require separate user
    authorization.
