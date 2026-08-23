# Plan — refocus-open-source-product

Docs-only; steps are ordered so the documents of truth change first and the
checks that pin them change last. Every step names its ACs.

1. **DECISIONS.md** (AC-1): append §19 "Product focus: open source for
   course-running organizations (08/23)" — hackathon phase closed, direction,
   canonical audience phrase, extends §16, reaffirms §4/Apache-2.0, explicit
   no-names rule, cites `research/2026-08-22-open-source-vs-premium.md`.
   Annotate §15's heading "(superseded by §19)" and update the header note
   that names §15 as the current scope.
2. **README.md** (AC-2): replace the hackathon line with the positioning
   (open source, Apache-2.0, audience); reframe "Current state" intro away
   from "the weekend's scope"; sweep the file for hackathon/Aleph/weekend.
3. **AGENTS.md** (AC-3): rewrite the two scope paragraphs in "What this repo
   is" (drop hackathon + code cutoff; current scope = §19, deployment shape
   still local-first); "Out of scope this weekend" → "Out of scope for now".
   No other line changes in substance.
4. **PRODUCT.md** (AC-4): header note §15 → §19; secondary audience line →
   organizations phrase; "Hackathon deliverable" → "Deliverable".
5. **PROBLEM.md** (AC-6): the 08/23 demo sentence to past tense; next step is
   measuring impact on a real course.
6. **pitch/AGENTS.md + slide1.png** (AC-6): mark the directory as Aleph 2026
   history pointing at §19; `git mv slide1.png pitch/slide1.png`.
7. **scripts/docs-check.mjs** (AC-7): add positive patterns (§19 dated in
   DECISIONS, Apache-2.0 + cohort-based in README, §19 pointer in AGENTS.md,
   history line in pitch/AGENTS.md) and negative patterns (README must not
   match /hackathon|aleph|weekend/i).
8. **Verify** (AC-2, AC-5, AC-7): `node scripts/docs-check.mjs`; grep README
   for the banned strings and the repo for specific organization names (term
   not written into any file); `npm run typecheck`, `npm run check -w
   @ada/server`, `npm run check -w @ada/runner`, `npm run lint`,
   `npm run build`.
9. **Re-read the full diff** against D-003 (only additions + the §15 heading
   annotation in DECISIONS.md; AGENTS.md code facts untouched) before
   completing Implement.
