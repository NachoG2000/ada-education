# Agent management and classroom starters

Date: 2026-09-06. Status: exploration, not an approved scope change.

## User input

In this task, the user proposed polishing agent creation, editing, and deletion, with useful classroom starter agents and the ability to create additional agents. They asked for product feedback; implementation was not requested.

## Verified repository baseline

- `openspec/specs/web-client/spec.md`, “Agents management route and dialogs,” already specifies teacher-only creation, editing, channel assignment, enrollment rotation, and deletion.
- `apps/web/src/components/workspace/agent-dialog.tsx` provides identity, instructions, runtime/model, and channel configuration; `agents-workspace.tsx` exposes editing and deletion.
- `apps/server/src/tenant.ts`, `updateTenantAgent` and `deleteTenantAgent`, retains deleted agent records and archives their DMs. This follows `DECISIONS.md` §21's history-preservation rule.
- `DECISIONS.md` §14 keeps execution in an external runner; §22 requires resources to be created through the UI. A starter definition alone cannot make an agent online.
- `PROBLEM.md` §1–§2 identifies lost shared knowledge and repeated questions as the product problem.

These are local source inspections, not runtime QA or external research.

## Suggested direction, pending user discussion

Polish the existing lifecycle end to end, including a real runner check that instruction edits affect subsequent replies and deletion stops participation while retaining history.

Offer optional editable templates through Create agent, alongside starting from scratch. Selecting a template prefills a purpose and instructions; the teacher chooses identity and channels and connects a runner. Do not automatically populate communities or imply that templates supply course knowledge or running infrastructure.

Start with two candidate roles: a course tutor that explains and guides with course context, and a knowledge curator that summarizes explicitly requested discussions and records reusable knowledge through the existing memory mechanism. A practice coach that asks questions and gives formative feedback could be a third template if its role is sufficiently distinct; grading and proactive loops remain outside current scope.

Templates should specify purpose, boundaries, use of available sources, and how to handle missing context. Changes to a template should not silently overwrite customized agents. Template names here describe roles and do not resolve the existing example-agent naming question.

## Tooling note

The `openspec` executable was unavailable on PATH during this exploration. Existing specifications were read directly; no OpenSpec change was created.

## Follow-up: automatic local execution

The user clarified that classroom agents should be ready when creating communities, use their Claude subscription, and require no per-agent manual setup, so they can test and iterate the design. They specifically mentioned Claude Agent SDK. This supersedes the earlier suggestion of requiring manual runner connection for each starter in this local development workflow.

Suggested implementation, not yet implemented: a single locally paired supervisor manages agents for the developer's authorized communities. A development startup command starts it alongside web/server. Community creation provisions the selected starter records; the supervisor enrolls and starts each agent automatically. Additional agents use the same path. Each agent retains its own community-scoped identity, credentials, workspace, and memory; provider authentication belongs to the local account. Persist local enrollment securely for restart recovery rather than relying on recovering server-side token digests. Reconcile existing agents on startup without duplicate creation or unnecessary token rotation. Updates refresh effective instructions before subsequent turns; deletion stops execution and preserves history. Begin with one concurrent model invocation across agents and visible limits/errors. This requires an explicit supervisor enrollment/control contract; the current one-agent runner token cannot grant discovery of all communities.

`packages/runner/AGENTS.md`, `src/cli.ts`, and `src/runtimes/providers.ts` confirm that current execution uses `claude -p`, not the TypeScript Agent SDK. `package.json` starts only web/server with `npm run dev`. Automatic provisioning and the SDK adapter are separate pieces of work. A future SDK adapter belongs inside the external runner, preserving §14's topology. SDK sessions must stay separated by agent and conversation; sharing provider authentication must not share memory or transcript state.

### Official sources checked 2026-09-06

- [Use the Claude Agent SDK with your Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan), original page opened. Its June 15 update explicitly pauses the announced billing change and says SDK, `claude -p`, and third-party app usage continue to draw from subscription usage limits. The older credit description below is explicitly historical. This supports exploring the user's personal local prototype, not assuming unlimited usage.
- [Agent SDK quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart), original page opened. Documents the official TypeScript package and `query()` interface, but still directs third-party products to API-key authentication and says offering claude.ai login/rate limits requires approval. The personal local experiment must not be represented as an established production subscription-auth offering; official documentation is not fully aligned on this point.
- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless), original page opened. Documents supported CLI execution and notes that bare mode skips OAuth/keychain authentication. Do not introduce bare mode into a subscription-backed adapter assuming it retains the user's login.

Before implementation, verify the installed SDK's supported local authentication path with a minimal real invocation. No model invocation, credential inspection, dependency installation, or application-code change was performed in this exploration.

## Follow-up: SDK versus CLI

The user confirmed automatic local execution for iteration and API-key or equivalent authentication for eventual deployment, but asked which integration to choose rather than requiring the SDK specifically.

Recommendation: keep the existing `claude -p` adapter for the immediate automatic-local workflow. The current adapter already uses structured JSON, tool restrictions, timeouts, and error handling (`packages/runner/src/runtimes/providers.ts`, `runClaude`). Removing per-agent enrollment work requires the supervisor regardless of SDK choice. Replacing a working adapter now does not itself improve that workflow. Revisit the TypeScript SDK when streamed tool activity, interactive permission handling, custom in-process tools, or richer session control becomes concrete scope. Both choices support programmatic agent execution; API-key deployment does not inherently require switching to the SDK. The existing adapter strips API keys deliberately, so deployed authentication will need an explicit configuration change rather than silently inheriting a key.

Source: [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview), original page verified 2026-09-06. Anthropic describes the SDK as exposing Claude Code's agent loop, tools, and context management to TypeScript/Python and documents CLI subprocess execution with `-p --output-format json` for the same loop. Its capability list covers streaming-related linked guides, hooks, permissions, tools, and sessions. The recommendation above is project-specific judgment, not a claim that the CLI lacks those capabilities or that SDK agents answer better.

## Implementation sources and verification

The user approved implementation and merging all pending work. The automatic
flow is recorded in `DECISIONS.md` §25. Additional original sources used:
[Node child process documentation](https://nodejs.org/api/child_process.html)
for IPC and detached process groups; installed `concurrently/README.md`
(version 10.0.5) for its public programmatic API and shutdown behavior;
[shadcn Base UI Select](https://ui.shadcn.com/docs/components/base/select),
[Dialog](https://ui.shadcn.com/docs/components/base/dialog), and
[Field](https://ui.shadcn.com/docs/components/base/field) for existing form
composition. All were read directly on 2026-09-06.

The real-host/fake-provider test passed for starter/custom creation,
enrollment authorization, isolated communities, DM replies without mentions,
updated rules, one concurrent model invocation, preserved credentials/files
on restart, deletion cancelling active execution, and readable history.
The complete `npm run check` passed after implementation (known lint warnings
only). Browser and live-provider verification are recorded below on completion.

Browser QA verified community starters online, template selection and custom
creation at 390×844, and the desktop form/details without provider/setup
controls. A real Claude subscription-backed DM returned a short classroom
answer. After editing the rules to start replies with READY:, the next real
reply did so without reconnecting manually. QA caught a pre-existing bug:
DM IDs were included in editable channel assignments. The projection now
excludes DMs, and replacing channel assignments preserves DM membership;
the executable test covers editing rules and assignments after a DM exists.

API-key mode is limited to the Claude adapter in this change; the retained
Codex adapter continues to use its subscription login. No deployed API-key
request was run or deployment performed.

Development startup was verified through the actual `npm run dev` launcher.
Shutdown left no host or worker processes. A group-signal race with concurrent
process-tree shutdown on macOS was handled by falling back to the tracked
child handle when group signaling returns EPERM.
