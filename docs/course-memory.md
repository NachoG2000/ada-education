# Course memory

This guide describes the governed course-memory implementation introduced in
September 2026. It supersedes the shared runner-wiki behavior for hosted work.

## Ownership and files

SQLite still stores accounts, memberships, channels and messages. The new
`memory_jobs` table stores processing state and execution references, not a
second editable knowledge corpus. A source upload is acknowledged after its
original bytes, extracted text and provenance are durably written.

For a database at `apps/server/data/ada.db`, canonical memory lives next to it:

```text
apps/server/data/ada.db.memory/<community-id>/
  catalog.json                       # atomic committed revision pointers
  references/<source-id>/v1/
    raw                              # original bytes, unchanged
    text.txt                         # extraction used by the compiler
    source.json                      # identity, role, scope, digest, date
  references/<source-id>/v2/...
  history/<record-id>/1.md            # OKF 0.2 knowledge revision
  history/<record-id>/2.md
```

The server is the single writer. Each mutation writes new files, fsyncs them,
then atomically replaces the catalog. A crash before that replacement can leave
unreferenced files; these are not readable as committed history. SQLite's write
lock serializes writers. Reopening reads the catalog and canonical revisions;
there is no body projection to repair. The optional in-memory database used by
checks gets a separate temporary memory directory.

OKF frontmatter carries `type`, `title`, `sources`, `generated`, `verified`,
`status`, optional `stale_after`, and namespaced `x-ada` domain metadata.
Record IDs link revisions; `path` identifies the concrete immutable OKF concept.
Unknown frontmatter keys survive revisions. Model proposals cannot assign
verification or provenance metadata. Downloaded individual knowledge files use
OKF; their referenced originals remain available through authorized source
downloads. A whole-bundle distribution UI is not provided.

## Admission and evolution

Official course material and direct authenticated teacher statements can support
automatic admission. Learner contributions, uncertain interpretations and
conflicting replacements enter teacher review. Evidence quotes must actually
occur in the cited source version. This is a provenance check, not a proof that
the interpretation is semantically correct; teachers can inspect and correct it.

Ada can derive learner inferences. These remain explicitly identified as
interpretations, never as grades or permanent mastery labels. The same learner
can have a module-1 question, module-2 evidence of understanding, and a different
module-3 question. `resolves` updates current selection without deleting the old
question. `corrects` records an erroneous interpretation; `supersedes` records
an explicit replacement. Corrections and replacements require review.

Events and commitments can be upcoming, current or expired. Their historical
records remain available. Editing a message or source invalidates evidence
derived from its previous contents; revoking a source removes its derivatives
from retrieval. A previously resolved question becomes current again if its
resolving evidence is invalidated or its resolving interpretation is corrected. Teacher review preserves previous revisions.

## Read and write boundaries

The effective audience is the intersection of the active requester, the agent's
assignments and the response destination. Every source and derived record is
checked before retrieval. Course teachers can inspect learner trajectories;
learners can inspect only themselves. Shared-channel runs never load personal
learner trajectories, even when a teacher asks. Channel material stays within
that channel's membership boundary. Open/discoverable does not mean readable.

An assigned Ada may record the sender's own question privately from shared
participation. This write does not give the shared response access to that
learner's private history. Derived records retain source restrictions; a private
conversation cannot automatically become shared course knowledge.

Permissions, source versions and supplied record state are checked again when
a result returns. Stale or unauthorized results cannot publish a response.
Runner credentials cannot bypass the pipeline through old direct card or message
publication frames. A correlated run ID binds output to its authenticated agent.

## Runtime and processing

Pi is the default installation runtime with the configured `gpt-5.6-luna` model.
Its ChatGPT login remains Pi's responsibility; Ada never stores those provider
credentials. `npm run dev` and `npm run dev:pi` use this setup. Explicitly selecting
Claude or Codex still supports retained adapters, but governed memory fails closed
for those adapters because equivalent scoped reads have not been implemented.

For each run the runner creates a new temporary directory containing only the
authorized JSON view. Pi loads a dedicated extension wrapping its official file
tools: read `memory/*.json`, write `result.json`. Built-in tools, discovered
extensions, context files, sessions, skills and prompt templates are disabled.
Traversal, symlinks, hard links, special files and legacy wikis are inaccessible
through these tools. This is a tool boundary, not an operating-system sandbox
against a compromised runner installation. The directory is removed on success
and handled failure; a process killed before cleanup can leave temporary files
on the installation machine, outside every subsequent model's view.

New communities initialize memory and always receive primary Ada. The optional
starter flag controls the additional curator. Human messages in Ada-assigned
channels are consolidated silently; mentions and private requests also produce
replies. Uploads queue source compilation. Jobs persist across disconnects and
use new run IDs when reclaimed. Failed processing is visible and retryable from
the memory review surface. Source details show queued/running work and retryable failures; the originating conversation also exposes failed-response retries to its requester or a teacher. No proactive messages or notifications are sent.

## Interface and formats

Course memory has Knowledge, Course activity, Learners/My learning, Sources and
teacher Review sections. Readers can follow evidence, download originals, include
history and inspect revisions. Record, source, source-version and section selection are route-backed; a source-version selector makes earlier originals discoverable. Answer citations open the corresponding record. Teachers can upload sources, add revisions,
revoke access and confirm or reject interpretations with a reason. The interface
retains the existing sidebar, page header, semantic tokens and responsive list/detail
pattern; it does not restore the retired card interface.

Uploads support PDF with selectable text, Markdown and UTF-8 text: at most 10 MB,
100 PDF pages and 120,000 extracted characters per source. PDF extraction uses
Mozilla PDF.js and does not execute document scripts. Scanned PDFs need a text
version; OCR is not included. Large documents must be split at meaningful boundaries.

Existing agent wikis are retained outside governed views. Teachers can upload a
wiki file with the legacy-import option after choosing its audience. Its original
bytes remain available and its derived contributions require teacher review.
There is no automatic promotion of existing unscoped knowledge.

## Validation

`check:memory` in the server covers canonical bytes and revisions, OKF round trips,
source/record ACLs, role forgery, evolving questions, invalidation, temporal state,
teacher review, idempotent completion, stale execution rejection and recovery.
The runner check covers scoped tool paths, link attacks, view cleanup and
unsupported providers. Automatic-agent integration runs the real server, host,
worker and protocol with a fake Pi binary. Exploration checks validate the two
preloaded courses and real follow-up retrieval without provider credentials.

## Verified implementation, 2026-09-08

The complete `npm run check` gate passed: lint (existing warnings only), docs,
all workspace types, hosted REST/WS, provider adapters, automatic workers, web
build, educational features, governed memory and retained legacy checks. A real
one-page PDF fixture verifies PDF.js extraction and exact-byte multipart download.
The two new privacy regressions cover shared course compilation and corrected
resolving inferences. A tool-only Pi completion is accepted only after validating
its required `result.json`; empty ordinary text responses still fail.

Live Pi/Luna validation in the synthetic course produced a teacher-private answer
composing Alex's earlier question, later explanation and next open question, with
working record citations and an explicit inference limit. Uploading new official
material produced an automatically accepted atomic concept; revising it retained
the original and invalidated its earlier derived evidence. These observations are
implementation checks, not a guarantee of semantic correctness on every source.

A final export correction serves the canonical OKF bytes, preserving unknown
producer extensions. The server typecheck and memory suite passed again after
that correction. Source-version reload, Back/Forward and desktop/mobile views
were checked in the live browser; the finish reviewer marked both requested
navigation fixes resolved.
