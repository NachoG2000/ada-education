# Refocus Open Source Product

## Request

> Refocus the repository from the hackathon demo to the open-source product. Close the demo era in the documents of truth and reposition Ada as an open-source course-community product aimed at organizations that run cohort-based courses (bootcamps, academies, corporate training programs), without naming any specific organization anywhere. Concretely: (1) DECISIONS.md gains a dated decision that supersedes the 08/22 hackathon scope (one teacher, fully local, demo): the hackathon phase closed on 2026-08-23 and the project's direction is now an open-source product for course-running organizations; license choice is recorded as an open question, not decided. (2) README.md drops the hackathon/Aleph framing and leads with what Ada is, who it is for (course-running organizations, described generically), the open-source vision, and how to run it. (3) AGENTS.md 'What this repo is' reflects the new scope so agents stop treating the demo as the current goal. (4) PRODUCT.md names the audience in the same generic terms. (5) The stray slide1.png at the repo root moves under pitch/, and pitch/ is marked as history of the hackathon, not current direction. No code behavior changes; demo mode (npm run dev:demo) and the scripted runtime stay as they are.

**Refinement during Specify:** the request said "license choice is recorded as an open question", but the repository already decided Apache-2.0 (`DECISIONS.md` §4) and ships a LICENSE file with it. The contract therefore *reaffirms* Apache-2.0 in the new decision instead of reopening it.

## Goal

Anyone opening the repository — a person or an agent — reads that Ada is an
open-source course-community product for organizations that run cohort-based
courses (bootcamps, academies, corporate training programs, universities), not
a hackathon demo. The hackathon era is preserved as history (superseded
sections, `pitch/`), never as the current goal, and no specific target
organization is named anywhere in the repository.

## Acceptance Criteria

- [ ] [AC-1] `DECISIONS.md` gains a dated §19 (08/23) stating: the Aleph 2026 hackathon phase is closed; the project's direction is an open-source product for organizations that run cohort-based courses, described only in generic terms; it supersedes §15 as the current scope (and §15's heading is annotated "superseded by §19"); it extends §16 from pitch positioning to product direction; it reaffirms the Apache-2.0 license already decided in §4 and present in `LICENSE`; it cites `research/2026-08-22-open-source-vs-premium.md` as backing. No existing section is deleted or rewritten beyond the supersede annotation.
- [ ] [AC-2] `README.md` contains none of the strings "hackathon", "Aleph", or "weekend" (case-insensitive). It leads with what Ada is, who it is for (course-running organizations in generic terms), that it is open source under Apache-2.0, and how to run it locally; the "Current state" table and the run/verify commands remain accurate.
- [ ] [AC-3] `AGENTS.md` "What this repo is" describes the current scope as the open-source product per `DECISIONS.md` §19; the hackathon sentence and code-cutoff line are gone; "Out of scope this weekend" is rephrased as out of scope for now; everything it says about the code (commands, architecture, runtimes, demo mode) stays accurate and unchanged in substance.
- [ ] [AC-4] `PRODUCT.md` names the audience generically: the "judges at a 24-hour hackathon" secondary-audience line and the "Hackathon deliverable" bullet are replaced with the product audience (organizations running cohort-based courses) and a deliverable phrased for the product; its header note points to `DECISIONS.md` §19 for the current scope.
- [ ] [AC-5] No specific target organization is named anywhere in the repository (documents, specs, code, seed data): the audience appears only in generic terms. The example course and its fictional people (`data/neural-networks-2026`, Martin, Sofia) are not organizations and stay as they are.
- [ ] [AC-6] `slide1.png` no longer sits at the repository root; it lives under `pitch/`, and `pitch/AGENTS.md` states the directory is the Aleph 2026 pitch kept as history, not the current direction. `PROBLEM.md`'s reference to the 08/23 demo is updated to past tense (the demo was built; measuring impact on a real course is the next step).
- [ ] [AC-7] `scripts/docs-check.mjs` is extended to assert the new positioning (DECISIONS §19 exists and is dated; README has no hackathon framing and names Apache-2.0; AGENTS.md points at §19) and `node scripts/docs-check.mjs` passes; `npm run typecheck`, `npm run check -w @ada/server`, `npm run check -w @ada/runner`, `npm run lint` (no new warnings) and `npm run build` still pass, proving no code behavior changed.

## Scope

- `DECISIONS.md` (new §19 + supersede annotation on §15), `README.md`,
  `AGENTS.md` (root), `PRODUCT.md`, `PROBLEM.md` (one tense fix),
  `pitch/AGENTS.md`, `slide1.png` → `pitch/slide1.png`,
  `scripts/docs-check.mjs`.

## Non-goals

- No code behavior changes: demo mode (`npm run dev:demo`), the `scripted`
  runtime, the seed course, screens and server stay exactly as they are.
- No license change (Apache-2.0 stands) and no new legal files.
- No deletion of hackathon history: superseded DECISIONS sections, `pitch/`,
  `research/` and the demo evidence stay in the repository.
- No renaming of the example agent ("Ada" vs product name stays an open
  question, `AGENTS.md`).
- No archiving of the OpenSpec change `demo-local-backend` (separate task with
  its own workflow).
- No hosting, multi-tenant, tiers, or marketing-site work; `docs/*.html` stay
  future inspiration.

## Risks

- Positioning rewrites can contradict the decision history. Mitigation:
  supersede and annotate, never delete (`AGENTS.md` rule), and cite §4/§16
  rather than restating them differently.
- `AGENTS.md` steers every future agent: an inaccurate scope statement
  misleads all later work. Mitigation: touch only the scope framing, keep all
  code facts verbatim, and re-read the full diff before completing.
- Pattern-based doc checks can pass on wording that misses the intent.
  Mitigation: patterns assert the specific new claims (dated §19, Apache-2.0
  in README, §19 pointer in AGENTS.md), and review reads the actual prose.

## Verification

- `node scripts/docs-check.mjs` (extended patterns) passes.
- Case-insensitive search over `README.md` for "hackathon", "Aleph",
  "weekend" returns nothing; repository-wide search for specific organization
  names returns nothing.
- `npm run typecheck`, `npm run check -w @ada/server`,
  `npm run check -w @ada/runner`, `npm run lint`, `npm run build` all pass
  (docs-only change; no code impact).

## Capability Deltas

`deltas/project-positioning.md` — new capability: the repository's documents
of truth state the open-source product positioning.
