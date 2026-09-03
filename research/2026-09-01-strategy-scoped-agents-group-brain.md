# Strategy memo: multiplayer AI × group brain — what the moat is (2026-09-01)

Date: 2026-09-01. Question from Ignacio: the moat was meant to be Buzz-like —
many agents, each person with their own — and the hackathon reduced that to
the teacher's agents (`DECISIONS.md` §15). Is "many agents" necessary, or do
teacher-created role agents (evaluator, explainer…) suffice? And how do the
two ideas — "multiplayer AI" and "company brain" — combine into something
innovative rather than a chat with a bot? This is a strategy memo, not a
decision; it lives in `research/` because it fits nowhere else
(`AGENTS.md`, "all information lands in the repo"). If any of it is adopted
it goes to `DECISIONS.md` as a dated section.

## 1. What the repo already establishes

- The gap nobody fills (`research/2026-08-22-problem-impact.md`, "Gap"):
  (1) agents as members of a course channel, (2) group memory, not per-user,
  (3) citable, versioned, correctable pages, (4) files the group owns. Buzz
  has (1) with an event log; the LLM wiki has (3)+(4) for one person;
  enterprise brains have (2) as retrieval.
- The biggest leak is private (`PROBLEM.md` §2.2, §2.3): ~75% of students
  don't ask in the official forum, 29% go to AI first, and what they ask
  never comes back. Root cause 5: asking in public costs. "Any solution that
  requires asking in public to count reproduces the leak."
- The memory model already has two scopes (`DECISIONS.md` §6):
  `agents/<agent>/wiki` (community) and `people/<student>/wiki` (personal),
  with "whoever creates the agent sees what it writes" and
  `difficulties/<module>.md` as the teacher's aggregate (`PROBLEM.md` §7.4,
  §7.5).

## 2. Thesis: the moat is scoped memory, not the number of agents

"Multiplayer AI" and "company brain" are usually built as separate things:
Buzz gives many agents identities in shared rooms but remembers as an event
log; Glean/Dust/Notion compile or retrieve a brain without agents as peers.
Ada's novel object is the intersection: **several agents, each with its own
memory scope and write permissions, co-writing one brain with the humans.**

What multiplicity buys depends on what differs between agents:

| Agents differ by… | Example | What it buys | Who has it |
|---|---|---|---|
| Prompt only (personas) | explainer / evaluator on one brain | tone, tools | Buzz personas, Discourse AI personas — not a moat |
| **Memory scope + write rights** | community agent writes course cards; personal agent writes the student's wiki; evaluator writes `difficulties/` for the teacher only | privacy, aggregate, trust, cross-cohort trail | nobody in the analog table |

So the strategic answer to "how many agents?" is: as many as there are
memory scopes worth separating. The minimum set that makes the product
innovative is **two**: community and personal. Roles (explainer, evaluator,
archivist) are templates over the community scope — useful, cheap, not
differentiating.

Two mechanisms follow from scoped memory, and they are the product's
innovation stated as behavior:

1. **Private in, compiled out.** A student asks the personal agent in
   private. Nothing of the conversation leaves. What the agent *understood*
   (the concept, the gap, the angle) can be promoted as an anonymized card
   or folded into the module's `difficulties/` aggregate. The student never
   has to ask in public for the group to benefit. This is the direct attack
   on root cause 5 and on leaks 2.2/2.3, and no product in the analog table
   does it.
2. **The cohort brain is inherited.** A company brain's pain is that people
   leave; in a course *everyone* leaves every semester, by design, on a
   schedule. The 2027 cohort starts from the 2026 wiki with a `supersedes`
   trail; the teacher sees what changed. This is why courses are the right
   wedge for the company-brain idea, and it attacks leak 2.4, which no LMS
   touches (they clone empty).

## 3. Is "each person with their own agent" necessary?

Necessary for the innovation (mechanism 1 needs a personal scope), **not**
necessary as "each student runs their own runner". `DECISIONS.md` §14 ties
creating an agent to running it; those are separable:

- *Who owns it* (identity, folder, visibility) → the student. Enforced by
  folder permissions: the teacher cannot read `people/<student>/wiki`.
- *Who runs it* (runner, credentials) → by default the org's hosted runner
  (already recorded in the repository's deployment decisions and Railway
  runbook) with a cheap open model via pi/Ollama/OpenRouter (§14.5); a
  student who wants sovereignty can point the agent at their own laptop
  later (the Buzz-like power feature, not the default).

Practical shape: the teacher creates community agents from templates; a
personal agent is **auto-provisioned when a student joins**, zero setup.
That extends §20's "beat Buzz on plug-and-play" from identity to agents.

## 4. Where the chat sits once the moat is the brain

The chat is the input surface; the brain is the product. But the two ideas
pull differently on the chat choice:

| Chat surface | "Agents as members" | Reach a course already has | Cost to Ada |
|---|---|---|---|
| Ada's own client | first-class | none (migration ask) | the polish sink (`research/2026-09-01-buzz-fork-vs-own-frontend.md`) |
| Buzz (relay, desktop) | first-class, own keys | small, agent-native early adopters | an adapter: Ada's runner ≈ `buzz-acp`, cards as canvases — literally §3/§6 rule 7 |
| Zulip / Discourse / Mattermost | distinct bot account per agent, mintable by API | universities (Zulip for Education), forum-based communities | an adapter per platform |
| Discord / Slack | one bot with personas (multiple identities need one app per agent, registered by hand) | bootcamps live on Discord; corporate training on Slack/Teams | an adapter + platform dependency |

Honest consequence: in every chat an agent is a bot account, so "many agents
as members" depends on **who can mint those accounts**. Buzz and Ada's own
client mint them for free (a keypair / a token per agent). Zulip, Discourse
and Mattermost let an admin API mint one bot per agent, so Ada can provision
them (§5). Discord and Slack need an app registered by hand per agent, so
there multiplicity survives in the brain (distinct folders, authorship on
cards, promotion trail) but degrades to "a bot" in the room. Acceptable if
the moat is mechanisms 1 and 2; not if the moat is the room.

Recommended framing: **Ada is the brain; chat is pluggable.** Ada's own
client stops being a Slack that needs polish and becomes the *card file*
UI (cards, versions, supersedes, x-ray, Modules, My study, agent management,
aggregate difficulties) — the surface nobody else has and the one
`DESIGN.md` was actually designed for (Literata, folded tabs, One Sun are
card rules, not chat rules). Buzz becomes the flagship agent-native adapter
and the design reference, not a competitor; Discord the adoption adapter.

## 5. Open-source web chats as a shell (landscape, verified 2026-09-01)

Scan run by a subagent on 2026-09-01 (~24 web calls; GitHub counts from
`api.github.com`); the three claims that carry weight below were re-read by
the orchestrating session (marked **re-read**). "primary" = the subagent read
the original page; "snippet" = search result only.

| Product | License | Stack / infra | Web-first | Many agents as distinct members? | Size | Education |
|---|---|---|---|---|---|---|
| Zulip | Apache-2.0, whole product (primary) | Django + Tornado + PostgreSQL + RabbitMQ + memcached + Redis (primary) | yes | Bots are distinct user accounts with own name, avatar and API key; an org can have many (**re-read**, zulip.com/help/bots-overview). API-side bot creation not verified. | 25.8k★ | **Zulip for Education** since 2021 (primary) |
| Discourse (+ Chat) | GPL v2 (primary) | Rails + PostgreSQL + Redis (primary) | yes | **Discourse AI Personas**: several admin-defined personas, each posting as its own bot user in DMs, Chat and @mentions (primary) | 47.8k★ | used by university communities; no named program |
| Mattermost | Apache-2.0 except `server/enterprise` under the Mattermost Source Available License (**re-read**, plugin README); production-tier terms: snippet, verify | Go + React, PostgreSQL | yes | **Agents plugin**: multiple agents with own instructions/model confirmed (**re-read**); one bot identity per agent claimed by the scan, not confirmed in the README | 39k★ | none found |
| Rocket.Chat | MIT core, proprietary EE (snippet) | Meteor/Node + MongoDB replica set + NATS/Moleculer (primary) | yes | AI gated to EE; no multi-persona found (unverified) | 46k★ | none found |
| Stoat (ex-Revolt, renamed 2025-10) | AGPL-3.0 (primary) | Rust microservices + MongoDB + Redis + MinIO (snippet) | yes | none found | 3.3k★ | none |
| Campfire (37signals) | source-included, one-time purchase; **not** OSI open source (snippet; conflicting claims, verify at once.com) | Rails + SQLite + Redis | yes | none | closed distribution | none |
| Element (Matrix) | AGPL-3.0 + commercial since 2025-01 (primary) | Element Web + Synapse (Python) + PostgreSQL | yes | bots exist; no first-class multi-persona framework found | 13.4k★ | none named |

Reading for Ada:

- **As a shell to fork**, every one of these is the Buzz trap again — a
  5-component backend and a client owned by another team — with worse fit
  (none has cards, agent folders or course structure).
- **As adapters**, three are strong because an admin API can mint one bot
  account per Ada agent, so "many agents as distinct members" survives
  without Ada owning the room: Zulip (Apache-2.0, education program, every
  conversation has a topic — close to `questions/<slug>`), Discourse
  (personas already are distinct bot users; forum + chat), Mattermost. On
  Discord and Slack an agent is an app registered by hand in a developer
  portal, so multiplicity is possible but not something Ada can provision
  for the teacher.
- **Buzz has no web client** (its `ARCHITECTURE.md` names "web" only as a
  generic category; primary). Generic NIP-29 web clients (Chachi, 0xchat)
  could render Buzz's basic group chat but not its custom kinds (rich
  content 40002/40003, presence 20001/20002, roster 13534): partial, and an
  inference from the docs, not an interop test.

Prior art re-checked for the brain side: Karpathy's LLM wiki gist (April
2026; already `[C7]`); Dust.tt runs agents inside Slack but is retrieval
over connected sources only, no compiled wiki (primary); **Kepos**
(kepos.app, **re-read**): proprietary, €14–59/month, "one shared knowledge
base" of versioned markdown for multiple AI assistants, humans as
overseers who approve consolidations — the nearest analog on the brain
side, and it lacks humans as members, channels and any course structure.
The scan found no 2025–2026 product that combines agents as first-class
members of a human chat with a human-readable versioned wiki the group
owns; it did not cover AutoGen/AG2 community projects, Slab, Guru or
GitBook AI.

## 6. A sequence that keeps the innovation in front

1. **Brain + scoped agents on the existing server/runner** (no new chat
   work): agent templates; personal agent auto-provisioned at join; folder
   permissions; the promotion flow (personal → proposed community card);
   cohort inheritance (new course from a previous wiki, `supersedes`).
   Own client = card file.
2. **First adapter where the target cohort already talks** (Discord for
   bootcamps, or Buzz if the first users are agent-native self-hosters).
3. **Buzz adapter** regardless — cheap, aligned, and a distribution channel
   into a community that already believes in agents as members.

What this drops: competing with Buzz/Slack on the room. What it keeps: every
commitment in `DECISIONS.md` §1 (agents are members — in the brain and in
agent-native rooms; knowledge in files the group owns; composed from the
file). What it weakens: "the community owns the platform" when the room is
Discord — the knowledge is still owned, the room is not.

## 7. Open for Ignacio

1. Is the moat the room (then: Buzz alliance + own web chat) or the brain
   (then: chat-agnostic, card-file client)?
2. Personal agents auto-provisioned on the org's hosted runner: acceptable
   as the default, with laptop runners as the opt-in?
3. First adapter: Discord (bootcamps) or Buzz (agent-native early adopters)?
4. Whatever is chosen → `DECISIONS.md` §21, dated.

## 8. A position, given the founder's constraints (added 2026-09-01, later)

Constraints Ignacio stated after §1–§7: the hackathon frontend was built
with almost no time to specify and is far from what he wants, so a v1 with
only polished text channels would be ideal (hence the Buzz-fork idea);
students' own runners keep inference free but assume Claude Code / Codex
installed, which most students don't have; a fully hosted SaaS is easier
to build but a teacher can't pay for it, which pushes the customer to a
large university he has no contacts at; and a "personal project" seems to
imply closed source. He asked for a new position.

**Proposed position.** *Ada is the memory layer for cohort-based courses.
It plugs into the chat the course already runs, gives it scoped memory
(course · channel/module · personal), and compiles what gets understood
into a card file the group owns. Free and open source; bring your own
model.*

How each constraint resolves under it:

1. **The moat is the scopes, and the chat already has them.** Ignacio's
   own definition of the moat — a cooperative space with AI where there is
   course-wide context, per-channel/module context and personal context —
   is the memory model of §2, not the room. A Discord server, a Zulip
   organization or a Buzz community already *is* server → channels → DMs.
   Ada maps course → module channel → personal agent onto that structure
   and adds the memory per scope. Ada gives the room a brain; it doesn't
   need to be the room.
2. **v1 with only text channels, polished, zero frontend work: use the
   room the cohort already has.** For the first segment (below) that is
   Discord. Ada's own web client shrinks to the card file (card, versions,
   `supersedes`, sources x-ray, module pages, aggregate difficulties, agent
   management) — a small surface that Ignacio can actually specify and the
   one `DESIGN.md` was written for. The Buzz fork leaves the table; a Buzz
   adapter stays on it (same runner shape as `buzz-acp`, cards as canvases,
   §3 / §6 rule 7) as the second room, for agent-native communities.
3. **Inference stays BYO, on three rungs the deployer picks** (this is
   §14 restated as a price list, not a new design):
   - the instructor's laptop runner with their own Claude/Codex
     subscription → community agents cost $0 (legal per
     `research/2026-08-22-subscriptions-runners-buzz-pi.md`);
   - an API key pasted into the org's own Railway runner service (D-006) →
     personal agents for every student, pay per token;
   - a student's own runner → for early adopters only, never required.
   **Estimate** (method, not a measurement): per answer ≈ 12k input tokens
   (rules + `index.md` + ≤5 cards + last 20 messages) and ≈ 600 output;
   a 30-student cohort at 45 answers/day ≈ 16M input + 0.8M output per
   month. At list prices as known on 2026-09-01 (verify): a Haiku-class
   model ≈ US$20/month, a Sonnet-class model ≈ US$60/month, a cheap open
   model via OpenRouter ≈ US$5/month; prompt caching lowers the input
   share. Compare: the same 30 students on individual US$20 subscriptions
   ≈ US$600/month, memory kept per user, invisible to the teacher. The
   cohort's brain costs less than two students' subscriptions. For an
   Argentine university teacher (salary −34% real, `PROBLEM.md` §3) even
   US$20 is a real ask — which is why the first segment is not them.
4. **First segment: technical instructors running cohorts on Discord** —
   bootcamps, cohort-based courses, dev communities that teach. They
   already have Discord, Claude Code or Codex, and an API key; the cost
   question disappears and the "no university contacts" problem with it,
   because this is the population Ignacio does know (Aleph, the LatAm dev
   community, his own company's network). Universities stay in §19's
   list as the hosted-tier customer later, reached through the same
   Moodle sequence `research/2026-08-22-open-source-vs-premium.md` records.
5. **Open source is not in tension with a solo project; it is the only
   distribution a solo project without a sales channel has**, and it is a
   *requirement* of the runner model: code that runs on the instructor's
   machine with their credentials has to be inspectable. Revenue later is
   the sequence already decided in §16 (hosted runner with our key plus
   margin, backups, analytics) plus Railway template kickbacks (15–25% of
   usage, `research/2026-08-23-railway-deploy-template.md`). Closed source
   would remove the distribution and keep the cost.

What this gives up, honestly: the room. On Discord an agent is an app
registered by hand, so multiplicity is "one bot + personal DMs" in the
room and fully distinct only in the card file (§4). The "already on file"
seal and the card strip become an embed and a link. "The community owns
the platform" weakens to "the community owns the knowledge" — which is
commitment 2 of `DECISIONS.md` §1, the one that was always the point.

What it keeps: every mechanism in §2 (private in, compiled out; the
inherited cohort brain), the server/runner/protocol already built, the
Railway template (add the bot token as a variable), and a frontend scope
small enough to be specified by one person.

Sequence: (1) Discord adapter on the existing runner + personal agent
auto-provisioned as a DM scope; (2) the card-file web client, specified
screen by screen against `DESIGN.md`; (3) cohort inheritance; (4) Buzz
adapter. Record the outcome as `DECISIONS.md` §21.

## 9. The middle position: own the channel types, treat the chat as a commodity (added 2026-09-01, evening)

Ignacio's reaction to §8, after reading the Instinct essay
(`research/2026-09-01-instinct-thesis-memory-as-compiler.md`): what he
likes is the simplicity of *creating an agent and its memory* without
building channels and messages — the reason he wanted to fork Buzz. What he
dislikes is Ada shrinking to "a Discord bot", even though Instinct is an
iMessage bot and is being called the third wave. What he wants to own is
**channel types with their own UI**: a module channel created with a PDF, an
evaluation channel with a different frame. That, to him, is the point of an
open-source project.

Facts checked in the Buzz checkout (2026-09-01): channel types are a fixed
union `"stream" | "forum" | "dm"` (`desktop/src/shared/api/types.ts:1`); no
UI plugin or extension seam exists (only MCP-driven hooks and remote-agent
docs); the chat shell is ≈50k lines of TSX (sidebar ≈6k, channels ≈11k,
messages ≈16k, shared UI ≈17k). So: custom channel types on Buzz means
forking a 1,500-file Tauri client that moves ≈14 commits/day; and porting
its shell into Ada's SPA is weeks, not days — the polish *is* the 50k lines.
Nothing off the shelf gives a polished, self-hostable, embeddable web
channel-chat component either (checked in §5: every candidate is a whole
platform). **Channels cannot be bought for the web; they can be borrowed as
code or outsourced as a room.**

**Position.** Split the channel into two layers and treat them differently:

1. **The chat under the channel is a commodity.** In Ada's own client keep
   it deliberately plain — the stream view, composer, thread and sidebar
   that already exist — and specify it *against Buzz as the reference*, not
   by taste: same density, hover, unread, keyboard and empty-state
   behaviors at a fixed viewport, checked by screenshot next to Buzz
   desktop. Reference-as-spec is what fixes "the agent says it's polished
   and I see something else": a match to Buzz at 1440px is checkable; "polished" is not. Buzz's
   code is not ported; its behavior is copied.
2. **The channel type is Ada's core abstraction and its extension point.**
   A channel type = a folder layout in the wiki + the agent's rules in that
   channel + a frame (header, strip, side panel) + a lifecycle. Module
   (material, compiled cards, difficulty, reports), work/evaluation (base
   document, due date, submissions, feedback, active → submitted →
   archived), questions, private (the personal agent's scope), general.
   Buzz can't do this (fixed kinds), Discord can't, and it is exactly what
   `PRODUCT.md` already describes as visible states and what `DESIGN.md`'s
   rules were written for. Contributors extend Ada by adding channel
   types — the open-source appeal Ignacio named, made concrete.

Under this split the earlier options become **deployment shapes, not
identity**: Ada's own client (chat plain + frames rich) is the product's
face; a Discord or Buzz room is a distribution adapter where the channel
types show as Ada pages linked from each room channel (Discord channel ↔
module page), the shape Slack+Notion and Slack+Linear made ordinary. None of
them is "a Discord bot": the bot is the surface, the channel types and the
memory are the product.

**The ambition vector the essay points at has nothing to do with channels.**
Ada already compiles; what it lacks is the rest of the essay's stack: an
explicit admission utility (what deserves a card), a commitment scratchpad
(open questions, pending submissions, promised follow-ups) and **proactivity
as a state differential with an interruption gate** — the teacher's Monday
report "three students privately stuck on the same step of backprop", the
`supersedes` proposal when a new PDF contradicts a card, the fresh answer
composed from the file when a question is re-asked, and silence otherwise.
Instinct's wow is what it does unasked; for a course, so is Ada's. That is
where "create an agent and its memory" stays simple and the project stays
ambitious.

Order of work implied: (1) channel types in protocol + server (extend
`Channel.group` / `work.status` into a typed frame contract) and their
frames in the client, module and evaluation first; (2) the plain chat
brought to the Buzz reference; (3) the proactive loop (reports with a gate,
supersedes proposals); (4) adapters. The Buzz fork is closed; the Buzz shell
port is dropped in favor of Buzz as spec. Record as `DECISIONS.md` §21.
