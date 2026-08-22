# Subscriptions vs. API keys, Buzz's topology, and pi.dev — 2026-08-22

Research to decide where agents run and with what credentials (see `DECISIONS.md` §14). Three parallel search passes plus direct verification of Anthropic's main source. Marked per claim: **[V]** = ✓ primary (read at the original source), **[S]** = ~ snippet or ≈ secondary.

## 1. Anthropic: what it allows with Claude Code and subscriptions

Primary source, read in full: https://code.claude.com/docs/en/legal-and-compliance (2026-08-22) **[V]**

- Section *"Can customers offer Claude Code in their products?"*: you can pre-install or run Claude Code in a product ("hosted sandboxes or other agent infrastructure") under the Commercial Terms if (a) **the binary is not modified** nor stripped of any auth method, and (b) **usage is not paid for, resold, or intermediated** on behalf of users: each user authenticates with their own API key or their own subscription, and is billed directly.
- Verbatim quote: *"Nor does it prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription, including where a platform hosts Claude Code."* → a professor can run `claude` with their subscription on their own Railway instance.
- Verbatim quote: *"Developers building products or services… including those using the Agent SDK, should use API key authentication… Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users. Moreover, developers may not collect, store, or intermediate Claude.ai credentials or session tokens."* → we never store or request subscription tokens; the hosted tier is API key only.
- *"Advertised usage limits for Pro and Max plans assume ordinary, individual usage of Claude Code and the Agent SDK."* → a course agent running on a personal plan is a rate-limit gray area, not a legality one.
- `claude setup-token` generates a long-lived OAuth token (`CLAUDE_CODE_OAUTH_TOKEN`) for headless/CI use under a subscription **[S]** (Claude Code CI docs; verify at implementation time).

Timeline of the third-party lockdown **[S]** (VentureBeat, The Register, GitHub issues): server-side block on clients impersonating Claude Code (OpenCode and others) on 2026-01-09; terms formalized 2026-02-19/20; OpenCode removed the integration on 2026-03-19.

## 2. OpenAI: Codex and ChatGPT **[S]**

- Codex CLI allows login with ChatGPT; for CI/automation they recommend an API key. No explicit prohibition was found against third-party clients using ChatGPT login; what they're going after is pooling/reselling a single subscription across multiple users ("sub2api").
- An OpenAI engineer declined to confirm ToS compliance for forked clients using ChatGPT login (GitHub Discussion #8338, 2026-02-09).
- OpenAI's primary terms pages returned 403 to automated search: **not verified at the original source**.

## 3. Buzz (Block): agent topology **[V]** in the repo's README/ARCHITECTURE

Repo: https://github.com/block/buzz (Apache-2.0). Docs: `ARCHITECTURE.md`, `crates/buzz-acp/README.md`, `crates/buzz-agent/`.

- The relay (Rust, Postgres/Redis/S3) is just bus + storage. **It does not run agents.**
- `buzz-acp` is a separate binary: "can be deployed on any system with network access to the Buzz relay." It connects over WebSocket with NIP-42 and the agent's Nostr key (`BUZZ_RELAY_URL`, `BUZZ_PRIVATE_KEY`). It spawns the runtime over stdio/ACP.
- Claude Code and Codex don't speak ACP natively: separate adapters `claude-agent-acp` (agentclientprotocol org / Zed) and `codex-acp` handle that.
- Registering Claude Code from the desktop opens Anthropic's OAuth flow in the browser; the token stays in `~/.claude/`, outside of Buzz **[S]** (dplooy.com).
- Closed laptop → dead subprocess → agent offline. **Inferred from the design, not documented.**
- "Buzz Agent" (`buzz-agent`) is a minimal in-house runtime that **does require an API key** (`ANTHROPIC_API_KEY` / OpenAI-compat / OpenRouter / Databricks) **[V]**. Blog posts claiming "no API key needed" are confusing it with the Claude Code flow.

## 4. pi.dev **[V]** repo README and docs

Repo: https://github.com/earendil-works/pi (formerly badlogic/pi-mono), MIT. Package `@earendil-works/pi-coding-agent`.

- CLI + SDK. Modes: interactive, `-p` (print), `--mode json`, `--mode rpc` (JSON over stdin/stdout), embeddable SDK. Runs on headless Linux.
- 15+ providers: Anthropic, OpenAI, Google, Bedrock, Mistral, Groq, xAI, OpenRouter, **Ollama** (local open models), etc.
- Reads `AGENTS.md`/`CLAUDE.md`, has skills and `read/write/edit/bash` tools. **No native MCP or ACP** (community adapter `pi-acp`). **No permission system**: they recommend a container.
- OAuth login with a subscription (Claude Pro/Max, ChatGPT) exists in pi, but for Claude it's exactly what's prohibited in §1: since roughly April 2026 the API responds "Third-party apps now draw from your extra usage, not your plan limits" (issue #3372), and there's revocation risk (discussion #1999).

## 5. Conclusion (what changes the plan)

1. Server and runner are separate processes; the server never calls models directly.
2. A subscription is only valid when running the provider's unmodified binary, logged in as the user, wherever the user runs it (their laptop or their own Railway instance).
3. Our hosted tier = API keys (BYO or ours with margin). Open models via pi/Ollama/OpenRouter have no terms-of-service issue.
4. pi is the multi-provider harness for the API-key tier, not a path to subscriptions.
