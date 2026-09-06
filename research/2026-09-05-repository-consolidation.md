# Public repository consolidation

Date: 2026-09-05. User-authorized repository maintenance, recorded in
`DECISIONS.md` §24. Product scope remains the hosted foundation and completed
interaction parity from §22–§23.

## Why

The user asked to consolidate the existing work and organize the public
repository before expanding the project. The working tree already contained
the completed Buzz-parity implementation and QA record. This task preserves
those changes and the retained legacy code.

Observed directly in local source/documents: root instructions contradicted
the mounted TanStack Router; PRODUCT/DESIGN still excluded mounted Agents
and Settings; the environment-file comment described a removed synthetic
demo; old web/server instructions mixed current and historical APIs. The
README emphasized fixture checks and omitted Node 24 setup. Existing checks
were available, but no GitHub workflow or common full verification command
was versioned.

## Changes

- Node 24 in `.nvmrc`, lockfile-based setup, and a local `npm start` command
  that serves the built web client through the API without a file watcher.
- `npm run check` combines lint, documentation, hosted, and legacy gates.
  `typecheck` covers all workspaces; `typecheck:web` remains a focused path.
  `check:issue1` is retained as a compatibility alias. No framework or
  dependency upgrade is part of this consolidation.
- GitHub Actions installs with `npm ci` and runs the same checks on Node 24,
  with read-only repository permissions and no provider credentials. A
  generated-route-tree check detects stale committed output.
- README, CONTRIBUTING, the current architecture guide, documentation index,
  PR template, and area instructions expose one coherent contributor path.
  Former web/server instructions are preserved under `docs/history/`.
- Product/design documents state the current contract first and label the
  earlier requirements as historical or future direction.
- The completed parity requirements are synchronized into `openspec/specs`.
  The completed change is archived at
  `openspec/changes/archive/2026-09-05-buzz-interaction-parity/`.
  The old August plan retains its unchecked tasks with an explicit status
  explanation; it is not presented as the current expansion backlog.

## External sources

All accessed on 2026-09-05, **primary, read at the original source**:

- GitHub `actions/checkout` README:
  <https://github.com/actions/checkout>. Documents the current v7 action and
  read-only contents permission. Used for the CI checkout step.
- GitHub `actions/setup-node` README:
  <https://github.com/actions/setup-node>. Documents v7, `node-version-file`,
  and npm caching. Used with `.nvmrc` and the root lockfile.
- npm `ci` reference:
  <https://docs.npmjs.com/cli/v11/commands/npm-ci/>. Documents a clean,
  lockfile-driven install and failure on package/lock mismatch. Used for
  setup and CI; no dependency ranges were re-resolved for this work.

OpenSpec 1.12.0 instructions and status were read from the cached CLI. The
parity change reports all four artifacts done and 25/25 tasks complete. Its
two deltas contain only added requirements, with no pre-existing main specs.
Synchronization preserves each purpose and every requirement/scenario under
a standard `## Requirements` heading.

## Verification

**Passed against a clean source export and then final documentation:**

- A fresh `npm ci` installed all 446 locked packages without changing the
  lockfile. The export included tracked and non-ignored uncommitted files,
  with no existing `node_modules`, runtime database, or ignored private data.
  This tests the consolidated working tree, not only the prior HEAD commit.
- `npm run check` exited 0 under Node 24.14.1: lint; 37 documentation
  contracts; protocol, server, runner and web TypeScript; hosted protocol;
  hosted REST/WS tenant/privacy/lifecycle flow; provider adapters; Vite
  production build; workspace migration/seed/access/API/WS checks; scripted
  runtime; seed; fixture end-to-end; gated flow; and both smoke paths.
- The generated route tree and `package-lock.json` remained byte-identical
  to the source export after building/checking.
- Both `npm start` and `npm run dev` were started from the clean copy with
  separate temporary databases and spare API ports. HTTP checks passed for
  health, HTML and script assets, deep-route SPA fallback, and API 404s.
  Only those spawned process groups were stopped after verification.
- CI YAML parsed successfully; triggers and the canonical check command
  were checked. Both v7 action manifests were read from their official raw
  GitHub URLs to confirm the configured inputs. GitHub-hosted execution
  remains pending until these local changes are committed and pushed.
- OpenSpec 1.12.0 strict-validated the parity change before archival and both
  current specs after synchronization. All 26 requirements and 77 scenarios
  match the source deltas. The historical change had no `.openspec.yaml`;
  its existing artifacts were preserved as supplied without inventing one.
- Current guide links resolve. `npm run check:docs` and `git diff --check`
  passed after the archive/reference updates.

**Environment notes:** sandbox DNS initially prevented dependency download,
and sandbox IPC restrictions prevented tsx from starting. The same commands
passed with the required network/local-socket access. The clean directory's
shell initially selected system Node 25, so the successful complete check
explicitly selected Node 24.14.1. The README documents `nvm use`; CI selects
Node from `.nvmrc`. No source workaround or test suppression was introduced.

Existing limitations remain visible: 21 pre-existing lint warnings, an informational Vite
chunk-size warning, no automated browser regression suite, and fake provider
binaries for contract checks. Model quality and an actual hosted GitHub
Actions run are not implied by a local suite pass. The retained Docker
deployment is outside the standard gate.
