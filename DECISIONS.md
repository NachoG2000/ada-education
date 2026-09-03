# DECISIONS.md — Ada Education

Full project context. Read it whole before touching code. Updated Sunday 08/23.

> **What this file is:** direction and ideas, with their history (superseded sections stay marked, never deleted). **It does not describe the current code.** The actual state of the code lives in `AGENTS.md` (repo map) and `openspec/` (spec of what's being built). The current scope is **§19** (open-source product for course-running organizations); §15 keeps the deployment shape it superseded; §14 is the future architecture.

---

## 0. Problem

This file is the solution. **The problem lives in `PROBLEM.md`**: four leaks through which a course's knowledge is lost (what was answered gets re-asked; questions go where nothing is kept; since 2025 they go privately to an AI that doesn't know the course; and when the semester ends nothing remains), who it hurts, root causes, and the eight criteria (§7) every feature has to meet. Evidence with sources in `research/2026-08-22-problem-impact.md`.

## 1. Vision

Every group of people who learn together builds up knowledge that mostly disappears: the explanation that finally made something click, the reason a decision was made, the question three people asked separately. We believe that knowledge should belong to the group, grow on its own, and outlive any single conversation. So we're building a place where humans and AI agents are members of the same community, where what gets understood once becomes something everyone can read, and where the agents remember alongside the people instead of starting over every time.

**Humans and agents learn together, and what they learn stays with them.**

Three commitments that don't change:
1. **Agents are members.** Their own identity, they belong to channels, they sign what they write. The community creates them, not the platform.
2. **Knowledge lives in files the group owns.** Readable, versioned pages with sources. Nothing the group can't `ls`.
3. **Compiled once, composed every time.** The expensive part is reading the raw sources and understanding them, and that happens only once: the result is cards connected to each other (topics, decisions, difficulties), not a list of answers. Every answer is composed fresh from the cards, tailored to whoever asks, without going back to the sources. **It is not an answer cache:** the second person asking "the same thing" asks it with other words and another gap, and what serves them is a new answer built from what the group already understood, perhaps connecting two cards the first person never needed together. If the new angle wasn't covered, the card is enriched; a duplicate isn't born. The memory compiles, it doesn't accumulate.

## 2. Theses to prove

1. The UI of the future is **Buzz** (Block) with agents as members, channels and permissions. Buzz is the single reference; we don't compare against Slack.
2. Memory (second brain / company brain) works on the **filesystem**, not in a DB. References: Karpathy's LLM wiki, Stash (Fergana), Archil. Counterpoint: Cortex (relational DB + compiled world model). Here we prove the opposite.
3. **Education** is a good domain: a course is a group of brains with channels, decisions and knowledge that gets lost every semester.

## 3. What Buzz is (and why we'd fork it)

Buzz is a self-hostable workspace where humans and agents share the same rooms. It's a Nostr relay: every message, reaction, workflow step and git event is a signed event in a single log, with the same shape, identity and audit trail whether it's a person or a process. Backend on PostgreSQL (events + full-text search), Redis (pub/sub) and S3/MinIO for media; desktop client on Tauri + React; server in Rust. It speaks NIP-01, NIP-42 (auth) and NIP-34 (git). It works today: relay, channels, threads, DMs, canvases, media, search, audit log, desktop app, buzz-cli, ACP harness for Goose/Codex/Claude Code, workflow engine, agent personas and teams, huddles. In progress: mobile (Flutter), approval gates, push. Pending: git hosting, web-of-trust, emojis/polls, E2E in DMs. It has multi-community mode (host-scoped tenants) and one-click relay deploy to Railway. Apache-2.0 license.

**How agents come in.** The `buzz-acp` harness listens for @mentions on the relay, passes the prompt to the agent, and the agent replies using the Buzz CLI. Buzz Desktop lets you register any runtime that speaks ACP: Goose, Claude Code, Codex and Buzz Agent are tier-1 with installers and onboarding; Cursor, OpenCode, OpenClaw and others are presets.

**Why this changes everything for us:** the course agent can be **Claude Code (or Codex) running in the wiki folder**, invoked by `buzz-acp` on every @mention, replying through `buzz-cli`. The harness, the agent identity, the channels, the threads and the canvases already exist. Our work is the wiki, the agent's skill, and the "course" layer over "organization".

**Forking rules.** Apache-2.0 allows forking, renaming and commercial use. `LICENSE` and `NOTICE` with Block's attribution must be kept, and "Buzz" can't be used as the product name (trademark). Block doesn't accept external PRs; irrelevant for a fork. Berd describes "distribution seams" so third parties can build their own distributions; check whether Buzz has the same before modifying the core.

**Product name:** Ada Education (to be confirmed). The example agent is called Ada.

## 4. Product model: open-core, like Buzz

- **Open source (Apache-2.0).** Any teacher or institution can run it for free: relay + desktop + agents with their own API key or their Claude/Codex subscription (buzz-acp already supports the runtimes).
- **Three ways to run it**, the same as Buzz: (a) fully local with `docker compose` + desktop app; (b) self-hosted relay on Railway in one click + desktop app; (c) **hosted** (premium): multi-community relays managed by us, onboarding by link, managed agents, no setup.
- **There is no "own API" besides the relay.** The relay is the API. A web client, if built, speaks Nostr to the relay just like the desktop.
- **Future premium:** hosting, managed agents (with our API keys, never with users' subscriptions: see §14), wiki backups, course analytics for the institution.

Answer to "local and self-hosted, or easy web?": **both, because Buzz already separates relay from client.** The hackathon demonstrates (a). The product sells (c).

## 5. Entities (Buzz → course)

> Historical table: it maps Buzz concepts to ours. Still useful as a dictionary, but there's no Buzz in the stack anymore (§14); "Canvas" today is the published card in our server.

| Buzz | Ada Education | Note |
|---|---|---|
| Community | Course | One relay / one tenant = one course (multi-community later) |
| Channel | Stable channel (`#general`, `#questions`, `#03-backprop`) | One per module |
| Branch-as-room (volatile channel) | Work channel (assignment, exam) | Born from an assignment, archived on close. **Design only this weekend.** |
| DM | Private channel student ↔ personal agent | |
| Canvas | Card | Type, author, version, `sources`, `supersedes`, visibility |
| Agent (persona + runtime) | Course agent / personal agent | The teacher creates course agents; each student can create a personal one |
| Member / role | teacher · student · agent | |
| Media upload | Channel base document | The teacher uploads it in channel settings; the agent ingests it |

**UI:** same three-panel layout as Buzz and same components, so it feels familiar. Changes only where the course demands them: the channel's card strip, the "answered from a card" marker, the agent sheet with "which channels it's in / which cards it published", work-channel status. Style in `DESIGN.md`.

## 6. Memory model

Three layers, like a traditional LLM:

| Layer | Where it lives | Who writes it | When it's read |
|---|---|---|---|
| **Immediate** | last N messages of the channel/thread, sent by the server with each mention | everyone | on every agent reply |
| **Wiki (compiled)** | filesystem, the agent's folder | only that agent | on every reply (reads `index.md` + ≤5 cards) |
| **Raw** | filesystem, base documents and uploads | humans | on ingest |

**Ingest is not per message.** Triggers: explicit `@agent ingest`, or every N=20 messages in a channel, or daily. Between ingests, the agent answers with the immediate layer + the wiki, and archives reusable answers as cards on the spot. That keeps the wiki "current" without recompiling per message.

```
data/<course>/
  raw/<teacher>/modules/<nn>-<slug>/...
  raw/<student>/...
  agents/<agent>/
    wiki/
      index.md
      log.md
      modules/<nn>-<slug>/<topic>.md
      decisions/<date>-<slug>.md
      questions/<slug>.md            ← how a topic was asked (index of angles), points into modules/; not a Q&A log
      difficulties/<module>.md        ← aggregate per module, visible to the teacher
    about/<student>.md                ← what the agent knows about each student
  people/<student>/wiki/              ← written by the student's personal agent
```

**Permissions = folder composition.** Each agent sees a virtual tree with the folders of the channels it belongs to + its own. If it's not mounted, it doesn't exist. Archil does exactly this (mounted layers with permissions); for the weekend, a local directory with the same structure; Archil if step 7 is done in time.

**Who sees what (decision):**
- The teacher sees everything written by the agents **they created**: wiki, `difficulties/`, `about/<student>`. They don't see private channels or `people/<student>/wiki`.
- The student sees the course wiki, their `about/` and their personal wiki.
- General rule: **whoever creates the agent sees what the agent writes.**

**Versioning:** one git commit per ingest. `git diff` = "what the agent learned this week".

**Frontmatter:**
```yaml
---
type: topic | decision | question | assignment | submission | difficulty | person
title: ...
valid_from: 2026-08-22
supersedes: decisions/....md
sources: [raw/martin/..., nostr:<event-id>]
updated: 2026-08-22
---
```

**Agent rules (they go in its CLAUDE.md / AGENTS.md):**
1. Before answering, read `index.md`. Open at most 5 cards.
2. Every answer cites cards by path.
3. Compose from the cards, never paste a previous answer. If the question brings an angle the card didn't cover, enrich the card (new section or link); don't create another card for the same thing.
4. Archive as a card only what another student could need: the concept, the connection or the difficulty, not the conversation.
5. Never write outside your folder.
6. If a source contradicts a card: new card with `supersedes`, don't edit the old one. (Enriching ≠ contradicting: adding an angle is editing; changing a fact is replacing.)
7. Publish new cards as a canvas in the channel (`buzz-cli`), with a link to the file.

## 7. Stack and architecture

> **Superseded on 08/22 19:45 by §14.** The Buzz fork didn't happen before the 14:00 checkpoint; Plan B runs with the §14 topology. The memory model (§6) doesn't change.

```
Buzz relay (Rust, docker)  ←──Nostr/WS──→  Buzz Desktop (Tauri + React), forked and renamed
        ↑
   buzz-acp (harness)  ──@mention──→  Claude Code / Codex
                                       cwd = data/<course>/agents/<agent>/
                                       CLAUDE.md = section 6 rules
                                       tools = filesystem + buzz-cli
                                       (Archil mount when ready)
```

- The agent **is** the CLI (Claude Code or Codex) with a `CLAUDE.md`/`AGENTS.md` and an `ada-wiki` skill. This satisfies the requirement: everything can be worked from Claude Code or Codex, and a teacher can use their subscription instead of an API key.
- Desktop customization: minimal. Course channel presets, card strip (canvases filtered by `page` tag), "from a card" marker, agent sheet.
- Agent → UI communication: `buzz-cli` for messages and canvases. No new endpoints.

**Plan B (if Buzz's `just dev` doesn't come up before 14:00):** our own app for messages + the same `data/` on the filesystem + Claude Agent SDK. The memory model and the skill are identical; only the shell changes.

## 8. Discarded

- **WDK, QVAC, Pears (Tether tracks).** Each forced a technology (wallet, local inference, Bare runtime) that put the risk in the infrastructure instead of the product. Pears fit the memory thesis well (Hyperdrive, permissions = keys); it remains a future experiment.
- **Building the chat from scratch.** Buzz already has relay, desktop, agents and canvases.
- **Slack as a reference.** The reference is Buzz.

## 9. Out of scope this weekend

> Extended by §15: also out of the weekend are creating agents from the UI, students' personal agents, tokens/hosting and everything multi-tenant. And "web client" below is reversed: the client **is** the web (this SPA); what doesn't exist is the desktop.

Submission grading · collaborative card editing · vector search · multi-course · permissions screen · revocation · work channels (design only) · mobile · web client (the desktop is the client).

## 10. Build order

> **Superseded on 08/22 by the OpenSpec change** (`openspec/changes/demo-local-backend/tasks.md`), which is the current order under the §15 scope. Steps 1-2 (Buzz) didn't happen; the rest survives in another shape.

1. **Bring up Buzz** (`just dev` or docker). Relay + desktop running. Two people chatting. *Until 14:00 or Plan B.*
2. Fork + rename + course presets: `#general`, `#questions`, `#03-backprop`, teacher/student roles.
3. "Ada" agent via `buzz-acp` with Claude Code, cwd in `data/<course>/agents/ada/`, `CLAUDE.md` with the rules. Answers an @mention in a thread.
4. `ada-wiki` skill: ingest of one md from `raw/` → cards + `index.md` + `log.md` + commit. Publish a card as a canvas.
5. Query with citations + archive the answer. Card strip in the channel.
6. Second similar question → "answered from a card", visual marker.
7. Decisions with `supersedes`. `difficulties/<module>.md`.
8. Personal agent: a student creates theirs from Buzz's agent UI; private channel; `people/<student>/wiki`.
9. Archil as the `data/` mount if 1-8 are done before 02:00.
10. Lint if time remains.

Cutoff: Sunday 04:00. After that, only video and README.

## 11. Demo script (3 min)

1. Martin opens the course, invites Sofia and Ignacio. (20s)
2. He creates Ada, adds her to `#general`, `#questions`, `#03-backprop`. She shows up as a member. (20s)
3. He uploads `backprop.md` as a base document. `@Ada ingest`. Cards appear in the strip. (20s)
4. Sofia asks in `#questions`. Ada answers in the thread, citing. `questions/...` appears. (30s)
5. Ignacio asks "the same thing" with other words and another gap. Ada answers **from the card file**: composes from two cards, without re-reading the notes, and the card gains a section with the new angle. (20s)
6. Martin announces the midterm moves. `decisions/...` appears with the rationale. (20s)
7. Sofia creates her personal agent; asks it for a plan; it appears in her wiki. (20s)
8. Terminal: `ls data/` + `git log`. "This is everything the course knows, in markdown." (20s)
9. Close: humans and agents learn together, and what they learn stays with them. (10s)

## 12. Open questions

- Final product name.
- ~~Does Buzz have "distribution seams" like Berd?~~ Closed: we're not forking Buzz (§14).
- ~~Do Buzz canvases support full frontmatter?~~ Closed: the card lives in the agent's file; the server stores the published copy (§14.6).
- N for automatic ingest (start with 20).
- ~~Archil: one mount per agent or a single mount for the weekend?~~ Closed: no Archil this weekend; local directory, isolation layers in §14.7.

## 13. Timeline

- Sat 12:00 — kickoff. Step 1.
- Sat 14:00 — checkpoint: Buzz up or Plan B.
- Sat 18:00 — checkpoint: steps 1-4.
- Sun 00:00 — checkpoint: steps 5-8.
- Sun 04:00 — cutoff.
- Sun 12:00 — close. Judging 13:00–17:00, async demo.

## 14. Agent topology: identity + folder + runner (08/22, supersedes §7)

Decision taken after verifying Anthropic's rules, Buzz's architecture and pi.dev (`research/2026-08-22-subscriptions-runners-buzz-pi.md`). Implementation spec: `openspec/changes/demo-local-backend/`.

**An agent = an identity in the community + a folder (wiki) + a runner.** The community only knows identity, membership and published cards. Where it runs, with which model and which credential is the runner's problem, and the runner belongs to whoever created the agent.

```
            community server (Railway / ours)
            messages · members · channels · published cards · NEVER inference
                   ▲                  ▲                    ▲
      WS + agent   │                  │                    │
      token        │                  │                    │
   runner on the student's/   runner on the teacher's   runner hosted by us
   teacher's laptop           Railway                    pi + open model, or Claude/GPT with API key
   claude/codex (subscript.)  claude (setup-token)       premium · always on · billed
   or pi + Ollama             free · always on
   free · offline if shut
```

Analogy: GitHub Actions runners, self-hosted or hosted.

1. **The server never executes models.** It's a bus + storage. We don't broker anyone's credentials (complies with Anthropic), we don't pick a provider for the user, hosting it is cheap.
2. **The runner is a separate, pluggable process** (`ada-runner`): it connects outbound with the agent's token, receives mentions, spawns the runtime with `cwd = the agent's folder`, publishes the answer and cards. Runtime = `claude` | `codex` | `pi` | `goose`. Open models come in via pi (Ollama, OpenRouter, vLLM). "Detect your agents" = see which binaries are on PATH.
3. **Whoever creates the agent runs it and sees what it writes.** The teacher creates community agents; each student, their own. Creating = identity + folder + token. Connecting = pasting one command.
4. **Online/offline is product state.** Disconnected runner = agent shown "disconnected" in the UI. No mention queue. The fix for "the laptop shut down" is point 5.
5. **Hosted = our runner with API keys, never with other people's subscriptions.** BYO key or ours with margin. Open model as the cheap default; Claude/GPT premium. This is where it's billed (per token or per seat: pending).
6. **The wiki lives where the runner lives; the server stores the published copy.** Real privacy for personal agents; export for hosted.

7. **Isolation in layers, per tier.** (1) *Policy*: `cwd` in the agent's folder, `--add-dir` only for `raw/`, a narrow `--allowedTools`, and `deny` path rules in the folder's `.claude/settings.json`; enough for the local tier (on your machine everything is yours) and for this weekend. (2) *Wall*: one container per agent with `raw/` read-only and its folder read/write; for hosted v1, no new services. (3) *Composition*: a virtual tree per agent with the folders of its channels (§6, "permissions = folder composition"), with bind mounts and, multi-machine, Archil. Archil gives the composed view, not the isolation; it's hosted-only and thus stays in the hosted tier. Explained with diagrams in `docs/how-it-works.html`.

Don't do: have the server call models "for convenience"; ask for Claude tokens in our UI; design around a single provider.

**Plan B in concrete terms (this weekend):** `apps/server` (Node 24 + Hono + `node:sqlite` + WS), `packages/runner` (CLI, `claude -p` runtime), `packages/protocol` (types + events), `apps/web` (the current SPA), `data/<course>/` (wiki). All local on one laptop. Details in the OpenSpec change.

## 15. Scope pivot: a custom build for one specific teacher (08/22, afternoon — superseded by §19, and by §21 for UI/configuration)

Mentor's advice, adopted: *"I'd rather have a narrow system — like a custom build for one particular teacher, running on their machine — than a complete, scalable one."*

**What it means for the weekend:**
- We build Ada as if it were a custom build for **one concrete teacher**: everything runs on their machine (server + runner + web client on localhost; students could join over LAN, but the demo is one machine).
- The course, channels, people and agent are defined in a config file (`data/<course>/community.json`), not from the UI. No agent creation from the UI, no student personal agents, no hashed tokens, no multi-course, no hosting.
- The server / runner / agent-folder separation **stays** (§14): it's cheap today and it's what allows growing later without a rewrite.
- Demo script (§11): the core is steps 1-6 and the terminal close (`ls data/` + `git log`). The personal-agent step (7) is an extension only if time remains.

**Where each thing lives after this pivot:**
- The **code and its truth**: `AGENTS.md` (map, commands, actual state) + `openspec/changes/demo-local-backend/` (spec of what's built today).
- The **full future architecture** (remote runners, tiers, hosted, open source at scale): §14 of this file + `docs/how-it-works.html` and `docs/usecases-api.html`, which are **future inspiration, not a description of the code**.
- Every area of the repo carries its own short `AGENTS.md`: what it is today, and how it grows tomorrow. Rule: if you touch the area, keep that file current.

## 16. Pitch positioning: broad open source, with premium as a sequence (08/22, night — confirmed)

Two options were on the table for the Aleph pitch: **(A)** monetize by targeting top private schools; **(B)** open source for the broadest possible reach (contributors, teacher-by-teacher adoption), monetizing later via hosting. Full evidence in `research/2026-08-22-open-source-vs-premium.md`.

**Decision: B as identity and pitch, with A as a future chapter of the hosted tier.** Reasons:

1. **The evidence all loads one way.** B's precedents work and have names (Moodle: free 2002 → MoodleCloud + partners → tens of millions in revenue; WordPress: GPL 2003 → WordPress.com 2005 → VIP enterprise 2012; GitLab, Supabase, Ghost). For A there's almost no data and what exists points against: 6-18 month sales cycles with committees, and no evidence that a 2-person team without a brand is credible in that channel.
2. **A and B don't compete: they sequence.** It's literally what §4 already says ("the hackathon demonstrates (a) local; the product sells (c) hosted"). The elite school is an early customer of hosted (managed agents, backups, institutional analytics), not the hackathon pitch.
3. **The Aleph judges score Technicality, Originality, UI/UX/DX** — not business model. Narrative B targets all three; a sales projection to top schools adds no points and opens flanks.
4. **Coherence with everything already decided:** Apache-2.0 (§4), the runner topology that makes free self-hosting possible (§14), the mentor's pivot to "a custom build for one teacher" (§15), and the thesis itself ("knowledge lives in files the group owns" sits badly with a closed product for elites).
5. **The Kahoot warning stays noted:** the teacher in love doesn't pay. Who pays is the institution that wants hosting and support — hence the model is Moodle (institution pays hosting), not per-teacher freemium.

**Positioning line for the pitch:** "Open source like Moodle, architecture like GitHub Actions runners: any teacher runs it free on their machine today; institutions will pay us for hosted tomorrow."

Counterexamples that demand good execution, not doubt about the direction: Sakai (community without a commercial engine → decline), Cal.com (closed up in 2026), Open edX (flat adoption). The lesson of all three: open source without a commercial owner of the hosting dies; hosted is not optional in the roadmap.

Status: **confirmed by Ignacio on 08/22 (night).** The pitch is built on this section + `PROBLEM.md` §8 ("why now" on four verified legs) + §9/§10 (what not to say and which numbers not to use).

Details settled while building the slides (08/22, see `research/2026-08-22-aleph-submission-and-pitch.md`):
- The organizer's rules require a **3-minute demo video** and list **five** judging criteria (Practicality and Presentation join the three in point 3), which reinforces this narrative and justifies investing in slides and editing.
- **Slides in English.** ~~The product on screen stays in Spanish.~~ Superseded by §17: the whole product is in English. Video structure and script: `pitch/SCRIPT.md`.

## 17. Language: the whole repo and product move to English (08/22, night)

Decision by Ignacio: **everything in the repo is in English** — documents, code comments, identifiers, UI strings, demo data, file and folder names. Rationale: Aleph's judging is async in English or Spanish *with English captions* and the jury is international; the pitch (§16) is open source with the broadest possible reach, and a single language across product, code, docs and pitch removes friction for contributors and judges alike.

What changed with this decision:
- **Terminology:** «ficha» → **card**; «el fichero» → **the card file** (the design system's name); the seal reads **"already on file · N days ago"**. Card types: note · assignment · decision · answer · submission (+ topic · question · difficulty · person in the wiki frontmatter). States: new · updated · superseded · compiling.
- **Code:** the `Page` domain type → `Card` (and derivatives), design tokens `sol/sello/alerta/estado-*` → `sun/seal/alert/status-*`, `FIGURE_COLORS` names in English, demo course renamed to "Neural Networks 2026" (`data/neural-networks-2026/`), hash route `#figures`, locale `en-US`.
- **Research** was consolidated as of today: one corpus of session files dated 2026-08-22, in English. External sources keep their real publication dates.
- The §16 note that the on-screen product stayed in Spanish is superseded: the product is in English too.

The repo rule lives in `AGENTS.md` ("Language"). Fixed English terminology in `PRODUCT.md`.

## 18. Modules, study material, feedback and agent reports for the teacher/student demo (08/23, early morning — visible pages superseded by §21)

Request by Ignacio for the demo flow: the teacher loads modules and study material on a dedicated page with a difficulty adapted to the course and its students; the student sees the agent's feedback on the last assignment, learns the module that slipped and asks the agent how to get ahead; the agent tells the teacher what it advised; the teacher reconciles it into the subject. Everything mocked, but "the agent really answers and it doesn't feel hardcoded". The implementation remains in repository history and the decisions below preserve its product contract.

**Decisions:**

1. **The mock is a runner runtime, not a UI trick.** `ada-runner --runtime scripted` speaks the same `/ws/runner` protocol as the `claude` runtime, writes cards into the agent's `wiki/` and publishes them through the same diff → `card.publish` path, announces the same presence, and fills its answers from the live community snapshot (module titles, material headings, the student's feedback gaps, the difficulty the teacher set). What it can't fill from state it says it can't. `npm run dev` starts it by default; `ADA_RUNTIME=claude npm run dev` runs the real one. The UI and the server do not know which runtime answered — which is the point of §14.
2. **A per-student report, transparent to the student.** `docs/usecases-api.html` UC8 and `PROBLEM.md` §7.5/§9 keep teacher-facing difficulty signals aggregate. This flow needs the teacher to see what the agent advised one student, so it can be reconciled into the module. The rule that makes that acceptable: the report is **the agent's own writing** (its summary and its recommendation for the module) — never the student's messages — and the plan the student receives ends with a visible line that a summary was shared with the teacher. §6 already grants the creator of an agent what the agent writes. This partially supersedes UC8's "no student ids" for the teacher's own course agent; the aggregate `difficulties/` view stays the right shape for anything beyond one teacher's course.
3. **Difficulty is the teacher's; the agent suggests.** A module carries `difficulty {level: intro · core · advanced, rationale, evidence}`. After compiling material the agent proposes a level with a rationale and cohort evidence ("2 of 3 students slipped on σ′ in Assignment 2"); the teacher's hand-set level always wins. This is the honest version of "adapted to the course and the students": the adaptation is visible and reviewable, not an invisible per-student personalization (`PROBLEM.md` §9 still stands).
4. **Reconciliation lands as a `decision` card in the module's channel**, authored by the teacher, listing the accepted recommendations and the teacher's note — so "improving the subject" is a card anyone in the course can read, and the module shows a one-line `revision`.
5. **Views, not screens.** `#modules` (teacher) and `#home` (student) are views of the same shell (sidebar + channel panel + context panel); `Person.role` gates them; "Switch person" in the sidebar footer returns to the picker. No router was added.

**New fixed terminology (English):** module · material · difficulty (intro · core · advanced) · feedback · report · reconcile · "My study" (the student's view) · "Modules" (the teacher's view).

**Out of scope, still:** grading, permissions, notifications beyond the `#teachers` message and the report list, PDF parsing (a PDF uploads as a placeholder; markdown is read), per-student personalization of content.

~~**Next, decided but not built (08/23, morning):** the demo language flips to **Spanish (rioplatense, voseo)** as the default — UI strings, seeded course content and the scripted runtime's templates — with English behind a query parameter (`?english=true`).~~ **Superseded the same morning:** Ignacio dropped the Spanish localization; the product stays in English (§17). Nothing was implemented.

## 19. Product focus: open source for course-running organizations (08/23)

The Aleph 2026 hackathon phase closed on 08/23: the code cutoff passed and the demo flow of §18 was built and verified. The `demo` branch was merged into `main` and deleted; from here the repository is the product, not a demo.

**Direction:** Ada is an **open-source product** for **organizations that run cohort-based courses — bootcamps, academies, corporate training programs, universities**. This extends §16 from pitch positioning to product direction: the open-source route — contributors, teacher-by-teacher and organization-by-organization adoption, hosting as the later commercial engine — is now how the product is built, not just how it was pitched.

**Named targets: none, on purpose.** No specific organization is named anywhere in the repository; the audience is always described in the generic terms above. Conversations with any particular organization live outside the repo until they become a decision recorded here.

**License:** Apache-2.0, reaffirming §4 — the `LICENSE` file ships at the root.

**What §15 keeps:** the deployment shape. The code today still runs fully local on one machine (server + runner + web client), and local-first remains the free tier of §14/§16. What changes is the frame: it stops being "a custom build for one specific teacher this weekend" and becomes the open-source product any of these organizations can run.

Backing: `research/2026-08-22-open-source-vs-premium.md` (open source vs premium evidence), §4 (license), §16 (positioning line and counterexamples).

## 20. Railway one-click template: identity by tokens, runner outside (08/23, night)

Decided with Ignacio after verifying how Buzz ships its relay template and what
Railway allows (`research/2026-08-23-railway-deploy-template.md`,
`research/2026-08-23-buzz-identity-and-agents.md`,
`research/2026-08-23-shared-filesystem-on-railway.md`). This is §4(b) made
concrete: the self-host rung between the laptop and hosted.

1. **One deploy = one course community.** An organization runs N cohorts as N
   deploys. Multi-course stays future direction (§9, §14).
2. **Identity copies Buzz's pattern, with plain tokens instead of Nostr keys.**
   A deploy-time **owner token** claims the teacher (`POST /api/claim`, always
   recoverable, rotates the teacher's token); the teacher mints **single-use
   invite links** (`#join?token=…` → name → student); members live in the
   server's DB and **membership gating is an explicit flag**
   (`ADA_REQUIRE_MEMBERSHIP`, off for local dev, on in the template — Buzz
   ships open-by-default, we don't). Students don't manage keypairs: a
   bootcamp student who loses an `nsec` loses the identity; a lost Ada token
   is one invite away.
3. **Runners stay outside the deploy by default** (the teacher's machine,
   their own `claude` login; `https://` → `wss://` already works). The
   template offers an **optional runner service** where the org pastes its own
   `ANTHROPIC_API_KEY`: the credential lives in *their* Railway project,
   never with us — §14's "the server never runs models" holds in every shape.
4. **No shared filesystem.** Railway forbids FUSE/privileged mounts and
   volumes are one-per-service, so the Archil-style composed view stays in the
   hosted tier (§14.7 layer 3). What crosses machines crosses over HTTP: the
   server serves material content and the runner syncs its local `raw/`
   before an ingest. Git remains the folder's own sync/audit layer.

**What this changed in the code:** the server serves the built SPA same-origin
(one public service) plus `/health`; claim/invite/join endpoints and
token-derived authorship under the gating flag; `member.joined` in the
protocol; the runner's material sync; `deploy/` (Dockerfiles, entrypoints,
runbook); `npm run check:gated` covering all of it. Publishing the template in
Railway's dashboard is a manual step in `deploy/README.md`.

## 21. Buzz desktop as the SPA interaction reference; chat and configuration first (08/24)

Decided by Ignacio after cloning and mapping Buzz at commit
`0720f5380ce8a6c050afac159f8462c06cd51ab5`. The source-backed inventory is
`research/2026-08-23-buzz-ui-map.md`; implementation findings are recorded in
`research/2026-08-24-buzz-parity-implementation.md`.

1. **Buzz is the visible UI and interaction reference, not Ada's backend.** The
   SPA reproduces Buzz's fixed gradient frame, compact top chrome, collapsible
   sidebar, rounded content surface, channel timeline/composer, thread panel,
   command palette, channel management, Agents catalog and Settings density.
   §14 is unchanged: Ada keeps its TypeScript server, SQLite, shared protocol,
   agent folders and external runners. No Rust/Tauri, Nostr identity/relays,
   repository runtime or provider credential code is imported from Buzz.
2. **The visible product is chat and configuration first.** The routes in this
   phase are Inbox, channels, Agents and scoped Settings. The dedicated
   **Modules**, **My study** and standalone **Card File/document** pages from §18
   leave the navigation and routing. Module, feedback, report and card data stay
   in the server/runner knowledge pipeline and may appear as inline conversation
   publications or citations; history is not deleted.
3. **Channels and agents are created and configured from the UI.** This
   supersedes §15's configuration-file-only limitation. Channel group,
   visibility, membership, agent assignment, work state and archive lifecycle
   persist in SQLite. Agent identity, scope, instructions, runtime/model label,
   figure, assignments and status persist in SQLite; creation/rotation yields an
   Ada runner token/setup command, while provider access remains only in the
   external runner's environment (§14, §20).
4. **Deletion never wins over course history.** A non-empty channel is archived,
   not cascade-deleted. An agent with authored history is deactivated, not
   erased. Private channels are filtered by the server across snapshot, REST,
   search, attachment access and WS delivery; hiding them only in React is not
   sufficient.
5. **Scope boundaries are explicit.** Buzz Canvas/documents, Pulse, Projects and
   repositories, Workflows, Reminders, huddles/voice, Nostr onboarding, hosted
   community administration and agent-harness/provider-key configuration stay
   out. Ada also does not add grading, broad permissions, billing, SSO,
   notifications, multi-course tenancy, vector search or personalization.
6. **Connected mode is the working product.** The default local/deployed SPA
   performs real REST/WS/SQLite mutations. `npm run dev:demo` remains a clearly
   labelled read-only synthetic preview rather than growing a second fake CRUD
   implementation.

This section supersedes only the UI/page and static-configuration parts of
§§15/18. It does not reopen the memory model, agent name, `fromCard` semantics,
local server/runner topology, open-source direction or Railway deployment
decisions.
