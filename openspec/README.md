# Specifications and change history

## Current requirements

- [Web client](specs/web-client/spec.md): routed workspace, task containers,
  account lifecycle, teacher/student behavior, and paused card surfaces.
- [Community server](specs/community-server/spec.md): profile updates,
  membership roles, safe invite management, and credential boundaries.

These requirements come from the completed Buzz interaction parity work
(`DECISIONS.md` §23). They cover that change's behavior, not an exhaustive
specification of every existing tenant, runner, or fixture capability.
[The architecture guide](../docs/architecture.md) maps the full implementation.

## Implementation plans

[buzz-interaction-parity](changes/archive/2026-09-05-buzz-interaction-parity/proposal.md)
is archived with 25 completed tasks and recorded teacher/student responsive
QA. Its requirements are synchronized into the current specs above. The
[design](changes/archive/2026-09-05-buzz-interaction-parity/design.md) and
[task checklist](changes/archive/2026-09-05-buzz-interaction-parity/tasks.md)
remain available. See `DECISIONS.md` §24 and
[the consolidation record](../research/2026-09-05-repository-consolidation.md).

[demo-local-backend](changes/demo-local-backend/proposal.md) is the historical
August plan. Its [task list](changes/demo-local-backend/tasks.md) still has
unchecked work, including an old multi-provider and demo scope. Later
decisions superseded that plan; it is not the current expansion backlog.
The checklist remains unaltered rather than claiming everything was built.

## Starting a capability

Use the OpenSpec CLI with this repository as the working directory. The
validated CLI for this baseline is `@fission-ai/openspec@1.12.0`; it is an
optional planning tool, not a runtime or CI dependency.

```bash
npx --yes @fission-ai/openspec@1.12.0 list --json
npx --yes @fission-ai/openspec@1.12.0 new change <name>
npx --yes @fission-ai/openspec@1.12.0 status --change <name> --json
```

Read the CLI's instructions for the proposal, specifications, design, and
tasks before writing them. Specify externally observable behavior, sources
of authority, and validation. Implement only the approved scope. After
verification, sync the delta requirements and archive the completed change.
Small documentation fixes do not need a new product-capability proposal.

Course-memory design is a proposed next capability, not an active approved
implementation plan. Consolidation does not restore paused card UI or
authorize personal-memory sharing, hosted runners, or proactivity.

## Automatic agents (2026-09-06)

The agent-creation flow is updated by `specs/automatic-agent-host/spec.md`
and the Agents requirement in `specs/web-client/spec.md`. Its completed
change is `changes/archive/2026-09-06-automatic-agents/`; see `DECISIONS.md`
§25 and `docs/agent-host.md` for the current startup experience.
