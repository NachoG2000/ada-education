# Educational artifacts and contextual tutoring

Current implementation, 2026-09-07. See DECISIONS.md §27 and the
`educational-artifacts` OpenSpec change. This extends channels without replacing
them with a separate learning-management dashboard.

## Teacher workflow

Open a joined channel, then **Artifacts** beside its member avatars. Create a
**Module guide**, **Explanation**, **Practice**, or **Assignment**. Each template
uses the same title, summary, Markdown, objectives and optional question blocks.
Practice and assignments require at least one question; assignments can include
a due date. A channel's first guide remains discoverable above its conversation.
All artifacts remain available in the header collection.

Editing publishes a new version. Earlier content remains readable through the
version selector. Concurrent saves reject stale versions; unpublished edits are
kept in session storage, scoped to user, community and artifact. Review the latest
published content before replacing it with an older draft. Deletion removes the
artifact from normal access while retaining its database history. Archived
channels remain readable and reject mutations.

## Student workflow

Open an artifact in the existing right context panel. The panel replaces thread
or member details. Back returns to the collection; Close returns to the
conversation. On narrow workspaces it overlays the conversation, whose controls
are inert while covered. Artifact selection is stored in the channel route's
`artifact` search parameter and survives reload/history navigation.

Write answers and choose **Save privately**. Neither peers nor teachers can read
these personal drafts through the work API. **Submit to teacher** explicitly
shares a snapshot, after confirmation; later draft changes do not modify it.
Teachers review submitted snapshots with the original version's questions and
write feedback. There are no automatic grades, completion scores or mastery
inferences. Due dates are informational, not a late-submission lock.

**Ask privately** opens an agent picker and editable question. Continue creates
or reuses that agent's DM and stages a draft; it never sends a message. A prompt
consultation includes that question. A whole-material consultation includes up
to 12,000 characters of its body and discloses truncation. Existing DM drafts
are preserved, with **Insert context** when needed. The contextual banner offers
**Open material** and **Return to module**, and may be dismissed. Sending clears
the staged text while retaining the source shortcut. Desktop opens the material
beside the DM; narrow screens prioritize the draft.

DM artifacts belong to the DM owner and remain teacher-readable, just like the
conversation. DM headers and private-consultation dialogs disclose this. The
word private means not shared with the class; it does not silently change the
existing teacher access policy. Personal work uses a stricter owner-only API.

## Inbox

`/c/:communityId/inbox` is a distinct primary page. Incomplete community/root
routes still restore the last channel. Inbox includes incoming own DMs, explicit
mentions, and replies after participation in a thread. It excludes own messages,
deleted messages, unrelated threads and teacher-readable student DMs. Its
read/unread state is per user and independent of channel read state. Opening an
item marks it read; mark unread is explicit. Desktop uses list/detail; mobile
shows one surface with a Back control. Open conversation navigates to the source
channel/thread and message anchor.

## Implementation boundary

- `packages/protocol/src/education.ts`: shared schemas.
- `apps/server/src/education.ts`: authorized artifact, work, submission and Inbox
  read endpoints registered by the hosted API.
- Migration 7 adds educational artifacts, immutable content versions, personal
  work, submission snapshots and Inbox read records. These are separate from
  legacy agent-memory cards.
- `apps/web/src/lib/education-api.ts`: authenticated, schema-validated client.
- `components/workspace/artifacts.tsx`: templates, collection/detail, work and
  contextual assistance. `artifact-markdown.tsx` uses react-markdown + remark-gfm,
  skips raw HTML, retains safe URL handling and does not fetch remote images.
- `components/workspace/inbox.tsx` and `lib/inbox-activity.ts`: attention feed.
- Authorized REST queries refresh after local mutations, on window focus and
  every 15 seconds while visible. Other viewers' updates are not instantaneous.
- Unpublished artifact/work drafts are retained in this browser tab, not synced
  across devices. Saved content and submissions are persisted in SQLite.

The initial templates are intentionally fixed, with flexible Markdown and
questions. There is no generated executable UI, automatic artifact generation,
agentic memory, semantic search, course-wide roadmap editor, proactive messaging,
notification delivery, or automatic submission-feedback Inbox event. Agents
receive only the context explicitly sent through the tutor draft.

## Validation

`npm run check:education -w @ada/server` exercises real REST authorization,
versions/conflicts, private work, submission copies, feedback, DM ownership,
archival/deletion and read-state isolation; it also checks Inbox eligibility.
It is part of the complete `npm run check` gate. Browser QA uses a separate
SQLite database and origin, without modifying the user's course.
