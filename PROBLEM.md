# PROBLEM.md — The problem, before the solution

> Context and ideas document: it describes the problem and its sources, not the code. The actual state of the code lives in `AGENTS.md` and `openspec/`.

Written August 22, 2026. This file defines **what problem Ada attacks, who it hurts, why it exists, and what changed to make it worth solving now**. The solution lives in `DECISIONS.md`; the figures and sources in `research/2026-08-22-problem-impact.md` (citations like `[A2]` point there).

Usage rule: **if a feature doesn't attack something in section 2 or doesn't satisfy something in section 7, it doesn't ship.**

---

## 1. The problem in one sentence

A course is a group of people learning together, and almost everything it understands together gets lost: the explanation that finally made something click, the reason behind a decision, the question three people asked separately. It stays buried in chats, gets asked again, doesn't pass to the next cohort, and since 2025 it's also being diverted to private chatbots that don't know the course and from which nothing comes back to the group or the teacher.

"Students get distracted and teachers can't keep up" is true and useless: it applies to any classroom in any decade. The concrete problem is **the group's memory**, and it has four measurable leaks.

## 2. The four leaks

### 2.1 What was already answered gets asked again

- In an intro programming course, two consecutive editions with the same content generated **4,404 questions in 2020 and 3,218 in 2021** in the official forum. The course started from zero. `[B1]`
- When a tool shows the student similar already-answered questions while they type, duplicate posts **drop 40%**: four out of ten questions already had an answer in the same forum. `[B2]`
- On Stack Overflow, before AI, **~53%** of closed questions were closed as duplicates. `[B4]`
- Teaching staff generate ~20% of a course forum's activity but cover ~75% of the answers: the cost of repetition is paid by the teacher and the TA. `[B3]`

### 2.2 Questions go to places that keep nothing

- Asked where they prefer to raise a conceptual doubt, only **~25%** of students choose the official forum in public; the rest go to an **unofficial group chat**, a small circle of friends, a private post, or "other". The reasons: fear of "not knowing" and of the repercussions of being visible to the community. `[B1]`
- The university's official chat (Teams, 100M students) is corporate and built for flow, not memory: 153 Teams messages and 275 interruptions per person per day in the working world. `[F4]` `[C4]`
- WhatsApp is the real infrastructure of coursework in Latin America: announcements, notes, submissions; no search, no continuity, documented noise. `[E11]` `[E12]`
- Discord isn't indexable; separate tools are needed to "rescue" what was said there. `[C6]`
- The LMS is used mostly as a **file repository**, and its forums are "full of routine answers, now often AI-generated" while students are on Reddit, Discord or TikTok. `[F2]` `[F3]`
- Teams lose **25%** of their time searching for answers; **42%** of an organization's knowledge lives only in one person's head; 5.3 hours per week go into recreating information that already existed. These are workplace figures (2012–2025), not university ones, and they're exactly what happens to a teaching team when the TA rotates. `[C1]` `[C2]` `[C3]`

### 2.3 Since 2025, questions go privately to an AI that doesn't know the course

This is the new leak, the one that turns an old problem into an urgent one.

- **88%** of students worldwide use AI to learn (92% in Latin America), but **only 15%** say AI is integrated into many of their subjects and **43% into none**. Only **29%** believe their teachers can guide them. `[A2]` `[A3]`
- When they get stuck, **29%** go **first to AI**, more than to classmates (15%) or to the **course material (14%)**. `[A4]`
- What the student asks Claude or ChatGPT gets answered without the teacher's notes, without the assignment, without knowing the midterm moved; and the answer **never comes back** to the group or the teacher. Every AI tutor available in 2026 (Khanmigo, ChatGPT Edu, Claude for Education, Gemini, Coursera Coach, Canvas, Moodle, Copilot) keeps **per-user** memory and, aside from individual supervision dashboards, none shows the teacher **what the group doesn't understand**. `[D]`
- The causal evidence is consistent: **the same AI helps when it's designed inside the course and hurts when used loose.** With a generic GPT, ~1,000 students solved 48% more practice exercises and scored **17% worse** on the AI-free exam; with a tutor anchored in teacher-designed hints, the damage disappears. `[A6]` A course-tailored tutor at Harvard doubled learning. `[A7]` In Nigeria, teacher-supervised AI tutoring was equivalent to 1.5–2 years of schooling. `[A8]`
- And handing the teacher a generic AI isn't enough either: in an RCT with 193 teachers, students rated those classes as less interesting and less important. `[B8]`
- Only **45%** of the region's higher-education institutions have AI guidelines; only **30%** of Latin American students say institutional AI use meets their expectations. The institution sees nothing and has decided nothing; meanwhile, the student already decided. `[A13]` `[A3]`

### 2.4 When the semester ends, nothing is left

- No artifact survives the course's close: the WhatsApp group gets archived, the forum is cloned empty, the AI tutor doesn't remember the previous cohort because it never knew a course existed. We found no literature measuring the loss between cohorts; `[B1]` is the most direct proxy, and the absence of measurement is part of the problem. `[G5]`
- What does accumulate across cohorts: photocopied notes, inherited Drives, and platforms like Studocu (1.5M users, 14,000 universities): course knowledge with no author, no version, no source, and invisible to the teacher. `[C11]` The demand for shared memory exists; the supply is pirate.

## 3. Who it hurts

**The student.** They ask at 11 pm and nobody answers; they ask in public and expose themselves; they ask an AI in private and get a context-free answer that may contradict the teacher. What they understand, they can't take with them or share. `[B1]` `[A4]` `[A6]`

**The teacher and the TA.** In Argentina: **13.4 students per teacher** nationally, first-year mega-courses of **~1,500** students, **70%** of positions with minimal paid hours outside class, a layer of **unpaid TAs** around 20% of positions, budget **−33%** real and salary **−34%** real since 2023, national strike in March 2026. `[E3]` `[E4]` `[E2]` `[E5]` `[E7]` `[E8]` They've never had less time to answer the same thing five times, and never had less visibility into what's happening with the group, because the group is somewhere else.

**The group and the next cohort.** The explanation that worked in Tuesday's thread doesn't exist on Thursday. The "why did the midterm move" gets lost. The 2027 cohort asks the same 3,000 questions. `[B1]`

**The institution.** It pays the cost (~40% first-year dropout, 28 of every 100 entrants graduating) without having either a policy or data on the biggest change in how its students study. `[E6]` `[A13]`

## 4. Why this is a 2026 problem

The window opened in the last twenty months: **the problem got worse** (leak 2.3 barely existed before 2025) **and the pieces to solve it appeared**. Nobody has put them together for a course.

| | Late 2024 | August 2026 |
|---|---|---|
| Student AI use | 66% (HEPI 2024); emerging | 88–92%; universal `[A1]` `[A2]` `[A3]` |
| AI use in assessments | 53% | 88% `[A1]` |
| Integration into subjects | no data | 15% "in many", 43% "in none" `[A2]` |
| Causal evidence | almost none | RCTs in Turkey, Harvard, Nigeria: designed inside the course = helps; loose = hurts `[A6]` `[A7]` `[A8]` |
| Agent memory | memoryless chats; RAG | Karpathy's LLM wiki (Apr 2026), filesystem memory as the mainstream, AGENTS.md in 60,000+ repos, ChatGPT/Claude with **per-user** memory `[C7]` `[D1]` `[D6]` `[D7]` |
| Agents as members | didn't exist | Slack + Agentforce (2025), **Buzz by Block (07/21/2026)**, 29,700 stars in a month `[F6]` `[C8]` |
| Agent = a CLI over a folder | didn't exist | Claude Code / Codex can run over a wiki and publish via `buzz-acp` `[C8]` |
| Argentine university | early crisis | −33% budget, −34% salary, unpaid TAs as the backbone of mass courses `[E7]` `[E5]` |

## 5. Why what exists doesn't solve it

| Tool | What it does well | Why it doesn't close the leak |
|---|---|---|
| LMS (Moodle, Canvas, Classroom) | Stores files and grades | It's a repository; nobody converses there; the forums are dead `[F2]` `[F3]` |
| Course forums (Piazza, Ed) | Q&A with fast answers | Threads, not pages: what's answered never compiles or gets superseded; people migrate from forum to forum all the same `[B3]` `[F3]` |
| Chat (WhatsApp, Discord, Teams) | Where people already are | Optimizes the now; no search, no versioning, no continuity `[C4]` `[C6]` `[E11]` |
| AI tutors (Khanmigo, ChatGPT Edu, Claude for Ed, Gemini, Coach) | Explain well, at any hour | Per-user memory, no course material unless loaded by hand, the teacher never sees the aggregate, nothing exportable `[D]` |
| Research AI TAs (Jill Watson, CS50.ai, Cogniti) | **RAG with citations and abstention works**: 76.7% approved answers vs 31.3% for a generic assistant `[B5]` `[B6]` | A single proprietary bot, no memory across cohorts, no pages the group owns `[B5]` `[B7]` |
| Agent workspaces (Buzz, Slack + Agentforce) | Agents as members with identity and channels | The memory is an event log, not knowledge compiled with sources and "replaces" `[C8]` `[F6]` |
| LLM wiki, Stash, Obsidian + agents | Knowledge compiled in markdown with sources | Personal or for code teams; no channels, no humans and agents as peers `[C7]` `[D2]` |

None satisfies all four conditions at once: **agents as channel members · group memory, not user memory · expressed as citable, versioned, correctable pages · in files the group owns.** `[D]` `[F]`

## 6. Root causes

1. **Chat optimizes the now.** The newest message wins; re-asking costs the same as searching an unstructured history, so people re-ask. `[C4]` `[B2]`
2. **Nobody has the compiling role.** The teacher has no hours; the TA rotates and often isn't paid; the student has no incentive to document for others. Wikipedia, team wikis and the LLM wiki work because *someone* (person or agent) turns the raw conversation into a separate artifact, with sources and a version. `[E2]` `[E5]` `[C7]`
3. **AI memory is private by business design.** Per-user memory retains the user; a group memory in files can be read by anyone, including a competitor. That's why no provider built it. `[D7]` `[D]`
4. **Course knowledge has no owner and no format.** It isn't a file someone can list, version or take with them; it's rows in a third party's database or messages on someone's phone. `[F2]` `[C6]`
5. **Asking in public costs.** Fear of exposure → private wins → what's private never comes back. Any solution that requires asking in public to "count" reproduces the leak. `[B1]`
6. **Live search doesn't accumulate.** RAG over the material rediscovers from scratch on every question; there's no computation done once. `[C7]`

## 7. What has to be true for the problem to disappear

Criteria, not features. Each has its counterpart in `DECISIONS.md` §6 (memory) and in the states of `PRODUCT.md`.

| # | Criterion | Attacks | How it shows up in Ada |
|---|---|---|---|
| 7.1 | What was understood while answering (the concept, the connection between two things, the difficulty) remains as a **readable card with a source**, connected to the others, outside the flow. The card is the understanding, not the conversation. | 2.1, 6.1, 6.2 | Agent rules 3 and 4; `modules/…/<topic>.md` + `questions/<slug>.md` as an index of angles; "published as an answer" card |
| 7.2 | The second time someone asks "the same thing" (other words, another gap), the agent **composes a new answer from the cards**, without going back to the raw sources, and the card is enriched with the new angle. It's visible that it came from the card file. **It is not an answer cache.** | 2.1, 6.6 | `fromCard`, the "on file" seal: the demo's key moment |
| 7.3 | The knowledge is **owned by the group** in a format that outlives the platform and the semester. | 2.4, 6.4 | `data/<course>/…/wiki/*.md` in git; `ls` + `git log` in the demo |
| 7.4 | Asking in private **doesn't mean losing**: the personal agent writes into the student's wiki, and what generalizes can move up to the group. | 2.2, 2.3, 6.5 | `community` vs `personal` agents; `people/<student>/wiki`; visibility |
| 7.5 | The teacher sees the **aggregate** ("what the group doesn't get about backprop"), not individual surveillance. | 2.3, §3 teacher | `difficulties/<module>.md`; "whoever creates the agent sees what the agent writes" |
| 7.6 | The agent's answers are **anchored in the course material, cite, and abstain** when there's no source. It's the only thing proven to work. `[B5]` `[A6]` | 2.3 | Agent rules 1 and 2; `cite` blocks; channel base documents |
| 7.7 | When something changes, the old page **isn't edited: it's replaced** and the trail remains. | 2.4, 6.4 | `supersedes`; `superseded` state; `decision`-type cards |
| 7.8 | The agent is **one more member**, created by the community, with a name and channels; not "the platform's bot". | 6.3 | Commitment 1 in `DECISIONS.md`; identity + folder + runner topology (§14) |

How to measure it later, in a real course (it's not the pitch's closer; it's how to know the card file is alive): **what share of `#questions` gets answered composing only from cards, without going back to `raw/`**; **how many cards get connected or enriched per week versus how many are born duplicated**; and **how many survive the semester change**. Reuse isn't the goal; the goal is that every new question finds already-compiled understanding to compose on.

## 8. Vision

> Every group of people who learn together builds up knowledge that mostly disappears. We believe that knowledge should belong to the group, grow on its own, and outlive any single conversation. So we're building a place where humans and AI agents are members of the same community, where what gets understood once becomes something everyone can read, and where the agents remember alongside the people instead of starting over every time.
>
> **Humans and agents learn together, and what they learn stays with them.** (`DECISIONS.md` §1)

Why education: a course is the purest case of the problem. It has a start and an end date, changes people every four months, concentrates repeated questions by design (everyone studies the same thing at the same time), and today it's the place where private AI already won without anyone deciding it. If shared memory between humans and agents works here, it works for any group that learns.

Why now: the twenty-month window of section 4, standing on four verifiable legs (sources and verification levels in `research/2026-08-22-why-now.md` §1):

1. **The agent-over-files is already a mass product, not an experiment.** Claude Code went from launch (Feb 2025) to $1B annualized in 6 months; Codex CLI multiplied downloads ~500x in a year. An agent that reads and writes a wiki in a folder is boring technology today — and cost per token fell more than 10x since 2023.
2. **The standards for "agents as members" are months old.** MCP (Nov 2024), ACP (2025), and Buzz by Block (07/21/2026): agents with their own identity living alongside people in channels. The product shape Ada needs became legible to the market weeks ago.
3. **The incumbents chose private memory, and it's in writing.** Canvas + OpenAI (Jul 2025) states verbatim that the student's data "remains private to the Canvas user"; Claude/ChatGPT memory is per user; Khanmigo's two-year RCT (Aug 2026) shows 0.06–0.08 SD/year at ~15% usage. The "group memory" window is empty not by neglect but by business design (root cause 6.3) — an incumbent can't copy it without cannibalizing its retention.
4. **Institutions moved from banning to demanding.** UNESCO: 61% of institutions with guidelines done or underway (Sep 2025); Argentina approved mandatory AI curriculum content (2025) and Buenos Aires made AI literacy mandatory (Aug 2026). A teacher adopting Ada is no longer rowing against institutional policy; the policy asks for exactly this.

## 9. What the problem is NOT

- **It's not (mainly) attention.** A tempting framing says "students are distracted"; the 2024-2026 evidence shows a real behavior change (screen switch every ~47 s, NAEP reading declining) but an "attention crisis" narrative contested by the researchers themselves (part is moral panic; the "8-second goldfish" doesn't exist; phone bans show mixed/null effects), and **no large survey of teachers or institutions names it as problem #1** (RAND 2025: behavior and pay; EDUCAUSE: trust; HEPI: misconduct). Attention enters Ada only as a consequence: less re-asking, less noise, cards instead of scroll. Details and sources: `research/2026-08-22-why-now.md` §2.
- **It's not motivation.** Points and leaderboards assume a disengaged student. The 2026 student isn't demotivated: they're solving, in private, with an AI. The risk isn't that they don't participate; it's that they participate where nothing remains. `[A2]` `[A4]`
- **It's not per-student algorithmic personalization.** More individual AI without course context is exactly what hurts learning. `[A6]` The useful personalization is a personal agent writing into a wiki the student owns (7.4), not a profile with a score.
- **It's not automated grading or surveillance.** Seeing the aggregate, yes; reading private chats, no. `[B1]` (fear of visibility is a cause, not an accident).
- **It's not replacing the teacher.** It's giving back the hours spent repeating and the visibility lost when the group moved to WhatsApp and ChatGPT.
- **It's not "better search".** Live RAG rediscovers; it doesn't accumulate. `[C7]`
- **It's not an answer cache.** Saving work by showing what was already answered is not the thesis. What helped Sofia may not help Ignacio: he has another gap and another language. The thesis is that *understanding* compiles once into connected cards, and every answer is composed fresh from there. (`DECISIONS.md`, commitment 3)
- **It's not a chatbot in the LMS.** Canvas + OpenAI, Classroom + Gemini and Moodle AI already do that: private per-student memory inside a repository nobody reads. `[D]` `[F2]`

## 10. Limits of this diagnosis

To avoid overselling (details in `research/…§G`):

1. Nobody has directly measured that "what's learned privately with AI never returns to the group". It's inferred from `[A2]` `[A4]` `[B1]`.
2. The RCTs are from secondary school or specific courses in other countries; there's no evidence from Argentine universities.
3. The organizational knowledge-loss figures are from 2012–2018 or from vendors with a commercial interest.
4. There's no large Argentine university dataset on AI use; the regional figure (DEC LATAM) doesn't list countries.
5. No literature measures loss between cohorts; `[B1]` is a proxy.
6. The causal evidence for AI tutoring we cite (`[A7]` Harvard, `[A8]` Nigeria) we read in secondary coverage (primaries paywalled/blocked), and the meta-analyses with 0.7–0.9 SD effects look inflated (few studies >6 months). The "fixed pace loses both tails" mechanism is plausible but has no at-scale classroom RCT; Bloom's 2-sigma doesn't replicate (~0.37 SD real).
7. Numbers that circulate and must **not** be used in any material: the "8-second goldfish", "2 sigma" as current, "Khanmigo +22% (n=340,000)" (traces to a marketing blog), "$8B Claude Code run-rate".

What the 08/23 demo can prove: that 7.1, 7.2, 7.3, 7.6 and 7.7 are possible today with Claude Code over a folder and our local server as the community (`DECISIONS.md` §14-§15). What it can't prove: the impact on a real course. That's the first thing after the hackathon.
