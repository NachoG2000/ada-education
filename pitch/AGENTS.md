# pitch/ — slides and script for the submission video

**What it is today.** The Aleph 2026 pitch material: `index.html` is the deck (4 slides — cover, problem, solution, close — English, self-contained 16:9 HTML on `deck-stage.js`; opens with a double click, ←/→ navigates, `Cmd+P → PDF` exports one page per slide) and `SCRIPT.md` is the 3:00 video structure with narration, timings, the numbers used with their sources, and the recording checklist. The deck is deliberately light on text: no badges, no license/repo pills, no person avatars — only agent figures; the spoken narration carries the detail.

**Rules when touching the deck:**
- It follows "The card file" design system (`DESIGN.md`): the tokens are copied as custom properties into the `<style>` of `index.html` from `apps/web/src/index.css` (the code wins). The Tab Rule, the One Sun Rule (a single large sun surface per slide) and the Three Voices apply (Literata for what's read, Inter for what operates, Geist Mono for code).
- Slides are static and editable: every text in its own leaf element, repeated structures written out one by one, nothing script-generated. Projection typography: nothing below 24 px.
- The deck's numbers come from `PROBLEM.md` §2 and the forbidden ones in `PROBLEM.md` §10.7 may not be used. If you change a number, update the "Numbers used" section of `SCRIPT.md`.
- `deck-stage.js` is a third-party component (Lark, MIT) copied from `.agents/skills/lark-apps/creative-design/starter-components/`; don't edit it — replace it with a fresh copy if it needs updating.

**How it grows tomorrow.** If the pitch is redone for another audience (investors, institutions), this directory gains one deck per audience (`index.html` stays as the Aleph one) plus the matching script; evidence is always cited from `PROBLEM.md`/`research/`, never duplicated here.
