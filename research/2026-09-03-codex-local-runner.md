# Codex CLI as Ada's local subscription runner

Date: 2026-09-03

Purpose: implementation evidence for GitHub issue #1's local Codex runner path.
This records current external documentation consulted during the issue work; it
does not change the server/runner separation in `DECISIONS.md` §14.

## Verified findings

- OpenAI documents ChatGPT sign-in as the subscription-backed authentication
  path for local Codex clients, including the CLI. `codex login` opens the browser
  flow, and cached credentials are reused by later CLI invocations.
- `codex exec` is the stable non-interactive command for scripted runs. It accepts
  a prompt argument or stdin, `--cd` for the workspace root, `--add-dir` for an
  additional writable directory, `--sandbox` for the execution boundary,
  `--model` for an optional override, `--ephemeral` to avoid saving rollout
  files, and `--output-last-message` to write the final natural-language answer
  for downstream code.
- OpenAI warns against bypassing approvals and sandboxing outside an isolated
  runner. Ada's local adapter should therefore use `workspace-write`, the agent
  folder as `--cd`, and the course raw-material directory as the only
  `--add-dir`; it should not use the dangerous bypass flag.
- API-key sign-in is a separate usage-billed path. Ada's development command
  should tell a signed-out user to run `codex login`, never request or proxy the
  user's OpenAI credential.

## Sources

- OpenAI, “Authentication,” accessed 2026-09-03 and verified in the original
  page: https://developers.openai.com/codex/auth
- OpenAI, “Developer commands” (`codex exec` reference), accessed 2026-09-03 and
  verified in the original page:
  https://developers.openai.com/codex/cli/reference
- Local verification: `codex-cli 0.153.0`, `codex exec --help`, run in the Ada
  repository on 2026-09-03. The installed CLI exposes the documented `--cd`,
  `--add-dir`, `--sandbox`, `--model`, `--ephemeral`, and
  `--output-last-message` flags.
