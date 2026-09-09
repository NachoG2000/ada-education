# Documentation

## Current implementation

- [Architecture](architecture.md): mounted entry points, authentication,
  persistence, message delivery, and runner boundaries.
- [Contributing](../CONTRIBUTING.md): setup, checks, and change workflow.
- [Repository rules](../AGENTS.md): scope, authority, and area instructions.
- [Specifications](../openspec/README.md): current interaction contracts and
  implementation history.

## Product direction

[PROBLEM.md](../PROBLEM.md) explains the problem;
[DECISIONS.md](../DECISIONS.md) records decisions and their supersessions.
[PRODUCT.md](../PRODUCT.md) and [DESIGN.md](../DESIGN.md) distinguish the
current workspace from the paused card-file and expanded course concepts.

The self-contained HTML pages below are **future direction**, not current
setup instructions or API references. Open them directly in a browser:

- [How it works](how-it-works.html): expanded server/runner/memory model.
- [Use cases and API](usecases-api.html): expanded course workflows.

## Historical implementation

- [August web client](history/web-client-2026-08.md): retained hash/fixture
  client, Modules, My study, and old account flow.
- [August server API](history/server-fixture-api-2026-08.md): retained
  singleton routes, seed imports, modules, reports, and membership gating.
- [Deployment history](../deploy/README.md): earlier single-course Railway
  setup; not the runbook for the current hosted domain.
- [Research index](../research/README.md): sources and implementation evidence.

- [Automatic agent host](agent-host.md): local startup, shared authentication,
  lifecycle, and recovery.

## Interface system

[Current design system](../DESIGN.md) specifies tokens, sizing, shared page components, responsive behavior, and identity-aware mentions. Open `/#design-system` on the local web app for live examples. [Earlier Card File design](history/design-system-2026-09-05.md) is preserved as history.

- [Educational artifacts](educational-artifacts.md): current channel templates,
  personal work/submissions, contextual tutoring, Inbox, and implementation limits.

## Course memory and exploration

- [Course memory](course-memory.md): canonical files, admission, permissions,
  Pi execution, supported source formats and validation.
- [Exploration courses](memory-exploration.md): local seed/reset setup and the
  cases available for jointly designing the demo.
