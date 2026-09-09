# Memory v1 implementation contract — awaiting two policy choices

Date: 2026-09-08. User authorized implementation of the first memory version,
with the demo explicitly following it. This document makes scope and acceptance
criteria concrete; it is not evidence that implementation has been completed.

## Confirmed requirements

Filesystem originals and filesystem-derived OKF 0.2 knowledge are canonical.
SQLite continues to own application records and disposable projections/indices.
Memory units are composable and independently sourced. Operational records have
explicit lifetimes. Authenticated role affects type-specific authority. Teachers
can inspect learners within their course; students only themselves. A shared
channel must not expose learner-specific records, even on a teacher request.
Authorization occurs before model context or accessible files are constructed.

## Two unresolved choices presented to the user

1. Whether model-generated shared knowledge requires teacher review before
   becoming active, or can become active automatically with subsequent review.
   Proposed initial policy: drafts require teacher confirmation.
2. Whether learner evolution includes inferred observations or only explicit
   teacher observations and student-reported questions. Proposed initial policy:
   explicit records only; no inferred mastery, diagnoses or grading.

Elapsed time or preselected answers do not resolve these choices. They change
write admission, UI states and tests; do not silently choose on the user's behalf.

## Concrete first-version scope

1. **Source repository.** Tenant-scoped, versioned raw files and stable source
   identifiers. Store uploader identity, original name, media type, digest,
   timestamp and visibility. A new source version preserves the old evidence
   and identifies dependent units for review. Initial ingestion must have an
   explicit supported-format contract and reject unsupported formats clearly.
   Original files are not silently deleted after derivation.
2. **OKF representation.** Markdown/YAML concepts with stable bundle paths,
   standard sources/generated/verified/status/stale_after fields where applicable,
   and namespaced Ada metadata for audience, subject, effective dates and versions.
   Ordinary links support composition; no graph database is required. Original
   evidence, revisions and current selection are distinct. Unknown OKF fields
   survive round trips; YAML is parsed by a maintained parser, not handwritten
   frontmatter regular expressions.
3. **Authorization and matrix.** Server-resolved actor, agent assignment and
   destination audience constrain the read view and permissible outputs. A
   learner scope accepts its owner and course teachers in suitable private
   contexts. Source-derived permissions cannot be widened by model metadata.
   Source access revocation invalidates derivatives and cached views. A denied
   item's text, title, path and index entry do not reach the model.
4. **Governed writes.** Models propose content; trusted application code assigns
   actor, scope and review metadata. Models cannot self-assert teacher identity,
   human verification or a broader audience. Concurrent edits use revision
   checks; corrections retain history and replace active versions. Operational
   transitions include resolution, cancellation and expiry without notifications.
5. **Runner integration.** Build an invocation-specific authorized view, retain
   only scoped read tools, collect proposed writes separately, and admit them
   through server validation. All tool paths must be constrained, not just cwd.
   A runtime without enforceable scoped reads must fail closed for governed
   memory, rather than silently run with a complete corpus. Decide supported
   runtime behavior explicitly in implementation and document limitations.
6. **Minimal usable surfaces.** Source ingestion, readable knowledge with source
   links, applicable confirmation/correction controls, and learner-record access
   for teachers/self. Reuse the existing auxiliary panel and educational UI.
   No separate visual redesign, benchmark dashboard, seed demo or proactive agent.
7. **Compatibility.** Preserve existing wikis and published cards as legacy
   data. No automatic promotion into shared memory: their previous conversations
   may have different audiences, and reliable scope cannot be inferred from a
   filename. Provide an explicit reviewed import path. Avoid two independently
   editable authoritative copies between SQLite and files.

## Initial permission matrix for review

| Unit | Who may propose | Confirmation | Read audience | Lifecycle |
|---|---|---|---|---|
| Concept/example | Authorized teacher, learner contribution or agent | Pending choice 1 | Scope permitted by source evidence | Revised/superseded |
| Course decision | Authorized course teacher; others may submit a suggestion | Teacher authority, never quoted role text | Explicit channel/course scope | Effective dates and supersession |
| Event/commitment | Authorized actor for that event or own commitment | Type-specific authority | Explicit scope | Active/resolved/cancelled/expired |
| Open learner question | Learner's own statement or attributed teacher record | Preserve attribution; not a diagnosis | Learner and course teachers | Open/resolved |
| Learner observation | Teacher within course; learner self-report | Pending choice 2 for model inferences | Learner and course teachers | Dated, correctable evidence |

## Acceptance tests

- A source's bytes survive ingest and a new version does not overwrite them.
- Two examples link to one concept; correcting one does not delete the other.
- Generated knowledge has honest producer/reviewer identity under the selected
  admission policy. A forged teacher claim cannot confirm a decision.
- Students cannot read another learner through REST, runner files, indices,
  source links, cached contexts or derived entries; cross-course access fails.
- A teacher request in a shared channel does not load a learner record.
- A teacher-private request can load authorized learner records; student-private
  requests can load only self records.
- A revision, expired event or revoked source cannot keep appearing as current.
- A model cannot widen scope, write outside its output area or read the old
  unrestricted wiki through links, traversal, alternate tools or inherited state.
- Failed writes/restarts preserve canonical versions and recover projections.
- Provider checks remain credential-free; live course messages are not test data.

## Inspection evidence

`packages/runner/src/cli.ts` currently reuses a single cwd/wiki across work,
assembles material excerpts from the shared raw directory, and publishes changed
cards. `apps/server/src/ws.ts` provides authenticated author and channel context,
but the work contract currently has no authorized memory view. These are the
integration points and the reason renaming directories alone cannot deliver ACLs.

Official specification checked directly on 2026-09-08:
https://raw.githubusercontent.com/GoogleCloudPlatform/open-knowledge-format/main/SPEC.md
Version 0.2: standard metadata distinguishes generation, verification and
lifecycle. Trust tiers are advisory, not access control. Ada must enforce its
own authorization and admission policy independently of format conformance.

## Policy resolution and trajectory clarification (2026-09-08)

Supersedes the pending choices above: the user selected automatic admission
when a trustworthy source supports the knowledge, and teacher review otherwise.
Learner inferences are included, labeled as such with supporting evidence.
The user further requires a dated trajectory of doubts and successes, preserved
alongside a derived current view; consolidation must not flatten progress into
one mutable learner label. See `DECISIONS.md` §33. Add acceptance cases for a
module-1 doubt resolved by module-2 evidence, a new distinct difficulty, and
historical queries that still show the original doubt. Advancing modules without
evidence must not mark a concept understood. Correcting an erroneous record is
distinct from observing genuine progress.
