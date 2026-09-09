# DECISIONS.md — Ada Education

Full project context. Read it whole before touching code. Updated 09/05.

> **What this file is:** direction and ideas, with their history (superseded sections stay marked, never deleted). **It does not describe the current code.** The actual state of the code lives in `AGENTS.md`. The current scope is **§22–§24** (hosted foundation, completed interaction parity, and repository consolidation); §19 was the open-source framing it superseded; §14 remains the architecture.

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

## 21. Buzz desktop as the SPA interaction reference; chat and configuration first (08/24 — superseded by §22)

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

## 22. Pivot: a hosted service to sell, demo first (09/03)

Decided with Ignacio on 2026-09-03. Tracked in GitHub issue #1
(https://github.com/NachoG2000/ada-education/issues/1), which holds the scope
and checklist. Background:
`research/2026-09-01-buzz-fork-vs-own-frontend.md` and
`research/2026-09-01-strategy-scoped-agents-group-brain.md`.

**The objective for the next weeks is a demo worth showing, on a date**, not
the product shape argued in the September memos. The hackathon UI is not what
we want and polishing it by taste has failed twice; the simplest
implementation that can be demoed end to end wins.

1. **Product shape: a hosted service sold by subscription** to institutions
   with budget (schools, universities). This supersedes §19's open-source,
   local-first framing as *the* product. Whether the public Apache-2.0 repo
   stays as open core or goes private was an open question in the issue. **Repository visibility is resolved by §24: keep the public Apache-2.0 repository.**
2. **Runners by environment.** Development and tests use a **local runner
   with the developer's own Claude or Codex subscription** (no API tokens
   spent; the pattern §14 already allows). Production uses **hosted runners
   with our provider keys, billed by usage** (§14.5's hosted tier). §14's
   invariant holds in both: the server never runs a model; the runner stays
   a separate process.
3. **User identity is independent of membership.** A user has one session
   (a user token); a community has members with a **role per community**
   (teacher in one, student in another); one deployment hosts **many
   communities**; invites are simple codes, no emails. This supersedes
   §20.1 ("one deploy = one course community") and the per-community member
   token of §20.2.
4. **UI = Buzz's shell, no more, no less, in default shadcn styles.** No
   differential UI and **no cards UI**: the card strip, the "already on file"
   seal, folded tabs, channel types and `DESIGN.md`'s named rules are
   **paused**, not deleted. The agent's memory (§6) stays in its folder;
   whatever it publishes is not rendered in this phase. Styles come after
   CRUD works. `research/2026-08-23-buzz-ui-map.md` is the inventory to copy.
5. **Everything is created from the UI**: communities, channels, members
   (invite codes, roles), and agents. This supersedes §15's "defined in a
   config file".
6. **What stays**: the memory model (§6), protocol/server/runner separation
   (§14), the Railway deployment work (§20), and the thesis in `PROBLEM.md`.
   The strategy memos of 09/01 (scoped agents, chat as commodity, adapters)
   are future direction, not this implementation plan.

**This phase is a local demo**: no deploy, billing, or video yet — foundations
first. No grading, broad permissions, OAuth, hosted runners, proactive loops,
cohort inheritance, search, notifications, or mobile-specific product work.

## 23. Buzz interaction parity before any styling (09/03; implemented and QA'd 09/04)

Decided with Ignacio on 2026-09-03, after issue #1 closed. Tracked in GitHub
issue #3 (https://github.com/NachoG2000/ada-education/issues/3, the spec) and
issue #4 (https://github.com/NachoG2000/ada-education/issues/4, QA of the
Ada-only use cases). Spec: `openspec/changes/archive/2026-09-05-buzz-interaction-parity/`.
Evidence: `research/2026-09-03-buzz-interaction-inventory.md`.

**The problem is not the components, it is how they interact.** The issue #1
shell copied Buzz's layout but not its interaction grammar: where Buzz opens a
dialog, Ada shows an inline input; where Buzz has an Agents page, Ada has a
sidebar section and a sheet; where Buzz has routes, Ada has component state.
"Improving the UI by taste" has already failed twice (§21, §22); mirroring a
product that has solved these interactions is the cheaper path.

1. **Buzz is the interaction default for every shared use case, not the visual
   default**: same entry point, same
   container (dialog / auxiliary panel / route / popover / hover toolbar), same
   landing after success, same confirmation rule. Ignacio reconfirmed during
   implementation that the mounted UI stays deliberately simple: default
   shadcn surfaces, borders, spacing, and states, without Buzz's gradient,
   inset-window treatment, or decorative styling. The full interaction mapping
   is `design.md` §7.
2. **Revises §22 in three places**: a standalone **Agents page** (`/agents`),
   a **Settings route** with scoped sections (Profile, Community, Members,
   Invites, Shortcuts, Account) and a **⌘K palette** over channels, DMs,
   people, agents and actions are now in scope, because Buzz has them as the
   entry points of use cases Ada already has. Message search, notifications,
   reactions, attachments, mute/star and every Buzz feature the hosted
   protocol lacks stay out.
3. **Deliberate deviations** (`design.md` §9): destructive actions keep a
   confirmation even where Buzz has none; community settings live in the
   Settings route; invite codes mint on click, not on dialog open; sign-out
   confirms with one gate.
4. **Ada-only use cases use the approved baseline in `design.md` §8**: hide
   forbidden teacher controls; default invitations to student / three days /
   one use; show user and runner credentials once; expose student-agent DM
   privacy to the student and make the teacher view read-only; disable the
   last teacher's leave/demote/remove controls with an explanation; keep
   published cards visually unrendered; label the cohort field **Term**; keep
   deleted-agent DMs as read-only history. Issue #4's implementation QA is
   recorded in the issue research file.
5. **Resolved implementation choices**: use TanStack Router with file-based
   Vite integration; add authenticated profile PATCH, membership-role PATCH,
   and safe invite list/revoke routes; keep **Term** editable; do not render a
   card-publication system line. Schema version 5 adds invite mode/revocation;
   version 6 keeps the retained workspace agent projection compatible with
   the shared optional avatar URL.
6. **Implementation result**: the mounted shell follows Buzz's routes and
   task containers while retaining Ada's tenant, role, credential, DM, and
   external-runner boundaries. Responsive teacher/student testing used the
   production bundle at 1440, 1024, 767, and 360 pixels. The visual correction
   above is part of the decision: future parity work must not treat Buzz's
   appearance as a requirement.


## 24. Consolidate the public repository before expansion (09/05)

Ignacio confirmed that Ada should be a good public repository, then asked
to consolidate the existing work and leave it organized for expansion.
This resolves §22's repository-visibility question in favor of keeping the
public Apache-2.0 project. It does not reverse the hosted-service product
ambition or change the server/runner topology from §14.

1. **Consolidate the implemented foundation.** Align documentation with the
   routed tenant workspace, provide reproducible Node 24/npm setup, and
   expose one complete `npm run check` gate locally and in GitHub Actions.
   Reuse the existing protocol, server, runner, fixture, and build checks.
2. **Make the repository navigable.** The root README explains current
   behavior and startup; CONTRIBUTING explains changes and validation;
   `docs/architecture.md` maps active code; historical instructions and
   future HTML references are explicitly separated. Preserve old source
   and design history rather than deleting it during housekeeping.
3. **Close completed interaction planning.** Sync the completed Buzz-parity
   requirements into current specs and archive that change after validation.
   Preserve the older demo plan's unchecked historical tasks without
   claiming they were implemented under the current scope.
4. **Expansion remains a separate design step.** Course-memory behavior and
   its visible interface are a proposed next feature, not part of this
   consolidation. Define sources, admission, retrieval, correction, and
   visibility before implementing it. Personal memory and hosted runners
   remain future changes.

Verification and sources for this consolidation are recorded in
`research/2026-09-05-repository-consolidation.md`.


## 25. Agents work after creation; execution belongs to the installation (2026-09-06)

Supersedes the per-agent provider/model selection and manual enrollment UX in §§14, 21–23. The user explicitly requested a bot-like experience: create an agent, give it rules, and it works. For local iteration the developer's Claude login supplies execution; a future deployed installation uses an API key or another supported administrator-configured provider.

1. Teachers configure name, rules, and channel assignments. They do not select a model or copy a runner command. Creation opens the agent details; connection happens automatically. Existing deletion/history and role boundaries remain.
2. UI-created communities receive editable Course tutor and Knowledge curator agents. The same two templates are available alongside creating from scratch. These are new role labels, not a rename of the historical example agent Ada. Each copy has independent identity and memory; template updates do not overwrite it.
3. `npm run dev` starts a separate installation agent host alongside web/server. It enrolls agents through a dedicated authenticated installation endpoint, persists credentials privately, and manages per-agent workers and folders. A local host serializes model invocations. Provider execution remains outside the community server.
4. Keep the existing `claude -p` adapter. The SDK is not required for automatic lifecycle; revisit it for specific capabilities. Subscription mode remains the default. Explicit `ADA_PROVIDER_AUTH=api-key` requires a provider key on the runner host and must not silently fall back to subscription credentials.
5. DMs implicitly address their agent; channels require mentions. New work includes the latest saved rules. Deletion revokes access and stops the worker/provider while preserving history and the agent's local files.
6. This ships the local workflow and an authentication configuration boundary, not a managed hosting service, durable job queue, multi-host scheduler, or OS sandbox. New managed folders do not automatically import wiki files from older manually configured locations.

Rationale and verified official sources: `research/2026-09-06-agent-management-exploration.md`. Implementation and verification: `openspec/changes/archive/2026-09-06-automatic-agents/` and `docs/agent-host.md`.

## 26. One interface system and identity-aware mentions (2026-09-06)

Supersedes the default-shadcn-only visual restriction in §§23–24, while preserving the familiar interaction structure and paused Card File history. The user's educational constraints take precedence over random visual exploration. Inter, quiet green-gray surfaces, a four-point spacing rhythm, and semantic sizes are specified in DESIGN.md; the old design is preserved in docs/history/design-system-2026-09-05.md.

Settings, Agents, and future management screens share page-layout.tsx components for frames, headers, navigation, and action sections. Selected and destructive states are variants, not alternate layouts. Navigation icons are explicitly 16px; page titles are 20px. Narrow screens adapt the same components.

Mentions carry member IDs and render as inline chips. Tiptap Mention provides atomic editing, suggestions, and undo; Tab/Enter completes the active suggestion, Escape closes it, and Shift+Enter inserts a line. Only teachers may mention active community agents outside a channel. Sending atomically adds those agents and persists the message before dispatch; students may only mention agents already present. DMs do not recruit other agents. UI copy explains both the pending addition and history access. Merely selecting, drafting, or editing never adds an agent.

Research, user-provided screenshot, random-seed interpretation, and official documentation: research/2026-09-06-interface-system-and-mentions.md. This does not add hosted runners, new permissions, or memory UI.

### §26 follow-up: one persistent workspace shell

The user's follow-up audit found that shared headers alone did not satisfy layout consistency: Settings still replaced the workspace shell. Settings now retains the community rail, top controls/search, resizable course sidebar, and mobile navigation sheet. Its sections occupy the sidebar's contextual area; Back to channels restores the previous workspace route. This supersedes the earlier full-bleed Settings requirement in §23. Section changes still replace history entries. Search appears once in the top bar, with the existing keyboard shortcut, and is removed from expanded and compact sidebars.

Sidebar rows use a common 36px minimum height (44px narrow/touch), 14px labels and 16px icons; 12px is reserved for metadata. Hover uses the same sidebar-accent surface, and selected rows persist that surface with medium weight. The community switcher uses the same horizontal inset and a 56px minimum height for its two lines. Page content keeps a common left edge even where forms have a narrower maximum width.

**User clarification:** Settings replaces the entire sidebar content, not only the contextual channel list. Retain the shell geometry and top bar, but replace the community header, Agents/Settings primary links, channels, and profile footer with Back to workspace, Settings, and the role-aware sections. This applies to expanded, compact, and mobile navigation.

## 27. Public learning channels, contextual private support (2026-09-07)

The user approved implementation after the exploration in
`research/2026-09-07-education-surfaces-exploration.md`. This supersedes the
foundation-only exclusion of mounted educational artifacts and a personal Inbox
in §§22–24. It does not restore the historical memory-card UI or change §14's
server/external-runner architecture.

The human teacher's roadmap and content start in shared course channels. A
header Artifacts entry immediately before member avatars opens a collection in
the existing auxiliary panel, with individual artifacts replacing its contents.
The first module guide has a persistent preview above the conversation. Shared
objects use guide/explanation/practice/assignment templates; Markdown and
question blocks provide content flexibility without generated executable code.

Ask privately carries the chosen material/question into an editable agent-DM
draft, preserves existing drafts, and offers return navigation. No automatic
send or public posting of personal work occurs. Existing teacher-readable DMs
remain explicitly labeled. Personal work is owner-only; explicit assignment
submissions share immutable answer copies with teachers for human feedback.

Inbox is a real primary route for own incoming DMs, mentions, and replies to
participated threads, with separate persisted read state. Dedicated My learning,
Teaching and course-wide overview dashboards remain deferred. These templates
are manually authored; agentic memory, automatic artifact creation and inferred
learning progress require a later design. See `docs/educational-artifacts.md`
for the mounted workflow, refresh behavior and current limitations.

## 28. Evaluate Pi through the existing runner boundary (2026-09-07)

The user authorized implementing Pi before expanding course memory, following
`research/2026-09-07-pi-runtime-evaluation.md`. This adds an optional runtime to
§25; it does not replace §§6/14 or make Pi the default for every installation.

1. Pi runs externally through its documented noninteractive CLI, using its own
   ChatGPT OAuth login and the `openai-codex` subscription provider. The pinned
   package is installed with the runner workspace. `npm run dev:pi` selects it.
2. Agent identity, enrollment, scheduling, workspace paths, wiki publication,
   and conversation permissions remain Ada responsibilities. Sessions are
   ephemeral; durable knowledge remains in the existing files.
3. Pi exposes only explicit wrappers around its official read/write/edit tools.
   Wiki markdown and log.md are writable; local agent instructions are read-only.
   Shell tools, discovered resources, links and access outside that scope are
   disabled/refused. This is not an OS sandbox or a hosted isolation system.
4. Existing Claude and Codex options remain. Pi currently requires subscription
   authentication; API-key mode fails explicitly. Credentials stay in Pi.
5. Automated checks exercise real Pi tools/loader, signed-out CLI, fake-provider
   host lifecycle, wiki publication and database migration preservation. They
   do not establish relative speed, token efficiency, or live answer quality.

Current setup and limitations: `docs/agent-host.md`, “Try Pi with a ChatGPT
subscription.” Shared course memory and its admission/correction/visibility
contracts remain a subsequent design step.

## §29 · Shared course-agent voice and composer activity (2026-09-07)

The user requested shared prompting after the tutor repeatedly introduced itself
as a generic OpenAI assistant and could not identify its configured model.
All runtimes now receive common system/developer instructions: speak directly
from the assigned course role, match the conversation language, remain honest
about being AI, and use supplied installation facts when asked about the model.
Role/model conversations should not produce course cards or unrelated citations.
This is guidance, not implementation of the deferred memory admission policy.

Thinking and publishing status belong within the shared composer card. Its
normal layout grows around an activity header and contracts when idle, preserving
the draft. See `research/2026-09-07-agent-role-and-composer.md` for evidence.

## §30 · Ada as the primary course agent (2026-09-07)

The user explicitly approved renaming Course tutor to Ada and making it a
primary system presence, inspired by Slackbot. This supersedes the former
product/agent naming ambiguity. A persisted `system_role = 'ada'`, unique per
community, distinguishes this agent independently of its display name. Existing
active Course tutor records are migrated in place (the earliest per community
when names collide); custom names are not guessed or overwritten. New UI-created
communities identify their tutor starter as Ada. Its name and deletion are
protected, while course rules and channel assignments remain editable.

Ada appears in primary navigation. Its direct conversation and contextual
right panel share a tinted ground and book mark. Every persisted, non-deleted
message in a community with primary Ada has an Ask Ada action, including thread
replies. It opens the user's Ada DM with a removable source message, without
sending. The user's question explicitly sends that context with the request.
The existing single auxiliary panel and responsive overlay remain.

Teacher access to agent DMs remains unchanged pending the user's preference;
the UI explicitly discloses it. “Outside the channel” means the discussion is
not posted in the source channel, not that teachers are excluded. No new
cross-channel retrieval or memory access is implied.

## §31 · Memory framing confirmed during exploration (2026-09-08)

The user confirmed these principles after reviewing the memory alternatives:

- Preserve original study materials as sources; use derived, composable knowledge
  rather than entire originals as the default active memory. Retention is not an
  exemption from later authorized deletion or access revocation.
- Derived knowledge should support multiple linked examples and pedagogical
  variants, including examples refined after observed learning difficulties.
- Distinguish reusable knowledge from operational state (events, unresolved
  questions, commitments). Temporal information still needs reliable current
  state and optional history. A student's question is not a permanent trait;
  a claim about a whole class needs evidence.
- Capture the contributor's course role when processing information. Teacher
  contributions carry greater authority in the course; the exact resolution
  policy remains to be designed.

Internal/external is not selected as the organizing division for the course.
The audience-first structure remains a favored direction, not an approved ACL
matrix. OKF is a requested candidate for representation/interchange; neither
its adoption nor Markdown as canonical storage is decided. The permission
article informs further design, not an authorization to change current DM access.
See `research/2026-09-08-okf-authority-and-permissions.md`.

## §32 · Filesystem memory, OKF 0.2 and learner visibility (2026-09-08)

Supersedes §31's pending OKF adoption: the user selected OKF 0.2 for derived
knowledge. The user's expected direction remains filesystem-backed memory;
the preceding discussion of SQLite as a possible canonical memory store was an
alternative, not an approved architecture change. Preserve that distinction:
original source files and derived knowledge files remain on the filesystem;
SQLite owns application records and can hold published projections/indices
without becoming a second independently editable knowledge authority.

Current code already publishes wiki card bodies into tenant_cards in SQLite.
This is separate from the runner's working wiki files; OKF 0.2 conversion and
scope-aware memory delivery are not implemented by this decision.

The user confirmed type-specific contributor authority rather than a universal
teacher trust score. Identity and role must come from authenticated application
state, not claims in message text.

For learner evolution records, teachers within the course can view their
students; students can view only their own records. This does not authorize
public-channel disclosure, cross-course access, automatic mastery inference,
grading, or unrestricted publication of raw conversations.

The user confirmed that unauthorized memory should not reach the agent at all.
Proposed channel rule: effective read scope is constrained by requester rights,
agent assignment/purpose, and the response audience. A teacher asking in a
student-visible channel must not cause personal learner records to enter that
run. A teacher-only view can use authorized learner records; a student DM can
use that student's authorized records. Exact enforcement and the remaining
memory-type matrix are still design work, not current guarantees.

## §33 · Dynamic learner trajectory and memory admission (2026-09-08)

The user selected automatic admission for knowledge supported by a trustworthy
source; otherwise request teacher review. Trust is type-specific authority and
supported interpretation, not a universal role score or an agent's self-declared
confidence. Conflicts and uncertain derivations require review. Ada-generated
learner inferences are included in scope, explicitly distinguished from observed
facts and learner/teacher statements, with evidence and correction support.
This supersedes the two pending choices in
`research/2026-09-08-memory-v1-implementation-plan.md`.

The user clarified that consolidation must preserve learner evolution, not
replace earlier doubts or successes with a single current label. A doubt in
module 1, later evidence of understanding in module 2, and a new open question
are connected dated records. Earlier observations remain historically valid;
new evidence changes the current interpretation rather than erasing the path.
An actual error in an observation or inference is corrected explicitly, distinct
from a genuine change in the learner's understanding. Retention remains subject
to authorized deletion, not an unconditional never-delete promise.

Maintain a dated evidence trajectory and a composable current view derived from
it. Link records by learner, concept, module and evidence; module progression
alone does not establish understanding. Inferences carry their supporting
observations and time context; newer evidence can qualify or retire an inference
without turning it into a permanent learner trait. A currently resolved question
remains discoverable in historical queries. Views for current help and teacher
progress review may select different authorized subsets of the same trajectory.
These are agreed requirements; implementation and evaluation remain outstanding.

## §34 · Governed course memory and exploration courses (2026-09-08)

The user authorized the complete first memory version for every newly created
course, resetting the existing SQLite data before the demo, and creating realistic
preloaded courses. The end state is a usable set of cases to explore together;
presentation scripts and canned model responses are not requested.

Canonical originals and OKF revisions live on the server's filesystem beside the
configured database, with an atomic catalog of committed revision pointers.
SQLite owns processing jobs and the existing application domain. This central
filesystem authority replaces the shared per-agent wiki for hosted memory;
old workspaces remain retained outside new execution views. Teachers can explicitly
import a legacy file with its audience and required review.

Each invocation gets a bounded, authorized temporary file view. The server stamps
authority and admission, checks supplied evidence and rechecks access/current
versions before publishing. Shared-channel runs exclude personal learner data;
private runs respect self/teacher and assigned-agent restrictions. Old direct
runner publications cannot bypass this boundary.

Pi with scoped official file tools is the supported governed-memory runtime.
Pi and the user's selected `gpt-5.6-luna` become installation defaults. Existing
Claude/Codex adapters remain for compatibility but fail closed for governed work
until an equivalent read boundary exists. This limitation is explicit rather
than relying on cwd or prompt instructions for confidentiality.

New communities always initialize memory and primary Ada; the optional starter
flag controls the extra curator. Assigned-channel participation is consolidated
silently, while mentions/DM requests also receive replies. Source uploads compile
through persisted jobs. No proactive notifications or grading are introduced.

The minimal memory surface follows the current interface system: knowledge,
course activity, learner/self history, sources and teacher review. Evidence-backed
inferences remain separate from observations and teacher verification. See
`docs/course-memory.md` for boundaries and `docs/memory-exploration.md` for seeded
cases. Validation results must accompany completion, not be inferred from this
decision entry.
