# Conventions

Maintained from `AGENTS.md`, `DESIGN.md` and observed code.

## Code and structure

- Every area has its own short `AGENTS.md`; keep it updated when touching the area. Rules live in `AGENTS.md` (root); `CLAUDE.md` only imports it.
- Design system "The card file" (`DESIGN.md`; the real tokens in `apps/web/src/index.css` win): Tailwind v4 `@theme` tokens (`ground/panel/panel-2/panel-3/line/ink/ink-2..4/sun/sun-soft/seal/alert/ok`, `tab-<type>`, `status-<status>`), fonts `font-sans` (Inter, UI) · `font-serif` (Literata, cards) · `font-mono` (Geist Mono), radii `rounded-panel/card/card-tab/control/pill`, shadows `shadow-card/pop`. No raw Tailwind colors, no violets.
- Named rules: **Tab Rule** (a type color only on the folded tab or a citation dot), **One Sun Rule** (full yellow once per screen + "already on file" pills), **Three Voices** (Literata reads, Inter operates, Geist Mono codes). Agents = silhouette + two eyes, never a "BOT" badge; people = circles. No chat bubbles, no 1px-border depth system. Animations only on state changes; respect `prefers-reduced-motion`.
- Compose from `src/components/ada`; shadcn primitives via `cd apps/web && npx shadcn add <component>`.
- Lookups in `useCommunity()` throw on broken ids by design; error boundaries around rows and panels catch them.
- Messages are `paragraphs: MessageBlock[][]` (`text | cite | code`), never raw strings. The in-house markdown renderer supports only `##`, paragraphs, numbered lists, `**`, `*`, `` ` ``.

## Testing and delivery

- No tests: verification is typecheck + lint (baseline: 21 known-category warnings in `community.tsx`, `identity.tsx`, `card.tsx`, `ui/*`, `use-mobile.ts`; files with non-component exports trigger `only-export-components`, so keep hooks/helpers out of component files) + build + `npm run smoke` + browser checks (see `commands.md`).
- Commits: short `area: summary` subject lines (see `git log`). Main branch `main`; current feature branch `teacher-upload-modules-and` in a git worktree.
- OpenSpec flow for specs: active change `openspec/changes/demo-local-backend/` (`tasks.md` checklist).

## Repository-specific constraints

- **All information lands in the repo**: anything used to think or decide goes into a markdown file before the task closes (`PROBLEM.md`, `DECISIONS.md` with superseded-not-deleted decisions and dates, `PRODUCT.md`/`DESIGN.md`, `research/YYYY-MM-DD-<topic>.md` with sources). Cite by path and section.
- Don't invent figures, sources, testimonials or customers; the seed course and people are fictional and presented as a demo.
- Don't resolve the listed open questions alone (seal semantics, `fromFile` plural API, the agent's name). Ask first.
- Agents never edit an old card on contradiction: new card + `supersedes`. Agents write only inside their own folder.
- Everything in English (a Spanish-first, `?english=true` localization is planned as a separate feature, 2026-08-23).
- Agents publish only what's in the wiki: a card's body may not contain `[[...]]` (the card renderer doesn't resolve it); citations live in messages.
