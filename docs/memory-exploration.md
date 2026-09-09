# Memory exploration courses

These fixtures give us real starting points for discussing a demo. They are
authored synthetic examples, not customer data, a scripted presentation or canned
runtime answers. Subsequent messages use the real memory and agent pipeline.

## Setup

Run `npm run seed:exploration` with the local server stopped. The command creates
two hosted courses and a private `.ada/exploration-accounts.json` containing account
keys and course/case IDs. Repeating it with that same database and manifest keeps
the existing records. Use the app's existing account-restoration flow to switch
between Nacho (teacher), Maya Rivera (teacher) and the fictional student accounts.
Keys are never printed, committed or exposed through a public demo login endpoint.

For an intentional fresh start, stop `npm run dev` and run
`npm run seed:exploration -- --reset`. This deletes the configured SQLite file,
its WAL/SHM companions, its governed memory directory and the exploration account
manifest. Existing runner workspaces, Pi authentication and legacy fixture files
are preserved. `ADA_DB` and `ADA_EXPLORATION_ACCOUNTS` can select separate test
locations. Never point automated checks at the live exploration database.

Start `npm run dev`, restore a seeded account, and open Course memory or an Ada
conversation. New communities get the same behavior without seed data.

## Available cases

| Case | Thinking in Code | Data for Decisions | What to inspect |
| --- | --- | --- | --- |
| Original vs derived | Recursion study guide | Evidence and experiments guide | Download unchanged original; inspect an atomic concept and its quote |
| Composable teaching | Factorial and a two-column trace | Sign-up rates and groups of 100 | Follow supports/refines links; both examples remain available |
| Learner evolution | Base-case doubt, later explanation, new tree-stack question | Counts vs rates, later correction, new random-assignment question | Alex's current view versus earlier history |
| Different learners | Sofia confuses calls and returns | Sofia asks about sampling bias | Teacher sees both; Alex sees only Alex's records |
| Honest inference | Evidence limited to one exercise | Ratio reasoning is distinct from experiment design | The inference label and original participation evidence |
| Corrected interpretation | An overbroad transfer claim is narrowed | An overbroad competence claim is narrowed | Corrected record, replacement and teacher review reason |
| Admission by authority | Learner hearsay about a workshop vs teacher confirmation | Same operational contrast in another course | Pending review versus accepted event; quoted authority does not confer a role |
| Time-sensitive knowledge | Past orientation and upcoming workshop | Past orientation and upcoming workshop | Current activity versus historical events |
| Destination privacy | Teacher asks in a shared lab vs a private Ada conversation | Teacher asks in a shared clinic vs privately | Personal records never enter shared-channel retrieval |
| New information | Upload a new source or add a question | Revise a source or contribute a new example | Real queued consolidation, review and evidence invalidation |
| Course isolation | Alex in the programming course | Alex in the data course | Distinct trajectories for the same global account |

The private manifest identifies specific records and channels so we can revisit
these cases as implementation changes. We still need to choose which cases tell
the product story best, which perspective leads, what to emphasize and how to
present them together. Those presentation decisions are deliberately not seeded.

## Current local exploration additions

The 2026-09-08 live verification also left a real Ada answer in Nacho's private
Thinking in Code conversation, plus the two-version **Tracing calls checklist**
source. Version 2 adds a branching-tree distinction between stack depth and total
visited nodes. These are editable exploration data created through the normal
API and Pi pipeline; a fresh seed intentionally starts from the case inventory
above. The original pre-demo SQLite data was reset with the user's authorization.
