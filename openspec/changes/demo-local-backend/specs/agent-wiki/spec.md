## Purpose

The agent's memory as files: the layout of `data/<course>/agents/<agent>/`, each card's frontmatter, the rules the runtime reads in `CLAUDE.md`, and the contract that lets the runner publish cards and detect "answered from the card". Implements `DECISIONS.md` §6.

## ADDED Requirements

### Requirement: Agent folder layout
Every agent SHALL have a folder `data/<course>/agents/<agent>/` with: `CLAUDE.md` (and `AGENTS.md` as a symlink or copy, for runtimes that read that name), `wiki/index.md`, `wiki/log.md`, and subfolders `wiki/modules/<nn>-<slug>/`, `wiki/decisions/`, `wiki/questions/`, `wiki/difficulties/`, `about/`. The course's base documents SHALL live outside the agent's folder, in `data/<course>/raw/<person>/...`, and the agent SHALL be able to read them but MUST NOT write there.

#### Scenario: freshly created agent
- **WHEN** the server creates an agent and the runner starts for the first time with an empty `--cwd`
- **THEN** the runner generates the layout from `packages/runner/templates/` with an empty `index.md` and a `CLAUDE.md` with the agent's instructions

### Requirement: Card frontmatter
Every `.md` under `wiki/` except `index.md` and `log.md` SHALL start with YAML frontmatter containing, at minimum: `type` (`topic | decision | question | assignment | submission | difficulty`), `title`, `valid_from` (date), `updated` (date), `sources` (a list of paths in `raw/` or `msg:<id>` ids), and optionally `supersedes` (the path of the card it replaces) and `channel` (id of the channel to publish it in). The runner SHALL map `type` to the client's `CardType`: `topic → note`, `question → answer`, `difficulty → note`, and the rest as-is. A card without valid frontmatter MUST NOT be published; the runner SHALL log the path and the error.

#### Scenario: valid card
- **WHEN** the runtime writes `wiki/questions/exploding-gradient.md` with `type: question`, `title`, `valid_from`, `updated` and `sources: [msg:m-42]`
- **THEN** the runner publishes it as a `Card` of type `answer`, with `sources` of kind `message` pointing at `m-42`

### Requirement: Agent rules in `CLAUDE.md`
Each agent's `CLAUDE.md` SHALL contain, besides the agent's own instructions, the fixed rules of `DECISIONS.md` §6: (1) read `wiki/index.md` before answering and open at most 5 cards; (2) cite cards by path with the `[[path]]` syntax; (3) archive the answer as a new card only if someone else could ask the same thing; (4) never write outside the agent's folder; (5) on a source contradicting a card, create a new one with `supersedes` instead of editing the old one; (6) maintain `index.md` (one line per card: path, type, title) and `log.md` (one line per run). It SHALL make explicit that the channel answer is the final text, without preambles or meta-comments, in English.

#### Scenario: reusable answer
- **WHEN** the agent answers a conceptual doubt another student could have
- **THEN** it creates a card in `wiki/questions/`, adds its line to `index.md`, and the channel answer cites it with `[[questions/<slug>.md]]`

#### Scenario: answer already on file
- **WHEN** the question is already covered by a card in the index
- **THEN** the agent answers citing it with `[[path]]` and writes no file

### Requirement: Explicit ingest
On receiving a mention whose text starts with `ingest`, the agent SHALL read the new documents in `raw/` that aren't listed in `log.md`, produce `topic` cards in `wiki/modules/<nn>-<slug>/` (one per topic, not one per file), update `index.md` and `log.md`, and answer in the channel with the list of created cards cited with `[[path]]`.

#### Scenario: first ingest of the backprop module
- **WHEN** `martin` uploads `raw/martin/modules/03-backprop/backprop.md` and writes `@ada ingest`
- **THEN** several `topic` cards appear in `wiki/modules/03-backprop/` and an answer that lists them

### Requirement: Versioning with git
The agent's folder SHOULD be its own git repository (`git init` is done by the runner on first startup if missing). That folder's `git log` SHALL be the history of what the agent learned; `git diff` between two dates, what it learned in that period.

#### Scenario: demo close
- **WHEN** `ls -R data/neural-networks-2026/agents/ada/wiki` and `git -C <that folder> log --oneline` run
- **THEN** the cards show up in markdown and one commit per run

### Requirement: Seed course
The repo SHALL include `data/neural-networks-2026/` with `community.json`, `raw/martin/modules/03-backprop/backprop.md` (a real base document, ~2–4 pages on backpropagation and exploding/vanishing gradients), and `agents/ada/` with `CLAUDE.md` and an empty `wiki/index.md`. All content SHALL be fictional or public domain and presented as a demo.

#### Scenario: clone and run
- **WHEN** someone clones the repo and runs `npm install && npm run seed && npm run dev`
- **THEN** they have the seed course with the base document loaded and can start a runner against `agents/ada`
