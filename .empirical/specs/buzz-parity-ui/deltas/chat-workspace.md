## Purpose

Ada's primary product surface is a Buzz-shaped course conversation workspace:
Inbox, channels, live messages, threads, attachments, reactions, search, and a
responsive auxiliary panel in one fixed SPA shell.

## ADDED Requirements

### Requirement: Buzz-shaped course workspace

The hash-driven SPA provides Inbox, channel, Agents, and Settings destinations
inside a full-viewport gradient frame with compact top chrome, a 300 px desktop
sidebar, rounded content surface, and responsive mobile sheets. The sidebar
groups channels as Course, Work, and Private and persists its collapsed state and
width. Modules, My study, and Card File are not visible destinations.

#### Scenario: Desktop and mobile shell

- GIVEN the connected SPA at 1440×900
- WHEN a course member opens a channel and a thread
- THEN the sidebar, channel, and 380 px thread panel share the fixed frame without document scrolling
- AND at 375×812 the sidebar and thread become keyboard-operable overlay sheets without hiding the composer.

### Requirement: Complete live conversation behavior

A channel timeline renders day/unread separators, older-history loading,
presence/typing, pending/error/retry states, attachments, edits, tombstones,
reactions, and jump-to-latest. Drafts persist per channel/thread. The composer
supports mentions, formatting, emoji, attachments, reply/edit context, Enter to
send, and Shift+Enter for newline. REST persistence and typed WS upserts converge
without duplicate rows.

#### Scenario: Failed optimistic send recovers

- GIVEN Sofia has a draft with an attachment in an active private channel
- WHEN the connection drops as she sends
- THEN the row remains visibly failed with Retry and the draft is not lost
- AND after reconnect Retry produces one persisted message and one live row in Martin's authorized view.

### Requirement: Thread panel preserves context

Opening a message thread shows its root, replies, unread/empty state,
jump-to-latest, and a docked reply composer in the auxiliary panel. The panel is
resizable from 300–720 px on desktop, defaults to 380 px, and overlays below
600 px; closing returns focus to the source message.

#### Scenario: Reply in an empty thread

- GIVEN a channel message has no replies
- WHEN Martin opens its thread and sends a reply
- THEN the empty state becomes one reply live, the root remains visible, and a second authorized browser sees the reply without reload.

### Requirement: Messages mutate safely

Authors may edit/delete their own messages, teachers may moderate, and active
channel members may add/remove one reaction per emoji. Deleted messages are
timestamped tombstones. Attachments are channel-authorized, generated-path files
of at most 10 MiB whose downloaded bytes equal the upload.

#### Scenario: Edit, react, and delete

- GIVEN Sofia posted a message in a channel she belongs to
- WHEN she edits it, Martin reacts, and Sofia deletes it
- THEN both browsers converge through one event per mutation, the reaction is aggregated by person, and the final row is a tombstone that still anchors its thread.

### Requirement: Search and keyboard navigation

Cmd/Ctrl+K searches visible channels, people, agents, and messages and exposes
allowed actions. Shortcuts cover new channel, settings, sidebar, history,
channel find, send/newline, and overlay dismissal with focus restoration; every
action also has a visible control.

#### Scenario: Command palette respects privacy

- GIVEN Sofia is not a member of `#teachers`
- WHEN she searches from the command palette
- THEN no channel name, member, message text, or action from `#teachers` appears.

### Requirement: Inbox derives honest activity

Inbox derives unread conversations, mentions/replies, and recent messages from
the authorized live snapshot and links each item back to channel/thread context.
It does not invent metrics or learning claims.

#### Scenario: Empty inbox

- GIVEN a newly joined student has no unread or directed activity
- WHEN they open Inbox
- THEN a purposeful education-specific empty state appears with a link to browse open course channels.
