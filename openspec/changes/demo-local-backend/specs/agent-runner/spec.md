## Purpose

`ada-runner`: the process that makes an agent exist. It connects to the server with the agent's token, executes an AI runtime with `cwd` in the agent's folder, and translates what the runtime does (text, citations, new files in the wiki) into community messages and cards. It runs where the credentials live: the laptop today, a teacher's Railway or our hosting tomorrow.

## ADDED Requirements

### Requirement: Command-line invocation
The runner SHALL run as `ada-runner --server <url> --token <token> --cwd <agent-folder> [--runtime claude|codex|pi] [--model <id>]`. `--runtime` SHALL default to `claude`. Every flag SHALL also be settable via variables `ADA_SERVER`, `ADA_TOKEN`, `ADA_AGENT_DIR`, `ADA_RUNTIME`, `ADA_MODEL`. The runner MUST NOT ask for, read or store AI-provider credentials: the runtime resolves them on its own (`claude` or `codex` login, or the env vars `pi` expects).

#### Scenario: normal startup
- **WHEN** `ada-runner --server ws://localhost:8787 --token X --cwd data/neural-networks-2026/agents/ada` runs
- **THEN** the runner verifies `--cwd` exists and has `wiki/`, connects to `/ws/runner`, and logs "ada · online · runtime claude"

#### Scenario: runtime not installed
- **WHEN** the chosen runtime's binary isn't on `PATH`
- **THEN** the runner exits with a message saying which binary is missing and how to install it, without connecting to the server

### Requirement: Runtime interface
The runner SHALL define a `Runtime` interface with `detect(): Promise<boolean>` and `run({ prompt, cwd, model? }): Promise<{ text: string; usage?: unknown }>`. It SHALL implement `claude` (spawn of `claude -p <prompt> --output-format json` with non-interactive permissions restricted to read/write inside `cwd` and `git`). `codex` and `pi` SHALL exist as adapters with the same interface (`codex exec`, `pi -p`), even though only `claude` is tested in the demo. Adding a runtime MUST NOT require touching the server or the client.

#### Scenario: claude runtime
- **WHEN** a mention arrives and the runtime is `claude`
- **THEN** the runner executes the unmodified `claude` binary, with `cwd` in the agent's folder, and takes the final text of the JSON output as the answer

### Requirement: Presence
On connect, the runner SHALL send `presence: "online"` along with `{ runtime, model }`. While executing a mention it SHALL send `thinking`; while publishing cards, `publishing`; when done, `online`.

#### Scenario: a mention's cycle
- **WHEN** the runner processes a mention
- **THEN** the agent goes through `thinking` → (`publishing` if there were cards) → `online`, and the UI reflects it

### Requirement: Prompt assembly from the immediate layer
For each `agent.mention` the runner SHALL build a prompt with: the channel, who's asking (name and role), the last context messages in chronological order with author and time, the mentioning message, and the reminder that the rules live in `cwd`'s `CLAUDE.md`. The runner MUST NOT inject wiki content into the prompt: reading `wiki/index.md` and the cards is the runtime's job inside `cwd` (`agent-wiki` rule 1).

#### Scenario: mention in a thread
- **WHEN** `sofia` mentions `ada` in a thread with 4 prior replies
- **THEN** the prompt contains the root message and the 4 replies, with authors, and ends with `sofia`'s question

### Requirement: Answers with citations
The runner SHALL convert the runtime's text into `paragraphs: MessageBlock[][]`. Every reference of the form `[[<wiki-path>]]` or `[[<wiki-path>#<section>]]` SHALL become a `cite` block pointing at the published card with that `path` (publishing it first if it wasn't yet), with `text` equal to the card's title. Triple-backtick code blocks SHALL become `code` blocks.

#### Scenario: answer citing an existing card
- **WHEN** the runtime answers "See [[modules/03-backprop/exploding-gradient.md]]: the problem is the learning rate"
- **THEN** the published message has a `cite` block with that card's `cardId` and the text "Exploding gradient"

### Requirement: "Answered from the card"
If during a run no file under `wiki/` changed and the answer cites at least one card, the runner SHALL mark the message with `fromCard: { cardId: <first citation>, ago: <time since that card's publishedAt> }`. If the run created or modified cards, the message MUST NOT carry `fromCard`.

#### Scenario: second similar question
- **WHEN** `ignacio` asks something already covered by `questions/exploding-gradient.md` and the runtime answers citing it without writing to the wiki
- **THEN** the message goes out with `fromCard` and the UI shows the "already on file · N days ago" seal

### Requirement: Publishing cards from the filesystem
Before executing the runtime the runner SHALL take a snapshot of `wiki/` (path → hash). When done it SHALL publish as a `Card` every new or modified `.md` file under `wiki/` (except `index.md` and `log.md`), reading its frontmatter per `agent-wiki` and resolving `supersedes` to `replaces` by `path`. The publication SHALL go to the mention's channel, unless the frontmatter has `channel:`.

#### Scenario: ingest produces three cards
- **WHEN** `@ada ingest` finishes and there are three new `.md` files under `wiki/modules/03-backprop/`
- **THEN** the runner publishes three `Card`s with `state: "new"` and the channel shows three publication cards

#### Scenario: a decision replacing another
- **WHEN** `decisions/2026-08-29-midterm-moved.md` appears with `supersedes: decisions/2026-08-15-midterm-date.md`
- **THEN** the new card is published with `replaces` pointing at the old one, and the old one moves to `superseded`

### Requirement: One commit per run
If the agent's folder is its own git repository (a `.git` at its root), at the end of every run that changed files the runner SHALL do `git add -A && git commit -m "<agent>: <summary>"` inside that folder. If the folder sits inside an enclosing repository (this monorepo's `data/`), the runner SHALL NOT create a nested repository — the enclosing one is the history, and a nested `.git` would hide the wiki from it — and SHALL say so once in the log. If it isn't versioned at all, the runner initializes the folder as its own repository and commits from then on.

#### Scenario: git log as the agent's history
- **WHEN** two runs that wrote cards finish in a standalone agent folder
- **THEN** `git log --oneline` in the agent's folder shows two commits

#### Scenario: the agent folder lives inside a repository
- **WHEN** a run changes `wiki/` in `data/<course>/agents/<agent>/` inside this monorepo
- **THEN** no nested repository is created, the log says runs aren't committed separately, and the changed files show up in the monorepo's own `git status`

### Requirement: One mention at a time per agent
The runner SHALL process mentions serially (in-memory queue). If the runtime fails or exceeds a configurable timeout (default 180 s), the runner SHALL post a short message from the agent in the thread saying it couldn't answer, and SHALL stay alive for the next mention.

#### Scenario: the runtime fails
- **WHEN** `claude` exits with an error
- **THEN** the agent posts "I couldn't answer this time; try again in a bit." and returns to `online`
