# Pitch script — submission video (3:00)

Structure of the Aleph 2026 video and the slide script. Organizer rules and why 3 minutes: `research/2026-08-22-aleph-submission-and-pitch.md`. Positioning: `DECISIONS.md` §16 (confirmed). What not to say and which numbers not to use: `PROBLEM.md` §9–§10.

**The deck is `pitch/index.html`**: a self-contained 16:9 HTML (1920×1080), opens with a double click, navigates with ←/→, and `Cmd+P → PDF` exports one page per slide. Slides in English; as of `DECISIONS.md` §17 the product shown in the demo is in English too.

## Video structure (3:00)

| Time | On screen | What's said (summary) |
|---|---|---|
| 0:00–0:07 | S1 · title | Hook: a course understands things together and loses almost all of it. |
| 0:07–0:40 | S2 · problem | Courses restart from zero every year (4,404 → 3,218, spoken, not on screen) — and since 2025 the stuck student asks first an AI that doesn't know the course; nothing comes back; used loose, it measurably hurts. |
| 0:40–1:12 | S3 · solution | Ada: agents as members; knowledge compiles into cards with type, version and sources, in files the group owns. Compiled once, composed every time — the "already on file" seal, not a cache. |
| 1:12–2:50 | **Recorded demo** | `DECISIONS.md` §11 script compressed to the core steps (§15): ingest → question with citations → "the same question, second time" from the card file → decision with supersedes → terminal `ls data/` + `git log` (the under-the-hood narration lands here). |
| 2:50–3:00 | S4 · close | Vision: what they learn stays with them. |

If the edited demo needs more air, S2 narrates in 20s (the text below marks which sentences to cut).

## Title sequence (the story reads from titles alone)

1. **Ada** — Humans and AI agents learn together, and what they learn stays with them.
2. **Questions now go to an AI that doesn't know the course**
3. **Ada gives the course a shared memory**
4. **What they learn stays with them**

## Archetype and visual anchor per slide

| # | Archetype | Anchor (first thing the eye lands on) | Sun (One Sun Rule) |
|---|---|---|---|
| 1 | cover | "Ada" wordmark in Literata + agent figures in a row | none (the figures bring the color) |
| 2 | bar chart | "an AI · 29%" bar in ink | none |
| 3 | product visual | the card stack; the "New" answer card | the new card (+ the "already on file" seal pill) |
| 4 | statement | "stays with them" highlighted in sun | the highlight |

## Narration (English, ready to record)

**S1 (0:00).** Every course understands things together — the explanation that finally clicked, the reason the exam moved. And then it loses almost all of it.

**S2 (0:07).** One intro programming course got four thousand four hundred questions in its forum. The next year — same course, same content — three thousand two hundred more, because the forum started from zero. *(optional cut:)* Everything the group understood is buried in chat threads nobody can read back. Since 2025 there's a worse leak: when students get stuck, more of them go first to an AI than to their classmates or the course material. That AI doesn't know the course — and nothing it explains ever comes back to the group. *(optional cut:)* Used loose like this, it measurably hurts learning.

**S3 (0:40).** Ada is a course community where AI agents are members — the teacher creates them and adds them to channels like teaching assistants. As people talk, what gets understood compiles into cards: typed, versioned pages with sources, in plain files the group owns. The expensive part — reading the material and understanding it — happens once. Every answer is composed fresh from the cards. *(optional cut:)* When a second student asks "the same thing" with different words, they get a new answer built from what the group already understood, and the card gains the new angle. It's not a cache of answers.

**Demo (1:12).** *(no fixed narration; call out in the edit: the citations, the "already on file" seal, the `git log`)* Over the terminal beat (`ls data/` + `git log`): under the hood there's no magic — the whole course is a folder of markdown in git; the server just moves messages, it never runs models; the agent is Claude Code running on that folder, on the teacher's own machine.

**S4 (2:50).** It runs today on one professor's laptop. Humans and agents learn together — and what they learn stays with them.

## Numbers used and their backing

All verified in `PROBLEM.md` §2 / `research/2026-08-22-problem-impact.md`; none is on the forbidden list of `PROBLEM.md` §10.7.

- **4,404 → 3,218** questions, same intro course, 2020/2021 editions `[B1]` (narration only; no longer on a slide).
- **29%** go first to AI when stuck · **15%** to classmates · **14%** to the course material `[A4]`.
- **88%** of students use AI to learn · only **15%** have it integrated in many subjects `[A2]` `[A3]`.
- **17% worse** on the AI-free exam after practicing with a generic GPT `[A6]`.

## Checklist before exporting the video

- [ ] **Push the repo to GitHub** (the submission requires a link to the code; it goes in the DoraHacks form and the README — the deck no longer shows a repo URL). The Apache-2.0 `LICENSE` is already at the root.
- [ ] Record the demo with `npm run seed && npm run dev`, 16:9 screen, browser zoom that keeps the UI readable at 1920×1080.
- [ ] Time it: slides ≤ 1:12; edited demo ≤ 1:38; close 10s. Hard limit: 3:00.
- [ ] English captions if narrated in Spanish (judging rule).
- [ ] On DoraHacks: select General Track and complete the repo README.
