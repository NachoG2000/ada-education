## Context

See proposal.md. Existing Hono/SQLite tenancy and role rules govern access. The web has one split/overlay auxiliary surface, Tiptap drafts, and scoped REST authentication. No memory UI is mounted.

## Goals / Non-Goals

Goals: persist real authored artifacts and personal work; retain the shared channel as entry point; reuse the auxiliary panel. Non-goals: arbitrary generated executable UI, automated content ingestion, changing teacher-readable DM rules, algorithmic personalization or grading.

## Decisions

- Separate artifact tables from historical memory cards: artifacts are teacher/user authored, with immutable content revisions and optimistic version checks. Historical cards remain unchanged.
- Shared channel artifacts are teacher managed; DM artifacts are created by the DM owner. Channel read access applies to artifacts. Personal work is owner-only; explicit submission stores a snapshot visible to teachers, while later drafts remain private.
- Template schema: guide, explanation, practice, assignment; body, objectives, prompts and optional due date. Safe Markdown renderer and fixed interaction blocks rather than arbitrary generated HTML/JS.
- Channel artifacts use URL query selection in the same existing panel; closing/thread switching clears incompatible selection. Ask privately stages text plus a source artifact reference and return link in the chosen agent DM; explicit send is required. No personal attempt is copied automatically.
- REST client closures expose typed methods through the hosted context; credentials are never in URLs. Active panels refresh on focus and periodically, with pending/error states and cancellation guards. No new realtime event family is needed for this increment.
- Inbox derives eligible messages from current authorized channels: direct mentions, own DMs and replies in threads the viewer authored/participated in. Persist per-message read records on the server; opening/marking items is distinct from resolving learning tasks. Use a new explicit /inbox route to avoid the existing home-to-channel restoration rule.

## Risks / Trade-offs

- Concurrent edits → version conflicts preserve the user's draft and offer reload.
- Private source material → server authorization on reads, no automatic sharing to public channels; tutor handoff stays in a DM of the same community.
- Panel switching → explicit save controls and dirty-close confirmation for authored edits/work.
- Manual content precedes agent memory → empty states guide creation; no fabricated course content.
- Existing broad teacher DM access → preserve and disclose it; unpublished exercise work remains separately owner-only.

## Migration Plan

Additive SQLite tables with a versioned migration and matching fresh schema. Existing channels require no backfill or seed. Disable new entry points to roll back UI; do not downgrade schema or delete user artifacts.
