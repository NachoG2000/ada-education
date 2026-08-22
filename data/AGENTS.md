# data/ — the courses (the memory lives here, not in the DB)

**Today:** the seed course `neural-networks-2026` has a `community.json` with its three channels, people, the `ada` agent, and the declared base document; `raw/martin/modules/03-backprop/backprop.md` is still a placeholder. The server's seed reads this configuration and publishes the base document as the `base` card.

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
