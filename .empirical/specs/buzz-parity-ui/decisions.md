# Decisions: Buzz-parity course workspace

Record concise, externally reviewable evidence and choices here.

## D-001: Buzz is the visible interaction reference, not the backend

Status: Accepted

### Evidence

- The user explicitly requested a 1:1 Buzz UI adapted to education and excluded
  Ada's document pages.
- `research/2026-08-23-buzz-ui-map.md` inventories the pinned Buzz desktop UI.
- `DECISIONS.md` §14 already rejects the Buzz fork in favor of Ada's local
  TypeScript server and external runner.

### Options

1. Fork/import Buzz's Tauri/Rust/Nostr application.
2. Copy only colors around Ada's existing Card File shell.
3. Reproduce Buzz's visible component hierarchy and interactions in Ada's SPA,
   backed by Ada's typed API/SQLite/runner.

### Chosen approach

Option 3. The source clone is a visual/behavioral oracle; no Buzz runtime,
network identity, relay, repository, or hosted-agent code crosses the boundary.

### Trade-offs and risks

- Visual parity must be checked in a browser, not inferred from similar class
  names. The pinned commit and screenshots make the target repeatable.

### Verification

- AC-1, AC-UI-1..10; independent fidelity review against the pinned source.

## D-002: Version SQLite with explicit migrations

Status: Accepted

### Evidence

- `openDatabase()` currently re-executes `schema.sql`; that creates new tables
  but does not add columns to existing Railway/local volumes.
- Channel/agent/message state must survive upgrades and re-seeds.

### Options

1. Recreate the DB or require a manual re-seed.
2. Probe every column and suppress duplicate errors.
3. Use ordered `PRAGMA user_version` migrations in transactions.

### Chosen approach

Option 3. Base schema describes a fresh DB; `migrations.ts` upgrades existing
files once and backfills deterministic defaults.

### Trade-offs and risks

- Every future schema change now needs a numbered migration. This is intentional
  release discipline for persistent deployments.

### Verification

- AC-2: migrate a copy of the pre-feature DB twice and compare IDs/data/tokens.

## D-003: Filter snapshots and events at the server

Status: Accepted

### Evidence

- Membership gating authenticates people today but `GET /api/community` still
  returns the whole course, including private/teacher channels.
- Client-only hiding would leak names/content through REST, WS, search, and URLs.

### Options

1. Hide private rows only in React.
2. Add per-endpoint checks but keep whole snapshots/broadcasts.
3. Build viewer-filtered snapshots and authorize both REST entities and WS
   recipients from the same channel predicate.

### Chosen approach

Option 3. Reconnect snapshots are authoritative and every event is broadcast only
to sockets that can read its channel. Agent snapshots use assigned channels.

### Trade-offs and risks

- Snapshot caching cannot be global; filtering work is acceptable for one local
  course and required for privacy.

### Verification

- AC-3, AC-7, AC-8 and the private-channel browser/search attack matrix.

## D-004: Archive history; delete only empty entities

Status: Accepted

### Evidence

- The repo's knowledge thesis requires messages/cards/sources to remain
  attributable.
- The user explicitly asked that non-empty channel deletion and authored-agent
  deletion be refused safely.

### Options

1. Cascade-delete history.
2. Soft-delete every entity even when empty.
3. Archive/deactivate to preserve history; permit physical deletion only after
   a transactional reference check proves the entity empty.

### Chosen approach

Option 3. Archived channels are read-only and reversible. Inactive agents retain
identity/history and lose runner access. Conflicts return 409 with the safe path.

### Trade-offs and risks

- Operators cannot erase authored history through this UI. Deliberate retention
  controls can be a separate governed feature.

### Verification

- AC-3, AC-4, AC-5 and DB reference-conflict checks.

## D-005: Runner enrollment is one-time; provider access stays external

Status: Accepted

### Evidence

- `DECISIONS.md` §14 and §20 keep model execution/provider access in an external
  runner owned by the teacher/org.
- Agent creation needs a usable connection credential, not provider secrets.

### Options

1. Store API keys in the Ada server.
2. Create an agent without any operational handoff.
3. Return Ada's generated runner token/setup command only on create/rotation;
   keep provider credentials in the external process environment.

### Chosen approach

Option 3. Snapshots expose runtime/model/status but never token. Deactivation
revokes; reactivation requires rotation.

### Trade-offs and risks

- Losing the one-time token means rotating it. This is safer and explicit.

### Verification

- AC-4, AC-UI-8/9; token-leak searches and old/new runner auth checks.

## D-006: Store chat attachments as authorized local bytes

Status: Accepted

### Evidence

- The deployment already owns a persistent course volume and safely serves raw
  module bytes.
- The requested composer includes attachment selection/display; a filename-only
  mock would not be functional.

### Options

1. Show local filename chips without uploading.
2. Embed base64 bytes in message JSON/SQLite.
3. Store generated-path bytes under the course volume and relational metadata in
   SQLite, with channel authorization and a 10 MiB limit.

### Chosen approach

Option 3. Messages reference attachment rows; `storage_path` never reaches the
client; upload/download/delete share resolve+prefix guards.

### Trade-offs and risks

- No object-store scaling or thumbnails in this local phase. Byte fidelity,
  authorization, cleanup, and traversal checks are mandatory.

### Verification

- AC-6, AC-UI-4/5; binary round trip and cross-channel/traversal attacks.

## D-007: Stable client IDs make optimistic send retry idempotent

Status: Accepted

### Evidence

- WS may arrive before the POST response, and a lost response can make a retry
  duplicate a server-accepted message.

### Options

1. Disable optimistic UI.
2. Deduplicate by body/timestamp heuristics.
3. Generate a client ID once and make POST idempotent by author/client ID.

### Chosen approach

Option 3. Pending rows reconcile by client ID; persisted rows/events upsert by
server message ID.

### Trade-offs and risks

- Adds one nullable indexed column; old callers remain compatible.

### Verification

- AC-5 and AC-UI-5: response/event reordering and retry-after-lost-response.

## D-008: Keep hash navigation and one community state owner

Status: Accepted

### Evidence

- The SPA already routes on `location.hash` and centralizes the full snapshot,
  panels, REST writes, and WS events in `CommunityProvider`.
- Required destinations are few and do not need nested data loaders.

### Options

1. Add React Router and a second query/state layer.
2. Keep navigation implicit in active-channel local state.
3. Add a typed hash parser/serializer and extend the existing provider.

### Chosen approach

Option 3. Canonical deep links are Inbox, channel, Agents, and Settings. Old
Modules/My study hashes replace to Inbox; browser history stays native.

### Trade-offs and risks

- Route transitions remain client-only; suitable for a same-origin SPA and easy
  to replace later without changing API contracts.

### Verification

- AC-UI-2/6/9/10 and deep-link/back-forward browser flows.

## D-009: Use the existing message model with a Markdown textarea

Status: Accepted

### Evidence

- Ada stores paragraphs as typed text/cite/code blocks and already has a robust
  textarea composer with mention selection.
- Buzz uses Tiptap internally, but the requested parity is observable UI and
  interaction, not Buzz's private document format.

### Options

1. Import Tiptap and translate its document tree into Ada blocks.
2. Use `contenteditable` with custom selection/HTML sanitization.
3. Extend the controlled textarea with selection-aware Markdown controls,
   mentions, emoji, attachments, reply/edit banners, and Buzz styling.

### Chosen approach

Option 3. It keeps send/newline/accessibility behavior predictable and avoids a
second content model. Shared parsing remains typed and sanitized.

### Trade-offs and risks

- Formatting is Markdown-source editing rather than rich WYSIWYG. The toolbar,
  shortcuts, previewed messages, and attachment behavior match the required UI.

### Verification

- AC-UI-5 and keyboard/selection/long-text browser cases.

## D-010: Connected mode mutates; synthetic demo is read-only

Status: Accepted

### Evidence

- `demo.ts` is explicitly an opt-in immutable synthetic source; CRUD without a
  server cannot persist or exercise the required API.

### Options

1. Build a second mutable in-memory implementation for demo mode.
2. Hide all controls in demo mode without explanation.
3. Render the same shell/data in demo mode with mutation controls disabled and a
   clear read-only preview explanation; default connected mode is fully working.

### Chosen approach

Option 3. One visible design, one mutation backend, no misleading fake success.

### Trade-offs and risks

- `npm run dev:demo` does not demonstrate CRUD; normal `npm run dev` does.

### Verification

- AC-UI-1..10 in connected mode; demo smoke verifies controls explain read-only.
