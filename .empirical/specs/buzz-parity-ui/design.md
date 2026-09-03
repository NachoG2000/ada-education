# Design — Buzz parity UI

This design implements the observable contract in `spec.md`. Visual and
interaction facts come from `research/2026-08-23-buzz-ui-map.md` and the pinned
clone at `/Users/ignaciogarcia/Desktop/Personal/buzz` commit
`0720f5380ce8a6c050afac159f8462c06cd51ab5`. Ada's architecture remains the
TypeScript monorepo, local Hono server, SQLite, Vite SPA, shared protocol, and
external runner described by `DECISIONS.md` §14.

## 1. System shape

```text
Browser (hash routes + CommunityProvider)
  ├─ GET viewer-filtered Community snapshot
  ├─ typed REST mutations with bearer identity
  └─ /ws: typed events, typing, reconnect → authoritative snapshot
             │
             ▼
Hono API + WebSocket hub
  ├─ authorization/capability helpers
  ├─ transactional DB operations
  ├─ attachment byte store under ADA_COURSE
  └─ broadcast only to viewers authorized for the entity's channel
             │
             ▼
SQLite (versioned migrations)     external runner (/ws/runner, unchanged model boundary)
```

The full `Community` type remains the reconnect boundary. The server builds it
with `getCommunitySnapshot(database, presence, viewer?)`; a person receives
open channels plus private channels in their active membership, while an agent
receives its assigned channels. Every child collection is filtered by the
visible channel/member set before serialization. Ungated demo/dev calls pass the
selected person as the viewer when present and otherwise retain the existing
full local snapshot for compatibility.

## 2. Protocol

`packages/protocol/src/types.ts` gains:

```ts
type ChannelVisibility = "open" | "private"
type ChannelStatus = "active" | "archived"
type AgentStatus = "active" | "inactive"

interface Attachment {
  id: string; channelId: string; uploaderId: string
  name: string; mime: string; size: number; createdAt: string
  messageId?: string
}

interface MessageReaction { emoji: string; count: number; memberIds: string[] }

interface Channel {
  // existing fields
  visibility?: ChannelVisibility; status?: ChannelStatus
  createdBy?: string; createdAt?: string; updatedAt?: string; archivedAt?: string
}

interface Agent {
  // existing fields
  description?: string; runtime?: "scripted" | "claude"; model?: string
  status?: AgentStatus; createdAt?: string; updatedAt?: string; inactiveAt?: string
}

interface Message {
  // existing fields
  clientId?: string; editedAt?: string; deletedAt?: string
  attachments?: Attachment[]; reactions?: MessageReaction[]
}
```

`events.ts` owns Zod schemas for channel, agent, community/profile, message
edit/delete, reaction, attachment references, read marker, and typing inputs.
The exported `ServerEvent` union adds `channel.created|updated|deleted`,
`member.updated|deleted`, `community.updated`, `message.updated|deleted`,
`message.reactions.updated`, `channel.read`, and `typing.updated`. Existing
events remain source-compatible. The web deletes its hand-maintained mirror
union and imports this union/schema.

## 3. SQLite migration and data model

Create `apps/server/src/migrations.ts`. `openDatabase()` executes the base
schema, reads `PRAGMA user_version`, and applies each missing migration in one
`BEGIN IMMEDIATE` transaction, setting `user_version` only after success.
Migration v2 is idempotent by version, not by swallowing SQL errors.

- `community`: `updated_at`.
- `members`: `description`, `status NOT NULL DEFAULT 'active'`, `created_at`,
  `updated_at`, `inactive_at`. Existing `runtime`, `model`, `token`, provider,
  scope, instructions, and figure columns remain authoritative.
- `channels`: `visibility NOT NULL DEFAULT 'open'`, `status NOT NULL DEFAULT
  'active'`, `created_by`, `created_at`, `updated_at`, `archived_at`. Backfill
  Private group to `visibility='private'`; existing channels receive the first
  teacher member as creator, otherwise the first person member.
- `messages`: `client_id`, `edited_at`, `deleted_at`, `deleted_by`; unique partial
  index on `(author_id, client_id)` when client ID is non-null.
- `message_reactions(message_id, member_id, emoji, created_at)` with primary key
  `(message_id, member_id, emoji)`.
- `attachments(id, channel_id, uploader_id, message_id, name, mime, size,
  storage_path, created_at)`; `storage_path` never leaves the server.
- `channel_reads(channel_id, member_id, last_read_at)` primary key by channel and
  member.
- indexes for channel status/visibility/group, active agent status, reaction
  lookup, attachment message/channel, and message edit/delete ordering.

Seed upserts default missing values but never delete rows absent from
`community.json`, overwrite tokens, detach dynamic memberships, or reset status.
Snapshot adapters default new optional protocol fields for old demo data.

## 4. Database operations and authorization

Add small typed input/result functions to `db.ts`; handlers never assemble SQL.
Multi-table channel/agent/message operations run in explicit transactions.

Authorization helpers in `api.ts`:

- `actor(context, legacyAuthorId?)`: person from bearer when gated; selected
  legacy person in ungated mode; never accepts an agent for mutations.
- `canReadChannel(actor, channel)`: open course member, or active membership for
  private.
- `canManageChannel(actor, channel)`: teacher for Course/Work; creator or teacher
  for Private.
- `canPostChannel`: readable + active + active membership (open channels auto-add
  on explicit Join, not silently on first post).
- `teacher`, `ownsPersonalAgent`, `messageAuthorOrTeacher`.

REST contract:

```text
PATCH  /api/community                         teacher: name/subtitle
PATCH  /api/members/:id                       self: display name

GET    /api/channels                          viewer-filtered
GET    /api/channels/:id                      viewer-filtered
POST   /api/channels                          create
PATCH  /api/channels/:id                      edit/archive/unarchive
PUT    /api/channels/:id/members              replace active people+agents
POST   /api/channels/:id/join                 open channel
DELETE /api/channels/:id/leave                non-creator member
DELETE /api/channels/:id                      empty-only delete

GET    /api/agents                            viewer-visible
GET    /api/agents/:id                        viewer-visible
POST   /api/agents                            create + one-time enrollment
PATCH  /api/agents/:id                        edit/status/assignments
POST   /api/agents/:id/rotate-token           one-time enrollment
DELETE /api/agents/:id                        history-free delete

POST   /api/channels/:id/attachments          multipart upload
GET    /api/attachments/:id                   authorized bytes
DELETE /api/attachments/:id                   uploader, only while unattached

POST   /api/channels/:id/messages             existing + clientId/attachmentIds
PATCH  /api/messages/:id                      edit body
DELETE /api/messages/:id                      tombstone
PUT    /api/messages/:id/reactions/:emoji     add actor reaction
DELETE /api/messages/:id/reactions/:emoji     remove actor reaction
PUT    /api/channels/:id/read                 actor's last-read marker
```

All errors are `{error, code, field?}` with stable codes: `invalid_input`,
`unauthorized`, `forbidden`, `not_found`, `not_channel_member`,
`channel_archived`, `conflict`, and `history_conflict`. The API returns 201 for
creation, 200 for idempotent mutation/read, 400 validation, 401 token, 403
capability/privacy, 404 non-visible/unknown, 409 lifecycle/history conflicts,
and 413 upload size.

Channel deletion checks references in messages, threads (through roots), cards,
modules, assignments, and attachments in the transaction. Agent deletion checks
messages, cards, feedback/reports, created channels, and memberships. Deactivate
is the history-preserving path and clears the token. Reactivation does not invent
a credential; Rotate token returns the next setup command.

## 5. Attachments, optimistic sends, reads, and typing

Uploads use Hono's multipart parsing with one `file` field. Validate non-empty
name, MIME length, actual byte length ≤10 MiB, active membership, and safe
generated storage path:
`raw/chat/<channel-id>/<attachment-id>-<sanitized-display-name>`. The DB stores
the exact relative path; resolve+prefix checks protect upload/download/delete.
Attaching to a message and inserting that message is one DB transaction.
Unattached uploads have a visible Remove action calling DELETE; a failed DB
insert leaves them available for retry rather than silently discarding bytes.

The client creates a stable `clientId` per send. POST is idempotent by
`(authorId, clientId)`: retry returns the existing message. Pending rows are
keyed by client ID, replaced by the server response, and WS events upsert by
message ID; this covers response/event ordering without duplicates.

Read markers update on channel focus and bottom visibility and compute
`Channel.unread` for the requesting person. The web sends debounced ephemeral
`typing.set` messages over `/ws`; the server verifies channel access and
broadcasts `typing.updated` only to authorized channel sockets. Typing state
expires client-side after 4 seconds and is never stored.

## 6. Web navigation and state

Add `apps/web/src/lib/routes.ts`:

```ts
type AppRoute =
  | { kind: "inbox" }
  | { kind: "channel"; channelId: string }
  | { kind: "agents" }
  | { kind: "settings"; section?: SettingsSection }
  | { kind: "join"; token?: string }
  | { kind: "figures" }
```

Canonical hashes are `#inbox`, `#channel/<encoded-id>`, `#agents`, and
`#settings/<section>`. `#home`, `#modules`, unknown/unauthorized channels, and
old empty hashes replace to Inbox. Navigation uses `location.hash`/history and
`hashchange`; no router dependency. Settings stores the prior route for Back.

`CommunityProvider` remains the one connected state owner and gains typed
operations for the new REST calls, draft state, optimistic messages, route
helpers, typing map, connection status, and authoritative shared-event reducers.
Transient UI state (open dialog, menu, selected settings section) stays local.
Drafts, theme, sidebar width/open state, and panel width use versioned localStorage
keys. Synthetic demo mode returns disabled mutation functions with a clear
read-only explanation.

## 7. Component tree

```text
App
└─ identity gate (claim / invite / ungated picker)
   └─ WorkspaceShell
      ├─ TopChrome (history, sidebar, command search)
      ├─ WorkspaceSidebar
      │  ├─ Inbox / Agents
      │  ├─ Course / Work / Private channel sections
      │  └─ profile + Settings
      └─ ContentSurface
         ├─ InboxScreen
         ├─ ChannelView
         │  ├─ ChannelHeader
         │  ├─ MessageTimeline + MessageActions
         │  ├─ Composer
         │  └─ ThreadPanel (split/overlay)
         ├─ AgentsScreen + AgentDialog + EnrollmentDialog
         └─ SettingsScreen
            ├─ CourseProfileSettings
            ├─ AppearanceSettings
            ├─ RunnerSettings
            ├─ InviteSettings
            └─ ShortcutSettings
```

Use existing shadcn/Base UI Dialog, Sheet, DropdownMenu, Tooltip, ScrollArea,
Resizable, Tabs, Input, Textarea, Switch, Select, Checkbox, and Button; generate
the shadcn Command primitive through its CLI for the palette. Product components
stay under `components/ada`; primitives stay under `components/ui`.

The controlled textarea remains the editor engine: formatting actions insert
standard Markdown around the current selection; mention and emoji popovers are
keyboard lists anchored to the composer. This preserves the existing message
block pipeline and avoids importing Buzz's Tiptap document model. Attachment
drop/selection and progress surround the editor without changing stored prose.

## 8. Visual system and responsive behavior

Add semantic shell variables to `index.css`, not raw component colors:

- light gradient `#e6e6b6 → #c4d0da`; dark `#4a4616 → #0a1423`;
- sidebar default 300 px, min 220, max 420, collapsed 48, mobile sheet 288;
- top controls 28 px; content inset 8 px; content radius 16 px;
- auxiliary default 380 px, min 300, max 720; overlay below 600 px;
- conversation 14 px/20 px Inter; existing Literata remains only for inline
  archived card publications and Geist Mono for code/version/keycaps.

`WorkspaceShell` owns the only large gradient. Content surfaces use mapped theme
tokens; no tab colors are spread beyond existing card citations. Agent figures
reuse `Figure`; people reuse pastel initials. Hover, active, selected, focus,
disabled, pending, error, empty, offline, unread, archived, and dark states are
explicit. CSS media queries handle `768px`, `600px`, high contrast, and
`prefers-reduced-motion`.

## 9. Accessibility and failure behavior

- Dialog/Sheet/Command use labelled titles/descriptions, trapped focus, Escape,
  and return focus to the trigger.
- Icon buttons have names/tooltips; agent figures expose the agent name.
- Connection/pending/typing/upload use `role=status`; mutation failures use
  contextual `role=alert`; validation fields use `aria-invalid` and descriptions.
- Composer and result lists implement documented keyboard semantics without
  stealing browser shortcuts from editable targets.
- Disconnect keeps cached state/drafts, shows a recoverable banner, and marks new
  sends retryable. Reconnect fetches a filtered snapshot before resuming events.
- Long names, URLs, attachment names, empty channels, unavailable clipboard, and
  server validation errors wrap or truncate with accessible full labels.

## 10. Implementation order

1. Protocol types/input/event schemas.
2. Migration v2, DB adapters/transactions/filtering, then REST/WS hooks.
3. Targeted server CRUD/chat test, preserving existing gating/runner behavior.
4. Routes/provider/client API and reducer convergence.
5. Immediately before UI edits, load the Impeccable craft floor; then build
   shell/sidebar/navigation/theme, channel timeline/thread/composer, dialogs,
   Agents, Settings, and command palette.
6. Update documents of truth and every touched area `AGENTS.md`.
7. Run full command evidence; run the connected gated server; capture desktop
   and narrow browser evidence; obtain independent code/security and UI-fidelity
   reviews; repair and rerun affected checks.

## 11. Verification mapping

- `apps/server/scripts/workspace-check.ts`: AC-2..8 (migration twice, auth,
  private filtering, CRUD/history conflicts, agent token lifecycle, edits,
  tombstones, reactions, attachments, read markers, event counts).
- Existing `check`, `check:seed`, `smoke`, `check:gated`, `check:e2e`, runner
  `check`/`check:scripted`: regression boundaries.
- Web typecheck, lint, build: shared contract and implementation quality.
- Browser at 1440×900 and 375×812 with teacher/student contexts: AC-UI-1..11,
  screenshots plus keyboard/focus/reconnect assertions.
- Independent review reads the pinned Buzz files named in the research map and
  audits private-data filtering, upload paths, token redaction, history safety,
  optimistic idempotence, and WCAG interaction states.
