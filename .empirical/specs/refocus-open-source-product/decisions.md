# Decisions: Refocus on the open-source product

Record concise, externally reviewable evidence and choices here.

## D-001: Reaffirm Apache-2.0 instead of reopening the license

Status: Accepted

### Evidence

- `DECISIONS.md` §4 already commits to "Open source (Apache-2.0)".
- The repository ships a `LICENSE` file containing the Apache License 2.0 (verified 08/23).
- The raw request said "license choice is recorded as an open question", written before knowing §4.

### Options

1. Record the license as an open question, as the raw request said.
2. Reaffirm the existing §4 decision in the new §19.

### Chosen approach

Option 2. Reopening a decided, shipped choice would contradict the repo's own rule that decisions change only by explicit supersede. §19 reaffirms Apache-2.0 and points at `LICENSE`.

### Trade-offs and risks

- If the user actually wants to revisit the license, that is a new decision with its own dated entry; nothing here blocks it.

### Verification

- AC-1: §19 reaffirms Apache-2.0; AC-2: README names Apache-2.0; docs-check pattern.

## D-002: One generic audience phrase, reused across documents

Status: Accepted

### Evidence

- The user asked to target organizations that run courses (bootcamps and the like) without naming any specific organization anywhere.
- Three documents describe the audience today with different frames (README hackathon line, PRODUCT "judges" line, DECISIONS §16 pitch positioning).

### Options

1. Tailor a different audience wording per document.
2. One canonical phrase — "organizations that run cohort-based courses — bootcamps, academies, corporate training programs, universities" — reused in README, PRODUCT and DECISIONS §19.

### Chosen approach

Option 2. One phrase prevents drift, makes the no-names rule auditable, and gives docs-check a stable pattern (`cohort-based`).

### Trade-offs and risks

- Slightly repetitive prose across the three documents; accepted for auditability.

### Verification

- AC-2, AC-4, AC-5: the phrase appears in README/PRODUCT/§19; repo-wide search for specific organization names returns nothing.

## D-003: Supersede the hackathon scope; keep every trace as history

Status: Accepted

### Evidence

- `AGENTS.md` rule: "A decision that changes is not deleted: it's marked as superseded and the new one is added, with a date."
- §11, §15, §16 and §18 record the hackathon era; `pitch/` and the demo evidence exist in the tree.

### Options

1. Rewrite or remove hackathon-era sections and material.
2. Append §19, annotate §15's heading as superseded, mark `pitch/` as history, and scrub hackathon framing only from current-facing documents (README, AGENTS.md scope, PRODUCT audience).

### Chosen approach

Option 2. History stays auditable; only what presents itself as "the current goal" changes. §19 words the pivot as: the scope framing changes (demo → product); the deployment shape today is still local-first.

### Trade-offs and risks

- The word "weekend" survives in superseded DECISIONS sections — deliberate, they are history.
- Keeping §15 visible could confuse a skimming reader; mitigated by the supersede annotation on its heading and AGENTS.md pointing at §19.

### Verification

- AC-1, AC-3, AC-6: §15 heading annotated, AGENTS.md points at §19, `pitch/AGENTS.md` says history; no section deleted (git diff shows only additions and the heading annotation).

## D-004: Extend scripts/docs-check.mjs rather than adding a new checker

Status: Accepted

### Evidence

- `scripts/docs-check.mjs` already asserts doc claims for §18 with file/pattern tuples and exits 1 listing misses.
- The new positioning claims are the same shape (file must match pattern), plus one negative claim (README must not mention the hackathon).

### Options

1. A new one-off script for positioning checks.
2. Extend the existing checks and add a minimal negative-pattern form.

### Chosen approach

Option 2. One place holds every doc invariant and one command runs them; the script gains a few lines for negative patterns.

### Trade-offs and risks

- Negative checks can rot if a future README legitimately mentions the hackathon as history; that future change must touch the check deliberately, which is the point.

### Verification

- AC-7: `node scripts/docs-check.mjs` passes with the extended patterns and fails if the positioning claims are removed.
