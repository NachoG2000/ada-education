## Purpose

Teachers and course members can create and configure the conversation spaces
they are allowed to own without editing `community.json` or destroying history.

## ADDED Requirements

### Requirement: Channels persist through typed CRUD

Versioned SQLite state and typed REST/WS contracts support create, update,
member/agent assignment, archive/unarchive, browse, and delete. A channel records
Course/Work/Private group, open/private visibility, description, creator,
timestamps, members, optional work status/due date, and archived state.

#### Scenario: Teacher creates a work channel

- GIVEN Martin is the teacher
- WHEN he creates private `assignment-3` with Sofia, Ada, an active status, and a due date
- THEN it is persisted, opens immediately, appears under Work in both authorized sidebars, and remains after server restart.

### Requirement: Channel authorization is simple and explicit

Teachers create/manage Course and Work channels. Any person can create a Private
channel and manage its membership as its creator. Open channels are discoverable
to course members; private channels are visible only to active members. Archived
channels stay readable but reject new messages and membership changes.

#### Scenario: Private snapshot is filtered

- GIVEN Martin and Ada belong to a private teacher channel and Sofia does not
- WHEN Sofia fetches the gated snapshot and searches the SPA
- THEN the channel, its membership, messages, cards, threads, and attachments are absent.

### Requirement: Deletion never erases learning history

Deleting an empty channel removes it and its membership rows. Deleting a channel
referenced by any message, thread, card, module, assignment, or attachment
returns 409 with an archive recommendation; archive is the reversible path.

#### Scenario: Non-empty delete is refused

- GIVEN `#questions` contains messages
- WHEN Martin confirms Delete
- THEN the server writes nothing, the dialog explains that history prevents deletion, and Archive remains available.

### Requirement: Channel management is a complete dialog flow

Create and management surfaces expose all supported fields, searchable people
and agents, archive/unarchive, and safe delete with accessible validation,
pending controls, confirmation, inline errors, and focus restoration.

#### Scenario: Validation remains in context

- GIVEN Martin opens New channel
- WHEN he submits a blank name and an invalid work due date
- THEN both fields show accessible errors, the dialog remains open, and no channel or membership row is created.
