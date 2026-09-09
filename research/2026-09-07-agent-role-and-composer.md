# Shared agent voice and composer activity · 2026-09-07

## Request and decision

Source: user-provided course-chat excerpts in this task, 2026-09-07. The tutor
repeated generic assistant identity answers, said it could not identify its
model, and cited a role card when introducing itself. The user requested common
system guidance rather than editing one agent, and wanted thinking status to
expand the composer card instead of floating above it.

Implemented role-focused natural language with honest AI identity, explicit
configured model facts, and instructions to avoid creating/citing course cards
for role/model questions. This does not implement memory admission or delete
existing cards. Thinking/publishing now use the shared composer's normal-flow
header; channels, DMs and thread replies share this component.

## Sources checked in original documentation

- Claude CLI reference, accessed 2026-09-07:
  https://code.claude.com/docs/en/cli-reference — `--append-system-prompt`
  adds instructions while retaining the built-in prompt.
- Codex configuration reference, accessed 2026-09-07:
  https://learn.chatgpt.com/docs/config-file/config-reference —
  `developer_instructions` provides additional developer instructions.
- Pi system prompt and scoped file-tool implementation: see the original-source
  research in `research/2026-09-07-pi-runtime-evaluation.md` and pinned local
  package implementation. Existing `--system-prompt` now includes shared guidance.
- Local PromptInputHeader/InputGroup components provide ordinary in-flow header
  layout; no absolute positioning or duplicate composer is needed.

## Validation

- Full `npm run check` passed: provider instruction delivery and secret
  redaction, real Pi tool/loader checks, hosted/legacy flows, typecheck and build.
  Existing lint warnings remain.
- Fictional browser preview: idle composer height 112 px, working 161 px; draft
  survives state changes. Desktop screenshots show multiple-agent and publishing
  status inside the border. No real course messages were sent.
- Optional live-model test was rejected by automatic approval review because the
  proposed external request included conversation content. It was not executed;
  answer quality is not claimed as live-verified for this prompt change.
