# Product

> Product document (direction and ideas): describes the complete product, including what doesn't exist yet. **It does not represent the current code.** Actual state: `AGENTS.md`. Current scope: `DECISIONS.md` §22–§24; the current contract below takes precedence over the preserved product direction.

## Current product contract (2026-09-05)

The mounted product is the default-shadcn hosted community workspace with
TanStack Router. A global user has teacher/student memberships across
communities. Account backup/restoration, community and channel management,
invites, member roles, agent enrollment, routed channels/threads/DMs/Agents/
Settings, mentions, and live messages are implemented.

User-agent DMs are visible to the participant and to teachers; teacher views
are read-only and student views disclose that access. These DMs do not
implement the teacher-inaccessible personal wiki envisioned in earlier
product direction.

Navigation search covers channels, DMs, people, agents, and available
actions. Messages, card-memory search, notifications, reactions,
attachments, grading, and work-channel lifecycle remain outside scope.
Cards remain backend memory: the mounted UI ignores their publication
events. Modules and My study are retained unmounted history. Empty Inbox is
a fallback when a community has no joined channels, not a notification feed.

Use plain neutral surfaces and initial/image avatars. Buzz defines
interaction patterns, not decorative styling. The current visual contract
is in `DESIGN.md`, "Current visible workspace — issues #1/#3/#4".

Repository consolidation improves setup, documentation, and verification;
it adds no product capabilities. A course-memory interface needs a separate
scope/design change. See `docs/architecture.md` for current entry points.

## Preserved product direction and earlier boundaries

The following dated notes and sections preserve the expanded vision and
previous UI contracts. They do not override the current contract above;
references to personal agents, card screens, reports, and special channel
types describe future or retired work unless explicitly included above.

> **Historical issue #1 boundary (2026-09-03):** the visible product is the default shadcn Buzz-shaped community workspace: one global user identity, many communities with a role per membership, channels, DMs, members, invites, agents, messages, threads and runner setup. Cards remain backend memory with no card UI in this phase. Modules, My study, Inbox and standalone Agents/settings explorations below are retained product direction/history, not mounted routes.

> **Historical visible product, 2026-08-24 (`DECISIONS.md` §21):** a responsive, chat/configuration-first workspace adapted from Buzz desktop: Inbox, Course/Work/Private channels, messages and threads, command search, channel management, Agents and scoped Settings. Dedicated Modules, My study and Card File pages are retired from navigation; their persisted knowledge pipeline remains behind inline citations and publication messages. This note supersedes older page/layout/mobile/theme statements below, not the underlying course-memory model.

<!-- impeccable:product-schema 1 -->

## Platform

web

Responsive web app; desktop packaging remains future direction. The same workspace adapts to narrow browsers with a sidebar sheet and overlay thread. Light, dark and system appearance are supported.

## Users

Two primary users who alternate point of view depending on the screen; neither outranks the other.

- **Professor (e.g. Martin).** Has a teacher membership in one or more communities; creates communities, channels, invites and agents, and moderates the conversation.
- **Student (e.g. Sofia).** Has a student membership in one or more communities; joins with an invite code, participates in public channels, threads and private user-agent DMs.

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
- Buzz-style framed layout: compact top chrome · resizable/collapsible sidebar with Inbox, Agents and channels grouped into *Course*, *Work*, *Private* · rounded content surface · a resizable thread auxiliary panel (overlay on narrow screens). Card provenance stays inline in messages rather than in a standalone Card File page.
- Stable course channels: `#general`, `#questions`, `#teachers`, one per module (`#01-perceptron`, `#02-mlp`, `#03-backprop`…). Work channels: born from an assignment (e.g. "Assignment 2 · Backprop by Hand") with a base document, due date, and assigned agents.
- **Card**: a markdown document published in a channel, with title, type (`note` · `assignment` · `decision` · `answer` · `submission`), author (person or agent), version, sources (messages or source files), "replaces" when applicable, and a visibility chip (*channel members* or *only me*). Actions: open in the right panel, edit (if you're the author), publish to another channel, view history. A published card also appears as a message-card in the channel's flow.
- **Base documents** for a channel: cards or files the professor uploads or selects in channel settings; on save, the channel's agent starts generating cards from them (state "compiling").
- Agent presence: *online*, *thinking*, *publishing a card*.
- States the product has to show: agent compiling; card new · updated · superseded; live answer vs. answer from a card; work channel active · submitted · archived; newly created channel with no cards; module empty · compiling · ready; report new · reconciled.
- **Modules and study data (`DECISIONS.md` §18, visible pages superseded by §21).** A **module** remains a persisted unit of the course with material, difficulty, compiled cards, feedback and reports. The former teacher `#modules` and student `#home` pages are no longer product routes. Runners and server workflows retain the data, and relevant results can surface as channel messages, citations and card-publication tiles.
- **Report rule.** After advising a student, the agent files a report to the teacher with *its own* summary and a recommendation for the module — never the student's messages — and the student sees on her screen that a summary was shared. The teacher **reconciles** a report into a `decision` card in the module's channel; the module shows a one-line revision.

## Capabilities and Constraints

- **Confirmed stack:** Vite + React 19 + Tailwind CSS v4 + shadcn/ui v4 (Base UI primitives) as the foundation, with a custom design system on top. Tauri packaging later. No SSR.
- **Deliverable:** a functional app with real agents — channels, cards, and at least one agent actually answering; the UI connects to that. It's not just a prototype with mocks.
- **Agents:** each agent runs in a **runner** belonging to whoever created it, running the provider's binary unmodified (`claude`, `codex`, `pi`); the credential (subscription or API key) lives with that binary, never in Ada (`DECISIONS.md` §14; rules verified in `research/2026-08-22-subscriptions-runners-buzz-pi.md`). Each agent has a name, avatar, instructions, provider/credential, and list of channels it participates in. There are **community** agents (created by the professor) and **personal** agents (created by a student for their private channel); the difference is a product distinction and must be visible.
- Agents publish cards using the same mechanism as a person.
- Fixed terminology (English): community, channel, work channel, thread, card, card type, base document, sources, "replaces", visibility, agent, members, submission, compiling, "from the file", module, material, difficulty (intro · core · advanced), feedback, report, reconcile, "Modules" (teacher view), "My study" (student view), owner token (claims the teacher on a deploy), invite link (single-use, mints a student).
- **Current out of scope (issue #1):** a broad permissions editor, notifications, grading, billing/SSO, email/password/OAuth, hosted runners, vector/global knowledge search, work-channel lifecycle, a separate mobile app, or broad settings/search surfaces. Multi-community tenancy and responsive web layout are implemented.
- Open decisions: name of the course's example agent (the seed still says "Ada" pending an explicit rename); the full permissions model.

## Brand Commitments

- **Name:** Ada (the product). Agents are many and carry proper names. The seeded example is still called Ada pending the explicit naming decision recorded in `AGENTS.md`; do not silently rename it.
- **Family reference:** Buzz and Berd (Block) for structure and for treating agents as members, with Ada's own design system.
- Visual constraints set by the founder (binding): no "AI app" look (no purple gradients, sparkles, or generic chat bubbles), no crypto look; serious, warm study-tool tone; serif with personality only for titles and card body text, sans for the UI; strong typographic hierarchy, few boxes and borders; cards look like documents and messages look like conversation, and that contrast is part of the design; agents are distinguished by avatar shape or typographic detail, not a badge; light theme by default.
- Decision from 2026-08-24 (`DECISIONS.md` §21): the visible shell follows the pinned Buzz desktop frame and density while preserving Ada's education content and deterministic two-eye agent figures. The 2026-08-22 **Card File** language still governs inline cards/citations and provenance, but its three-floating-panel/card-strip layout is no longer the mounted shell. Inter remains the operating/conversation face; Literata remains for archived card content; Geist Mono remains for code/version text.
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

## Agent experience update (2026-09-06; DECISIONS.md §25)

An agent is configured by its name, rules, and channels. Ada connects it
automatically using installation configuration. The mounted flow has no
runtime/model picker, credential input, or runner setup step. New communities
start with editable tutor and curator agents. Direct messages address the
agent implicitly; shared channels use mentions.
