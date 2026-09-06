## Context

Ada already executes real Claude CLI requests through tenant-scoped runners. See proposal.md for the requested experience. The current development command starts only web/server; user creation returns a manual enrollment command.

## Goals / Non-Goals

Keep the server responsible for identities and authorization, with model execution in a separate installation host and per-agent worker folders. This is a local automatic workflow with an explicit API-key authentication option, not a deployment or SDK migration.

## Decisions

- Reuse `claude -p` and JSON output, preserving the tested adapter. Automatic lifecycle needs a host irrespective of SDK choice.
- A high-entropy installation credential authorizes a dedicated enrollment endpoint. User and agent credentials cannot list or provision other agents. The host persists returned per-agent credentials in a private, ignored state directory; the server stores digests. Reconcile on startup/polling and rotate only missing or invalid enrollments.
- Launch workers with Node child-process IPC. A single host grants one model invocation at a time; per-agent work remains serial. Unix process groups are terminated on deletion, host shutdown, or worker exit to stop provider descendants. A local PID lock prevents duplicate hosts sharing state.
- Send current instructions with each authorized work frame. DMs address their agent implicitly; channels still require mentions. Community creation can atomically create two independent starter identities with editable copied rules.
- The mounted UI removes model/runtime/enrollment controls. Provider defaults are installation environment variables. Subscription mode strips API keys; explicit API-key mode requires the matching key and removes subscription-token overrides.

## Risks / Trade-offs

- Installation credential grants access across its communities → keep it out of browsers, model environments, logs, and version control; validate all enrollment payloads.
- Polling introduces a short startup/deletion delay → revoke deleted agent sockets immediately; reconcile every second and preserve visible offline/starting states.
- Local workspaces are policy boundaries, not OS sandboxes → hosted hard isolation remains a separate deployment concern.
- One host per state directory and in-memory work delivery → no durable offline queue or multi-host scheduling is claimed.

## Migration Plan

`npm run dev` creates installation state once and starts the host. Existing active agents are enrolled without rewriting their rules; new managed folders are bootstrapped without overwriting existing files. Older manually located wiki folders are not imported automatically. Stop automatic development and use the retained manual runner command to opt out. No schema migration is required.
