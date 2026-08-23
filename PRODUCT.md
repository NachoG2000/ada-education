# Product

> Product document (direction and ideas): describes the complete product, including what doesn't exist yet. **It does not represent the current code.** Actual state: `AGENTS.md` + `openspec/`. Current scope: `DECISIONS.md` §19 (open-source product for course-running organizations; the code today runs fully local).

<!-- impeccable:product-schema 1 -->

## Platform

web

Web app later packaged as desktop with Tauri (like Buzz and Berd from Block). The wrapper doesn't change the design language: it's designed for web, light theme by default. No mobile version in scope.

## Users

Two primary users who alternate point of view depending on the screen; neither outranks the other.

- **Professor (e.g. Martin).** Creates the course community, its channels and its agents; publishes material, assignments and decisions; opens work channels for assignments and exams. Owns the agent management, channel settings, work channel and decision screens.
- **Student (e.g. Sofia).** Asks questions in channels, opens threads, uploads notes, submits cards of type *submission*, and may have a private channel with an agent configured for themself. Owns the invitation onboarding, #questions with thread, and "the same question, twice" screens.

Situation: an in-progress university course (the demo example is Neural Networks), with 20-40 members, over the semester. UI and content language: English.

Secondary audience: organizations that run cohort-based courses — bootcamps, academies, corporate training programs, universities — evaluating Ada for their own courses.

## Product Purpose

Ada is a learning community for a course where humans and AI agents coexist in channels, and where course knowledge compiles itself into **cards** that are born and grow as people talk.

In one sentence: the professor creates agents and adds them to channels as if they were assistants; the course cards (notes, assignments, decisions, answers, submissions) get published in channels and maintain themselves.

Demo success: a first-time viewer sees, without explanation, that (1) agents are members created by the community, (2) knowledge lives in cards published in channels, (3) agent answers cite cards and, when a question has already been answered, they answer *from the file*, and (4) there are stable course channels and work channels that are born, live, and get archived. The key moment of the demo is the "the same question, twice" screen.

## Positioning

- **There's no "the bot."** Each community creates whatever agents it wants, each with its own name, identity, instructions, provider, and specific channels. An agent can be in `#questions` and not in `#teachers`. They're subtly distinguished from people, not with a "BOT" badge.
- **Cards are the product of chat.** An agent that learns something publishes or updates a card, live, with version, sources, and visibility. A question already covered by the card file gets answered by composing from the cards (not pasting a previous answer), and that's visible; if it brings a new angle, the card gets enriched.
- **Volatile work channels with a lifecycle** (active · submitted · archived), in the style of Buzz's per-feature-branch rooms, but for assignments, exams, and tasks.
- Declared structural reference: **Buzz** (buzz.xyz, github.com/block/buzz) for communities, invitations, agents as members, and channels/rooms; **Berd** (github.com/block/berd) for agent management. Ada positions itself explicitly on top of that family, with its own design system. It's not Slack or Discord with a bot.

## Operating Context

- One community per course. Entry via **invitation link**; local identity (name + avatar) with a key generated in the browser, no email signup. Variant: create a community from scratch.
- Three-column layout: sidebar (community selector; channels grouped into *Course*, *Work*, *Private*; members with people and agents mixed by presence) · channel (strip of channel cards on top, messages below) · right contextual panel (stack: *Thread*, *Card*; extensible to a card tree and history).
- Stable course channels: `#general`, `#questions`, `#teachers`, one per module (`#01-perceptron`, `#02-mlp`, `#03-backprop`…). Work channels: born from an assignment (e.g. "Assignment 2 · Backprop by Hand") with a base document, due date, and assigned agents.
- **Card**: a markdown document published in a channel, with title, type (`note` · `assignment` · `decision` · `answer` · `submission`), author (person or agent), version, sources (messages or source files), "replaces" when applicable, and a visibility chip (*channel members* or *only me*). Actions: open in the right panel, edit (if you're the author), publish to another channel, view history. A published card also appears as a message-card in the channel's flow.
- **Base documents** for a channel: cards or files the professor uploads or selects in channel settings; on save, the channel's agent starts generating cards from them (state "compiling").
- Agent presence: *online*, *thinking*, *publishing a card*.
- States the product has to show: agent compiling; card new · updated · superseded; live answer vs. answer from a card; work channel active · submitted · archived; newly created channel with no cards; module empty · compiling · ready; report new · reconciled.
- **Modules and the two role views (`DECISIONS.md` §18).** A **module** is a unit of the course with its own channel, the **material** the teacher uploads, a **difficulty** (intro · core · advanced) the teacher sets with the agent's rationale and cohort evidence, and the cards the agent compiled from the material. The teacher works in **Modules** (`#modules`): upload material, accept or change the suggested difficulty, read the compiled cards and the agent's **reports**. The student works in **My study** (`#home`): the agent's **feedback** on the last assignment (score, what went well, where it slipped and in which module, next steps with citations), the module that slipped with its cards, and the private conversation with the agent where "how do I get ahead in 03-backprop?" returns a prioritized plan built from the module's cards and the student's own feedback.
- **Report rule.** After advising a student, the agent files a report to the teacher with *its own* summary and a recommendation for the module — never the student's messages — and the student sees on her screen that a summary was shared. The teacher **reconciles** a report into a `decision` card in the module's channel; the module shows a one-line revision.

## Capabilities and Constraints

- **Confirmed stack:** Vite + React 19 + Tailwind CSS v4 + shadcn/ui v4 (Base UI primitives) as the foundation, with a custom design system on top. Tauri packaging later. No SSR.
- **Deliverable:** a functional app with real agents — channels, cards, and at least one agent actually answering; the UI connects to that. It's not just a prototype with mocks.
- **Agents:** each agent runs in a **runner** belonging to whoever created it, running the provider's binary unmodified (`claude`, `codex`, `pi`); the credential (subscription or API key) lives with that binary, never in Ada (`DECISIONS.md` §14; rules verified in `research/2026-08-22-suscripciones-runners-buzz-pi.md`). Each agent has a name, avatar, instructions, provider/credential, and list of channels it participates in. There are **community** agents (created by the professor) and **personal** agents (created by a student for their private channel); the difference is a product distinction and must be visible.
- Agents publish cards using the same mechanism as a person.
- Fixed terminology (English): community, channel, work channel, thread, card, card type, base document, sources, "replaces", visibility, agent, members, submission, compiling, "from the file", module, material, difficulty (intro · core · advanced), feedback, report, reconcile, "Modules" (teacher view), "My study" (student view).
- **Out of scope (do not design):** permissions screen (the full model isn't defined; only the visibility chip exists), general settings, notifications, global search, mobile, submission grading.
- Open decisions: name of the course's example agent (in the original brief it was called "Ada," but Ada is the product and agents carry distinct proper names); the full permissions model; dark theme (only if it comes naturally).

## Brand Commitments

- **Name:** Ada (the product). Agents are many and have proper names; none of them is called Ada.
- **Family reference:** Buzz and Berd (Block) for structure and for treating agents as members, with Ada's own design system.
- Visual constraints set by the founder (binding): no "AI app" look (no purple gradients, sparkles, or generic chat bubbles), no crypto look; serious, warm study-tool tone; serif with personality only for titles and card body text, sans for the UI; strong typographic hierarchy, few boxes and borders; cards look like documents and messages look like conversation, and that contrast is part of the design; agents are distinguished by avatar shape or typographic detail, not a badge; light theme by default.
- Decision from 2026-08-22 (third iteration, current): the visual world is **"The Card File," built on the reference material in `design/inspiration/01`** — a color-washed background, floating white panels with a large radius and soft shadow, folded color tabs by card type, a full yellow as an accent, pastel pills for state. **Colorful and playful, on par with Berd/Buzz**, without an "AI app" look. Agents are **flat procedural characters** (solid silhouette in a bright color, same size, two eyes; `src/lib/figure.ts`): every new agent is born with a unique seed-based variation and can be "rerolled." Quality free typefaces (Inter, Literata, Geist Mono): the founder asked for "more pro without paying." Previously discarded iterations: cardstock cards with a typewriter font and little faces (cheap-looking), a flat sober version (no personality).
- Tone references: Buzz (structure, agents as members), Linear (density, typography), Obsidian (beautiful markdown).

## Evidence on Hand

- `design/BRIEF.md` — the founder's original brief, an initial iteration to improve on (not the final design truth).
- `design/inspiration/01..07-*.png` — seven visual inspiration images provided by the founder; 01 is the main reference.
- `design/mockups/` — a discarded exploration (HTML mockups for Figma); not visual authority or product code.
- **Nothing here is real:** the course, people, messages, cards, metrics, and testimonials are fictional and presented as a demo. There's no logo or prior identity. Don't invent testimonials, adoption numbers, or customers.

## Product Principles

1. **Agents are members, not features.** Every UI decision treats them as people with their own identity and presence, subtly distinguished.
2. **What gets discussed becomes a card.** The chat flow exists to produce and maintain documents; the card is the durable, citable artifact.
3. **Show provenance.** Sources, version, "replaces," and "from the file" are first-class information, never hidden metadata.
4. **Channels with a lifecycle.** What's stable about the course and what's volatile about the work look and behave differently.
5. **Demo first.** When in doubt, prioritize the four theses being understood without explanation across 7 screens, over full coverage.

## Accessibility & Inclusion

No specific requirement established beyond good web practices. Content and UI in English.
