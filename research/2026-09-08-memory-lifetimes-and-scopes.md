# Memory alternatives: lifetime, evidence and audience

Date: 2026-09-08. Status: exploration, not an approved implementation decision.
No application code or existing architecture decision was changed.

## User-provided sources

Read both supplied texts in full. Attribution to Sentra's CEO comes from the
user and the first essay's author statement; author identity, publication date,
public URLs and product internals were not independently verified.

1. **The Instinct Thesis: Why Memory Is Becoming the Moat**.
   Original: `/Users/ignaciogarcia/.codex/attachments/8a8b65d3-1943-4ab5-89f6-056aedf2d8dd/pasted-text.txt`.
   The author explicitly describes a hypothesis about Instinct, without internal
   knowledge. Main ideas: selective admission based on future usefulness;
   distinguish admission from permission to act; admitted event history, evolving
   beliefs and unresolved commitments; provenance and retirement of obsolete
   derivatives; proactivity requires observation and action policy as well as
   memory. Its proposed ephemeral ingestion discards much raw input after digestion.
2. **Memory Is Not Storage**.
   Original: `/Users/ignaciogarcia/.codex/attachments/fe372e37-5d3d-45e9-9212-7a0b94a0cff1/pasted-text.txt`.
   Main ideas: construct task- and actor-specific active state; distinguish facts,
   inferences and commitments; make authority, purpose, staleness and contradiction
   explicit; preserve source evidence and propagate invalidation; evaluate against
   simpler retrieval/long-context baselines with the reasoning model held fixed.
   The smaller-model efficiency claim is explicitly a hypothesis, not a result.

The texts agree on selective, revisable state, but differ materially on raw
retention: transient ingestion in the first versus append-only evidence in the
second. Neither establishes a universal retention policy for Ada. Conserving
course materials is separate from repeatedly placing all their content in model
context. Append-only versions do not override authorized deletion requirements.

## Current grounding

- `DECISIONS.md` §6 already distinguishes raw, immediate and compiled wiki memory,
  source citations and supersession. These are processing layers, not the same
  dimension as durable knowledge versus current operations.
- `packages/runner/src/cli.ts` currently bootstraps one wiki per agent, reads
  supplied material context and publishes changed markdown. A shared course
  knowledge store and person-scoped views are proposals, not current guarantees.
- `research/2026-09-01-strategy-scoped-agents-group-brain.md` explored shared and
  personal scopes and cross-cohort inheritance; it is not an implementation spec.
- Current DMs remain readable by teachers. A folder named private cannot change
  application authorization or prevent a shared agent workspace leaking context.
- OpenSpec CLI was unavailable on PATH and no local executable was present;
  existing `openspec/config.yaml` was read. No change was scaffolded.

## Separate dimensions

1. Origin: uploaded course source, external reference, course message, explicit
   user statement, existing system of record. Origin does not grant authority.
2. Audience: community, channel, teaching staff, individual. Enforce this before
   retrieval/context construction and on derived records, not only in a prompt.
3. Lifetime: durable until revised; valid for a date interval; unresolved until
   completed/cancelled; expired but optionally retained as historical evidence.
4. Epistemic status: direct evidence, candidate inference, confirmed decision,
   disputed assertion. Repeated claims do not automatically become facts.
5. Subject: concept, person, assignment, event, question. An entity can have both
   durable attributes and temporary relationships or observations.

Internal/external is useful provenance but inadequate as the root partition:
external sources may be authoritative teaching references; internal comments
may be tentative. Person data also changes (role, enrollment, availability).

## Three alternatives

A. **Lifecycle-first files**: sources/, knowledge/, state/. Clear and fast for a
small prototype, but audience controls must be explicit on each item. Person
records and private notes must not be mixed into broadly readable folders.

B. **Entity-first files**: concepts/, people/, assignments/, events/, each with
related evidence and current state. Good for linked questions and timelines,
but temporal and permission rules remain necessary; entity pages can become
unbounded collections of unrelated facts. No graph database is implied.

C. **Audience-first hybrid (recommended starting hypothesis)**: authorized scopes
contain knowledge and operational state; entity IDs link related items across
views. Markdown holds coherent explanatory cards, SQLite owns mutable event/task
status and provenance metadata; file exports of that state are projections,
not independently writable competing authorities. Source originals remain
versioned artifacts with access rules and references to exact locations.
This builds on the existing server/runner topology; implementing it requires
explicit scoped retrieval and write ownership beyond today's per-agent wiki.

Conceptual export tree, not a migration plan or filesystem security boundary:

```text
community/<id>/
  sources/<source-id>/<version>/original + extracted sections
  shared/
    knowledge/concepts/<id>.md
    knowledge/questions/<id>.md
    knowledge/decisions/<id>.md
    state/events/<id>.md
    state/open-questions/<id>.md
    state/commitments/<id>.md
  channels/<channel-id>/knowledge/ + state/
  staff/knowledge/ + state/
  learners/<user-id>/profile.md + state/
```

The source repository is access-controlled, not implicitly shared because its
path is common. Staff and personal areas represent candidate policy scopes;
no new teacher/learner visibility policy is adopted here. Enrollment/roles and
other existing relational facts should be referenced, not copied into a second
mutable memory record. Agent runtime workspaces are consumers of scoped views,
not necessarily the owners of every course fact.

## Atomicity and lifecycle

Preserve originals and compile semantic units rather than replacing originals
with isolated fragments. A coherent concept/example/correction is a useful
unit; one sentence per file can destroy assumptions, equations and dependencies.
Each derived unit links source ID, version and page/section/message, with stable
entity ID, audience, status, relevant effective dates and supersession links.
Record when the system learned something separately from when it is valid.

Example: 'The recursion workshop is Friday; nobody understands the base case.'
Split an authorized event announcement into dated operational state; treat the
claim about understanding as an unverified observation, not a group diagnosis;
a later verified explanation of base cases can become a durable concept card.
An individual question first remains an open learning interaction; a reusable
question angle may be linked to a concept later, without preserving the person's
identity in shared knowledge. Promotion across audiences is a separate decision;
removing a name alone is not proof of anonymization.

Ingestion proposal: identify changes -> resolve entity/source/audience -> compare
existing records -> ignore, update temporary state, or propose durable knowledge
-> validate under type-specific authority rules -> publish current view with
provenance. A more recent lower-authority comment must not silently override an
authorized policy. Conflicts can remain explicit until resolved.

Temporal state is still persistent and consolidated: it has a current value,
completion/cancellation/expiry and optional history. It should leave active
context when resolved, not automatically vanish from evidence. Recording a
reminder does not authorize notifications, calendar actions or agent proactivity.

Suggested evaluation/demo cases: a concept explanation reused with citations;
a moved deadline without the old date resurfacing; a resolved open question;
a revised source invalidating dependent cards; an expired event excluded from
next-week results; teacher/student audience filtering. Use the same model for
baseline and memory variants. Start with one course, not the full directory tree.
