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
  a prompt argument or stdin, `--cd` for the workspace root, `--sandbox` for the
  execution boundary, `--model` for an optional override, `--ephemeral` to avoid
  saving rollout files, and `--output-last-message` to write the final
  natural-language answer for downstream code.
- The Ada runner uses the agent workspace as `--cd` with `workspace-write`. It
  does not use `--add-dir`: the runner workspace is already writable and Ada
  sends only bounded, read-only excerpts of recent channel context in the
  prompt. This avoids granting the provider a second broad writable root while
  preserving the agent's normal workspace behavior. It does not use the
  dangerous bypass flag.
- API-key sign-in is a separate usage-billed path. Ada's development command
  should tell a signed-out user to run `codex login`, never request or proxy the
  user's OpenAI credential.
- The runner strips provider API-key environment variables from the child
  process, while preserving the CLI's own subscription login/configuration. The
  server and Ada protocol never receive those credentials.

## Sources

- OpenAI, “Authentication,” accessed 2026-09-03 and verified in the original
  page: https://developers.openai.com/codex/auth
- OpenAI, “Developer commands” (`codex exec` reference), accessed 2026-09-03 and
  verified in the original page:
  https://developers.openai.com/codex/cli/reference
- Local verification: `codex-cli 0.153.0`, `codex exec --help`, run in the Ada
  repository on 2026-09-03. The installed CLI exposes the documented `--cd`,
  `--sandbox`, `--model`, `--ephemeral`, and `--output-last-message` flags. The
  implementation intentionally uses the subset above and omits `--add-dir`.
- Anthropic, “Set up Claude Code” and “CLI usage,” accessed 2026-09-03 and
  verified in the original pages: the unmodified `claude -p` CLI supports
  non-interactive prompts and its own subscription login flow. Sources:
  https://docs.anthropic.com/en/docs/claude-code/getting-started and
  https://docs.anthropic.com/en/docs/claude-code/cli-usage
