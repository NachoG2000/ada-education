# "The Instinct Thesis: Why Memory Is Becoming the Moat" — summary (2026-09-01)

Source: essay pasted by Ignacio on 2026-09-01; author is the CEO of Sentra
(enterprise "company brain"), co-author of *Reflexion* (2023), former MIT
advisor of Instinct's founder. URL not provided; the summary below is from
the pasted text (≈ secondary: the author states he has no inside knowledge
of Instinct's internals). Kept here because it bears directly on Ada's
memory model (`DECISIONS.md` §6) and on the strategy memo
`research/2026-09-01-strategy-scoped-agents-group-brain.md` §9.

## What the essay claims

- Three waves: capability (foundation models), execution (Devin, Claude
  Code), **state** — agents that stay situated long enough to know what
  happened, what matters now, what should happen next. Engines and
  execution have commoditized; memory is the moat.
- Instinct (a personal agent living in iMessage) feels magical because it
  *improves* with use instead of degrading; the author attributes that to
  a memory architecture, not the agentic loop.
- **Memory is a compiler, not a database, graph or filesystem.** A tape
  recorder is not a memory (Borges' Funes). Memory needs a utility
  function: *admission utility* (is this observation worth storing?) and
  *action utility / interruption gate* (does this state change justify
  acting, asking, deferring or staying silent, weighing risk,
  irreversibility and authority?).
- Hypothesized tiers: ephemeral ingestion (raw, discarded after
  digestion) → selective append-only semantic ledger with provenance →
  evolving belief/preference map (mutable, versioned) → procedural
  commitment scratchpad (open subgoals, "if silent by Thursday, escalate").
- **Proactivity is a state differential**, not a timer: new events are
  compared with persistent state; only meaningful deltas pass the gate.
  The deepest evidence of a working utility function is *silence*.
- Provenance makes forgetting real: retracting a source invalidates the
  whole dependency branch, unlike RAG where inferences persist in
  summaries and graph edges.
- Privacy corollary: compile and discard the raw stream; "the better the
  notebook, the less of your life anyone needs to keep."
- Testable predictions: graceful degradation as history grows; clean
  reversals ("actually, I'm vegetarian now"); deliberate inaction.
- Enterprise version (Sentra): the same architecture across thousands of
  humans and agents, personal and shared state, from communications,
  systems of record and documents.

## What it means for Ada

- **Validates the core of §6**: `raw/` → compiled cards with `sources`,
  `supersedes` and an index is "memory as a compiler" for a group; the
  cards are the belief map, `log.md` is the ledger, `supersedes` is
  provenance-based forgetting. Rule 4 ("archive only what another student
  could need") is an admission utility stated informally.
- **Where Ada is behind the essay**: no explicit admission utility (ingest
  is "every N messages"), no commitment scratchpad, and **no proactivity**
  — Ada acts only on `@mention` and on ingest. The report rule in
  `PRODUCT.md` (after advising a student, file a report to the teacher) is
  the one proactive behavior on paper, and it has no interruption gate.
- **On "not a filesystem either"**: for one person the storage medium is
  irrelevant; for a group, files the group can `ls`, diff and take away are
  the ownership and trust story (`DECISIONS.md` §1, commitment 2). Files
  don't preclude compilation; they make the compiled state inspectable.
  Sentra's answer is a proprietary shared layer; Ada's is the cohort's
  repository.
- **Prior art to add to the analog table**: Instinct (personal, iMessage,
  proprietary) and Sentra (enterprise, proprietary) — both "memory as the
  product, messaging as the surface"; neither is about a group that turns
  over on a schedule.
