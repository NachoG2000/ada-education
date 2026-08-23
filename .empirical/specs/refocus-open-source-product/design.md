# Design — refocus-open-source-product

Docs-only change. The design is the exact edit plan per file, the wording
strategy, and how verification proves both the new positioning and the absence
of code impact.

## Wording strategy

- **Audience, one phrase used everywhere:** "organizations that run
  cohort-based courses — bootcamps, academies, corporate training programs,
  universities". Always generic; never a brand or a named institution. The
  same phrase (or a tight variant) appears in `README.md`, `PRODUCT.md` and
  `DECISIONS.md` §19 so the three documents cannot drift.
- **Open source, one claim:** Apache-2.0, already decided in `DECISIONS.md` §4
  and shipped in `LICENSE`. §19 reaffirms it and README states it; nothing
  reopens it.
- **History, never deletion:** the hackathon stays in the repo as superseded
  sections (§11, §15 scope, §16's pitch frame), `pitch/`, and the demo
  evidence. New §19 says explicitly what closed and what continues.

## Edit plan per file

1. **`DECISIONS.md`** — append §19 "Product focus: open source for
   course-running organizations (08/23)". Content: the Aleph 2026 phase closed
   on 08/23 (code cutoff passed, demo built — see §18); direction is the
   open-source product; audience in the generic phrase; §16's open-source
   positioning is promoted from pitch narrative to product direction; §4's
   Apache-2.0 reaffirmed (`LICENSE` present); explicitly: no specific target
   organization is named in the repository; backing:
   `research/2026-08-22-open-source-vs-premium.md`. Annotate §15's heading
   with "(superseded by §19)" — the local single-teacher build remains true as
   the *current deployment shape*, but stops being "the weekend's scope".
2. **`README.md`** — replace the "Built at the Aleph 2026 hackathon" line with
   the positioning: open source (Apache-2.0) for the generic audience. Rework
   "Current state" intro ("the weekend's scope" → what runs today, fully local,
   pointer to `DECISIONS.md` §19 and §15 history). Keep the table, the
   end-to-end section, commands and verification untouched except where they
   say "weekend". Result greps clean for hackathon/Aleph/weekend.
3. **`AGENTS.md`** — "What this repo is": drop "Aleph Hackathon 2026, General
   Track. Code cutoff…"; replace the "Current scope (08/22 pivot, §15)"
   paragraph with the §19 scope (open-source product; the fully-local
   single-teacher deployment is the current shape of the code; full
   architecture still future). Rephrase "Out of scope this weekend (don't
   build)" → "Out of scope for now (don't build)". Everything about commands,
   architecture, runtimes and design rules stays byte-identical.
4. **`PRODUCT.md`** — header note: current scope pointer §15 → §19. Replace
   "Secondary audience: judges at a 24-hour hackathon watching a guided demo."
   with the organizations line (they evaluate/adopt Ada for their courses).
   Replace the "**Hackathon deliverable:**" bullet with a product deliverable
   ("**Deliverable:**" — a functional app with real agents, no mocks), same
   substance minus the hackathon frame.
5. **`PROBLEM.md`** — the 08/23 demo line moves to past tense: what the demo
   proved, and that measuring impact on a real course is the next step now
   that the hackathon is over.
6. **`pitch/AGENTS.md`** — first line states: Aleph 2026 pitch material,
   preserved as history; current direction lives in `DECISIONS.md` §19. Add
   `slide1.png` to its inventory.
7. **`git mv slide1.png pitch/slide1.png`** — no references to update
   (verified: only `.empirical` state mentions it, quoting the request).
8. **`scripts/docs-check.mjs`** — extend `checks` with the positioning
   patterns: `DECISIONS.md` matches `/## 19\./` and `/08\/23/` in that
   section, README matches `/Apache-2.0/` and `/cohort-based/` and has a
   negative check (no `/hackathon|aleph|weekend/i`), `AGENTS.md` matches
   `/§19|DECISIONS\.md.*19/`. The script gains a small negative-pattern
   capability (a pattern entry `{not: /…/}` or a second tuple slot) — pure
   reads, exits 1 listing failures, same as today.

## Verification

- `node scripts/docs-check.mjs` — asserts AC-1/2/3 positioning claims.
- `grep -ri "hackathon\|aleph\|weekend" README.md` → empty (AC-2);
  repo-wide search for specific organization names → empty (AC-5, the term
  searched is not written into any file).
- Policy commands: `npm run typecheck`, `npm run check -w @ada/server`,
  `npm run check -w @ada/runner`, `npm run lint`, `npm run build` — all must
  pass unchanged, proving the docs-only claim (AC-7).

## Trade-offs / risks

- Keeping §15 "superseded" while the code still *is* a fully-local
  single-teacher build could confuse: resolved by wording §19 as "the scope
  framing changes (demo → product); the deployment shape today is still
  local-first" and having AGENTS.md say exactly that.
- Negative grep checks in docs-check could rot (e.g., a future README legit
  mention of the hackathon history). Accepted: the check documents today's
  positioning intent; a future change that reintroduces the word must touch
  the check deliberately.
