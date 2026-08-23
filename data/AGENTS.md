# data/ — the courses (the memory lives here, not in the DB)

**Today:** the seed course `neural-networks-2026` has a `community.json` with 10 channels (course, `teachers`, one work channel, three private channels), 4 people, the `ada` agent, 3 course modules (`01-perceptron`, `02-mlp`, `03-backprop`), one assignment, feedback and one reconciled report for the cohort, and a living message history. `raw/martin/modules/<nn>-<slug>/*.md` holds the real teacher-authored study material for each module (no more placeholders). The server's seed reads `community.json` and publishes the base document as the `base` card, upserts `agents/ada/wiki/**/*.md` as cards (`wikiCards: true`), and inserts modules/assignments/feedback/reports/messages.

**Seed keys in `community.json`** (see `.empirical/specs/build-the-hackathon-demo-flow-for-ada-one-teacher-fully/design.md` §5/§8 for the binding contract):
- `modules[]` — one per course unit (`id` doubles as its channel id, `slug` for wiki/raw paths, `objectives[]`, `difficulty{level, rationale, evidence[], suggestedBy, setBy}`, `materials[]` pointing at files under `raw/`, `cardIds: []` left empty — the server computes it, `revision?` set once a report is reconciled into the module).
- `assignments[]`, `feedback[]`, `reports[]` — shapes match `packages/protocol` `Assignment`/`Feedback`/`Report`. `at` accepts either an ISO string or the `ago` shorthand (`"2d"`, `"12d"`). `feedback[].gaps[].cardId`, `feedback[].nextSteps[].cardId`, `reports[].cardIds[]` and `reports[].reconciled.cardId` are wiki paths (e.g. `modules/03-backprop/chain-rule.md`), resolved to card ids at seed time.
- `messages[]` — `{id, channelId, authorId, ago | at, text, fromCard?}`; blank lines in `text` split into paragraphs; `[[wiki/path|label]]` inside `text` becomes a cite block resolved against seeded cards. Card **bodies** never use `[[...]]` — that syntax only works inside message text, since card bodies render through the plain `Markdown` component (`apps/web/src/components/ada/markdown.tsx`), which supports only `## ` headings, paragraphs, numbered lists, `**bold**`, `*italic*` and `` `code` `` — no links, tables, bullets or fenced code, in card bodies *or* in raw materials that become a `baseDoc` card.
- `wikiCards: true` — every `agents/ada/wiki/**/*.md` except `index.md`/`log.md` is upserted as a card, in the channel named by its frontmatter `channel:` (default from the path: `modules/<id>/…` → that module's channel, `questions/…` → `questions`, `decisions/…` → the given channel or `general`). Frontmatter `type` (`topic|question|decision|difficulty|assignment|submission`) maps to `Card.type`: `topic|note|difficulty` → `note`, `question|answer` → `answer`, `decision`/`assignment`/`submission` pass through as-is.

**Wiki layout** under `agents/ada/wiki/`: `modules/<nn>-<slug>/<card-slug>.md` for course topics (one card per concept, not per file — a single material can split into several cards), `decisions/<slug>.md` for reconciled revisions, `questions/<slug>.md` for standalone Q&A, `difficulties/` reserved for cohort-wide difficulty notes. `index.md` lists every card (`- path · type · title`); `log.md` is a dated one-line-per-run journal. Keep both in sync by hand when adding cards here (the live runner does this automatically for its own runs).

**Layout per course** (`DECISIONS.md` §6):

```
data/<course>/
  community.json                 ← course, channels, people, agents (with the runner's token)
  raw/<person>/...                ← base documents; humans write here, agents only read
  agents/<agent>/
    CLAUDE.md                    ← rules + instructions for the agent (its runtime reads this)
    wiki/                        ← the compiled memory: index.md, log.md, modules/, questions/, decisions/, difficulties/
    about/                       ← what the agent knows about each person
```

Principles: everything is readable markdown (`ls` is the audit interface), git as versioning (one commit per runner run, in the repo that holds the folder), the server only stores the **published copy** of each card. In the public repo this course is a **sample**: in real use the folder lives wherever the runner lives, outside the code repo (`docs/como-funciona.html` §4).

**How it grows (idea, not code):** one git repo per course, `people/<student>/wiki` for personal agents, permissions by folder composition (bind mounts / Archil) — `DECISIONS.md` §14.7.
