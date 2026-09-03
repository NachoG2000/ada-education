# Buzz Parity UI

## Request

> Rebuild Ada's visible SPA as a faithful educational adaptation of Buzz desktop
> at commit `0720f5380ce8a6c050afac159f8462c06cd51ab5`, keeping Ada's local
> TypeScript server, SQLite database, and external runner. Deliver the complete
> working chat/configuration surface: shell, Inbox, channels, messages, threads,
> search, agents, channel creation/management, and scoped settings. Remove Ada's
> visible Modules, My study, and dedicated Card File/document pages. Do not
> import Buzz's Rust, Nostr, relay, repository, Canvas, Pulse, Projects,
> Workflows, huddle, or hosted runtime architecture.

## Goal

Ada's default connected SPA is a complete, working education adaptation of
Buzz's desktop chat workspace: the same framed shell, navigation density,
conversation ergonomics, thread panel, command palette, channel management,
agent catalog/configuration, and scoped settings. All mutations persist through
Ada's existing TypeScript API and SQLite database and arrive live over the
existing WebSocket. Buzz is a UI/interaction reference only; Ada keeps its local
server, protocol, external runner, identity model, and course data.

## Acceptance Criteria

- [ ] [AC-1] `DECISIONS.md` gains a dated 08/24 decision that adopts Buzz commit
  `0720f5380ce8a6c050afac159f8462c06cd51ab5` as the visible SPA reference,
  supersedes only the custom Card File/Modules/My study page direction in
  §§15/18, and explicitly preserves the local TypeScript server + external
  runner decision in §14. Root, web, server, protocol, and runner `AGENTS.md`
  files describe the current chat/config surface and its boundaries; the
  source-backed map remains in `research/2026-08-23-buzz-ui-map.md`.
- [ ] [AC-2] An idempotent, versioned SQLite migration upgrades an existing
  seeded DB without changing IDs, messages, cards, tokens, or module data. The
  protocol and snapshot add channel visibility/lifecycle/creator timestamps,
  agent description/runtime/model/status timestamps, message edit/delete
  timestamps, attachment metadata, and per-person reactions. A second server
  boot applies no migration twice, and re-seeding preserves dynamically created
  channels, agents, memberships, tokens, reactions, and attachments.
- [ ] [AC-3] The channel API supports list/get/create/update, member/agent
  assignment, archive/unarchive, and delete. Course/work creation and changes
  require a teacher; a person may create a private channel they own. Open
  channels are readable by course members; private channels and their messages,
  threads, cards, and membership are visible only to active members. Archived
  channels stay readable but reject new writes. Deleting a channel with any
  message, thread, card, module, assignment, or attachment returns 409 with an
  archive recommendation; an empty channel can be deleted safely.
- [ ] [AC-4] The agent API supports list/get/create/update, channel assignment,
  deactivate/reactivate, safe delete, and runner-token rotation. Community
  agents require a teacher; personal agents belong to their creator. The create
  and rotate responses reveal the generated runner token and exact setup command
  once; ordinary snapshots and logs never expose it. Provider credentials are
  never accepted. Deactivation revokes the token but preserves history; deleting
  an agent with authored messages/cards/reports returns 409 with a deactivate
  recommendation.
- [ ] [AC-5] Message authors can edit or delete their messages, teachers can
  moderate, and active channel members can add/remove one reaction per emoji.
  Deleted messages remain as timestamped tombstones so threads and citations do
  not break. Every successful mutation produces exactly one typed WS event and
  converges in a second browser without reload; invalid actors, archived
  channels, unknown entities, and malformed inputs return typed JSON errors and
  do not mutate the DB.
- [ ] [AC-6] A channel member can select, upload, send, download, and render
  attachment metadata for a file up to 10 MiB. The server stores bytes under a
  channel-scoped course path using a generated filename, validates MIME/name/
  size, prevents traversal and cross-channel access, returns byte-identical
  content, and removes an unattached failed upload. Attachment upload progress,
  failure, removal-before-send, and retry are visible in the composer.
- [ ] [AC-7] Membership gating remains compatible with owner claim, invite/join,
  person picker in ungated dev, `/ws`, and `/ws/runner`. Gated snapshots are
  viewer-specific and never leak private-channel names, members, messages,
  attachments, cards, or threads. Client-supplied author/creator IDs never
  override the bearer identity; agent tokens remain GET-only on the REST API.
- [ ] [AC-8] `@ada/protocol` owns all new Zod inputs and server-event schemas.
  Server hooks broadcast channel, member/agent, message mutation, reaction, and
  community/profile events; the web reducer imports the shared union, upserts
  by ID, preserves tombstones/history, and restores an authoritative filtered
  snapshot after reconnect.
- [ ] [AC-UI-1] [UI] At 1440×900, the connected SPA matches the pinned Buzz
  shell: full-viewport education gradient, compact top history/sidebar chrome,
  300 px resizable/collapsible sidebar, rounded inset content surface, Inter
  conversation typography, and a split auxiliary panel. At 375×812 the sidebar
  is a 288 px sheet and the auxiliary panel overlays without clipping the
  composer. Light, dark, and system appearance persist locally and respect
  reduced motion.
- [ ] [AC-UI-2] [UI] Hash navigation exposes Inbox, `#channel/<id>`, Agents, and
  Settings, including browser history back/forward and deep-link restoration.
  The sidebar groups Course, Work, and Private channels, shows unread/presence/
  archived states, offers create/browse actions, and has loading, empty, and
  recoverable connection-error states. Visible Modules, My study, Card File,
  Canvas/docs, Pulse, Projects, Workflows, huddles, and Nostr routes/actions are
  absent.
- [ ] [AC-UI-3] [UI] Inbox provides an education activity view derived from live
  messages: unread channels, mentions/replies, and recent conversations link to
  their channel/thread. A zero-activity account has a purposeful empty state and
  no fabricated metrics.
- [ ] [AC-UI-4] [UI] A channel shows its header metadata/members/manage actions,
  day and unread separators, older-history loading, live presence/typing state,
  an informative first-message empty state, pending/failed/retry message rows,
  edit/delete/reaction actions, attachment rows, and a jump-to-latest control.
  People remain pastel circles and agents remain deterministic silhouettes with
  two eyes and no BOT badge.
- [ ] [AC-UI-5] [UI] The composer persists one draft per channel and thread,
  supports Enter to send and Shift+Enter for newline, `@` mention selection,
  markdown/code/link formatting controls, emoji insertion, attachment selection
  and drag/drop, reply/edit banners, send-disabled/upload/error states, and
  focus restoration after popovers. Optimistic sends reconcile with the server
  or become retryable without duplicating messages.
- [ ] [AC-UI-6] [UI] Opening a message thread produces Buzz's auxiliary thread
  panel with the root, replies, unread marker, empty branch state, bottom-pinned
  reply composer, jump-to-latest, and close/back behavior. Desktop width is
  resizable from 300–720 px with a 380 px default; below 600 px it is an overlay.
- [ ] [AC-UI-7] [UI] Channel creation and management dialogs persist name,
  description, Course/Work/Private group, open/private visibility, active
  people, assigned agents, work status/due date, archive/unarchive, and safe
  deletion. Forms have validation, pending/disabled controls, confirmation,
  focus return, and inline server errors; successful changes update the sidebar
  and open channel live.
- [ ] [AC-UI-8] [UI] Agents is a route-level catalog with Buzz's page density,
  responsive actions, identity preview, status/runtime/model/channel summaries,
  and create/edit dialogs for name, description, instructions, community/
  personal scope, scripted/claude runtime, optional model label, channel
  assignments, and deterministic figure reroll. Creation/rotation shows a
  copyable setup command; deactivate/reactivate/delete conflicts are explicit.
- [ ] [AC-UI-9] [UI] Settings uses Buzz's grouped two-column shell (responsive
  off-canvas navigation) but includes only Course & profile, Appearance, Agent
  runner setup, Invites, and Keyboard shortcuts. Course/profile edits and
  teacher invite creation persist; students see read-only course data and no
  teacher controls. Escape closes settings and Back to Ada restores the prior
  route.
- [ ] [AC-UI-10] [UI] Cmd/Ctrl+K opens a Buzz-style command palette that searches
  visible channels, people, agents, and messages and runs allowed actions.
  Cmd/Ctrl+Shift+N creates a channel, Cmd/Ctrl+, opens settings, Cmd/Ctrl+S
  toggles the sidebar, Cmd/Ctrl+[ and ] navigate history, Cmd/Ctrl+F scopes
  search to the channel, and Escape closes the top overlay with focus restored.
  All actions remain reachable without shortcuts.
- [ ] [AC-UI-11] [UI] Join/claim/switch-person remains correct inside the new
  shell: no gated course data before auth, owner claim enters as teacher, an
  invite creates a student, live membership/messages reach the teacher, and
  switch-person clears the token. Dialogs, sheets, menus, fields, icons, figures,
  error/status regions, and focus order have accessible names/roles, visible
  focus, adequate contrast, and keyboard operation at desktop and narrow widths.
- [ ] [AC-19] A targeted server check proves migrations, private snapshot
  filtering, channel CRUD/conflicts, agent token lifecycle, message edit/delete/
  reactions, attachment byte fidelity/traversal rejection, authorization, and
  WS event counts. Existing server/runner typechecks, seed, scripted, smoke,
  gated, e2e, web typecheck, lint (no new warnings), and build pass. Browser
  evidence includes desktop/narrow screenshots of shell, chat/thread, channel
  management, agents, settings, command palette, and join/invite states, followed
  by an independent code/security/UI review with all findings resolved.

## Scope

- The visible Vite/React SPA and its hash navigation.
- Shared protocol types/events and additive SQLite migrations.
- Local REST/WS behavior required by chat, channel, agent, attachment, profile,
  course, invite, and settings interactions.
- Connected mode as the fully mutable product. Synthetic demo mode remains a
  clearly labelled, read-only visual preview with mutations disabled.
- Ada's existing cards/modules/feedback/reports remain available to runners and
  may render as inline conversation artifacts; no dedicated page exposes them.

## Non-goals

- Buzz's Rust/Tauri shell, Nostr keys/relays, hosted community topology, agent
  harness internals, provider credentials, repositories, Canvas, Pulse,
  Projects, Workflows, Reminders, huddles/voice, notifications, mobile apps,
  moderation/role matrices, or collaboration/document authoring.
- New grading, broad permissions, billing, SSO, multi-course tenancy,
  personalization, vector search, or a hosted runner.
- Changing the name of the seeded Ada agent or pluralizing `fromCard`; both stay
  separate open decisions.
- Deleting persisted learning history merely to make a CRUD action succeed.

## Risks

- Viewer-specific private snapshots can regress runner/person authentication;
  verify both WS paths and ungated development explicitly.
- Existing SQLite files have no migration framework; migration ordering,
  idempotence, foreign keys, and seed preservation are release gates.
- Optimistic UI plus WS echo can duplicate messages/reactions unless all reducers
  use stable IDs and authoritative upserts.
- File uploads add traversal, MIME, size, byte-integrity, authorization, and
  orphan-cleanup risks.
- A visual copy can become a static mockup; every create/edit/archive/deactivate/
  reaction/upload/settings control requires persisted browser evidence.

## Verification

1. Protocol/server: targeted CRUD/chat/migration check plus server typecheck,
   seed, smoke, gated, and e2e scripts against throwaway DB/course copies.
2. Runner: typecheck and scripted-runtime check, including unchanged mention and
   remote material behavior.
3. Web: TypeScript build, oxlint with no new warnings, production build, and
   connected-mode manual/browser flows.
4. Browser: fresh gated teacher and student contexts at 1440×900 and 375×812;
   screenshots and interaction assertions for every `AC-UI-*` criterion,
   keyboard/focus/reduced-motion/contrast inspection, and reconnect convergence.
5. Review: independent source/security/data-integrity review plus an independent
   Buzz visual-fidelity pass against the pinned clone; fix findings and rerun the
   affected evidence before completion.

## Capability Deltas

- `deltas/chat-workspace.md`
- `deltas/channel-management.md`
- `deltas/agent-management.md`
- `deltas/app-settings.md`
- `deltas/course-membership.md`
- `deltas/course-modules.md`
- `deltas/student-study.md`
