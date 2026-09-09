# Governed memory implementation notes

The user authorized the complete first version for all newly created courses,
deleting existing SQLite data before the demo, and preloading realistic courses
for exploration. Seeds are starting data, not completed demos or runtime answers.
This extends the original implementation contract's exclusion of seed demos.

## Sources checked directly

- Open Knowledge Format specification, version 0.2, checked 2026-09-08:
  https://raw.githubusercontent.com/GoogleCloudPlatform/open-knowledge-format/main/SPEC.md
  Markdown/YAML, relative concept paths, producer extensions and separate
  generation/review metadata informed the file representation. Format metadata
  does not implement authorization.
- YAML parser official documentation, checked 2026-09-08:
  https://eemeli.org/yaml/ . The implementation uses `parseDocument` and bounded
  alias conversion, rejects duplicate keys and retains unknown metadata.
  Installed version: 2.9.0, recorded in package-lock.json.
- Mozilla PDF.js official examples, checked 2026-09-08:
  https://mozilla.github.io/pdf.js/examples/ . The implementation uses document
  loading, per-page text extraction and explicit resource destruction; it does
  not render scripts or fetch external document resources. Installed declarations
  for 6.3.289 were checked before selecting supported options.
- Pi's pinned local exported tool factories (0.85.1), inspected in
  `node_modules/@earendil-works/pi-coding-agent`: the memory extension wraps the
  official read/write implementations and restricts each operation. It does not
  assume that setting cwd alone provides isolation.

## Implementation choices

Memory is canonical on the server's filesystem next to the configured SQLite
file. This keeps the same source/permission authority for every agent and avoids
independently editable per-agent knowledge copies. SQLite stores processing jobs
and correlated execution state; raw content and knowledge revisions stay in files.

Each Pi invocation receives a new temporary authorized view and no old wiki.
Unsupported governed adapters fail closed. Pi/Luna becomes the default for new
installations; existing provider login remains separate and reusable.

Source evidence quotes are checked mechanically, but semantic support remains a
model interpretation and a reviewable product state. Do not claim the system
can prove an inference true merely because its quote exists. Teacher review and
explicit corrections preserve this distinction.

The new memory UI extends the established Operate surface with the existing
semantic tokens, page header and responsive list/detail layout. The earlier
approved minimal UI requirements settled its task and states; no visual-world
selection or redesign was needed. Source, knowledge, operation, learner and
review sections reflect the agreed memory divisions.

Validation and any remaining limitations belong in `docs/course-memory.md` and
the task completion report. This note is not itself proof that all checks passed.

## Verification findings

Pi 0.85.1's installed `dist/modes/print-mode.js` prints only final assistant text.
A successful scoped result-file write can have empty stdout. The governed adapter
now accepts that transport outcome and delegates success to strict result-file
validation; ordinary Pi text responses continue rejecting empty output. This was
confirmed with a real Pi/Luna teacher query and a fake tool-only regression.

PDF.js 6.3.289's installed Node binary-data loader accepts filesystem paths for
standard fonts and character maps. Configure its bundled assets explicitly; the
real PDF fixture initially exposed the missing standard-font location.

The UI finish reviewer requested route-backed source/version state and a visible
source-version selector. Both were implemented alongside section persistence.
Full `npm run check` passed after the implementation changes. Live source upload
produced accepted knowledge and revision preserved earlier raw and derived data.

OKF downloads now return the canonical revision instead of reserializing its
Ada projection. A regression check verifies unknown producer metadata survives
the download, alongside the existing revision round-trip check. Server typecheck
and the memory suite passed after this final backend-only correction. The design
review closed with both navigation fixes resolved; DESIGN.md records the built
surface and the local Impeccable sidecar mirrors it.
