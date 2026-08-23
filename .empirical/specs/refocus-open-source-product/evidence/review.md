# Review — refocus-open-source-product

Independent review (separate agent, no shared context) of the working diff
against AC-1..AC-7 and decisions D-001..D-004, plus a verification pass by the
orchestrating agent. Full commands in the reviewer's report; outcomes below.

## Verdicts

- AC-1..AC-7: **pass**, each with file/line evidence (DECISIONS.md §19 dated
  and internally consistent with §4/§15/§16; README greps clean of
  hackathon/aleph/weekend; AGENTS.md points at §19; PRODUCT.md audience
  generic; no target organization named anywhere; slide1.png under pitch/ and
  pitch marked history; docs-check "Docs OK (13 files)" and the full command
  suite passing).
- D-001..D-004: **no contradictions**. The audience phrase is
  character-for-character identical across README/AGENTS/PRODUCT/DECISIONS §19.
  The diff contains only additions plus the §15 heading annotation.
- docs-check negative-pattern logic verified: an in-memory README copy with
  "hackathon" appended fails the check as designed.

## Findings and remediation

1. **[medium] Leftover "this weekend"/hackathon framing outside the spec's
   file list** — per-area `AGENTS.md` (server, runner, docs), code comments in
   `apps/server/src/api.ts`, `packages/runner/src/cli.ts`,
   `apps/web/src/lib/community.tsx`, and the `docs/*.html` banners
   ("Ada · Aleph 2026", "cutoff Sunday 04:00", "this weekend").
   **Fixed in this revision**: all reworded to the current scope (§19) or
   neutral tense; comment-only code edits, re-verified with typecheck, server
   and runner checks, and docs-check. This follows the repo rule that
   `docs/*.html` update in the same task when `DECISIONS.md` moves.
2. **[low] Stale known-warnings note in `AGENTS.md`** (pre-existing): updated
   to list the actual current lint warnings.
3. `data/AGENTS.md` references the literal spec path
   `.empirical/specs/build-the-hackathon-demo-flow-for-ada-one-teacher-fully/`
   — kept: it is a real directory name (renaming it would break the Empirical
   journal), a path, not positioning prose.

History files keep their hackathon-era wording by design (D-003):
superseded `DECISIONS.md` sections, `PROBLEM.md`'s past-tense line,
`research/`, `pitch/`, `design/BRIEF.md`, `openspec/`.
