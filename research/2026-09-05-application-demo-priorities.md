# Ada as a recent project for the Puentes application

Date: 2026-09-05. Status: exploration and recommendation, not an approved
scope change. This memo does not supersede `DECISIONS.md` §22–§23 or start
implementation. It belongs in research because it records the purpose of
the public project and the reasoning behind possible priorities.

## User context

Primary source: Ignacio's messages in the local project conversation on
2026-09-05. He asked whether to polish the UI or design the memories / second
brains for agents, courses, and students. He then clarified that he wants to
present Ada as a project he recently created when applying to Puentes, with
the aim of joining the program and going to San Francisco. This is a
portfolio/application goal, not a request to sell Ada to Puentes or prepare
a course pilot. No application submission or implementation was requested.
He further emphasized that Ada should be a good repository because it will
be public. Repository quality is therefore part of the intended outcome;
presentation should demonstrate the actual product and engineering work.

## Evidence and its limits

- **Primary, local documents:** `DECISIONS.md` §6 preserves immediate,
  compiled-wiki, and raw-source memory; §14 preserves the separate runner
  and agent workspace; §22–§23 intentionally pause visible cards and keep
  the current shell in ordinary shadcn styling.
- **Primary, local repository:** `README.md` already distinguishes the
  hosted foundation from paused screens, and `LICENSE` is present. However,
  the root `AGENTS.md`, "Mounted web client", still says there is no product
  router and that workspace components are unmounted, contradicting its
  own current-state description and `apps/web/AGENTS.md`. `PRODUCT.md`'s
  issue #1 boundary still categorizes standalone Agents/Settings as future
  explorations. `.gitignore` still claims that omitting the web environment
  file builds a synthetic demo, while current architecture documentation
  says no synthetic demo exists. These are concrete documentation drift,
  not a reason to delete retained design history.
- **Primary, local repository:** `git ls-files .github` returned no tracked
  files, so no versioned GitHub Actions workflow was found. Executable
  protocol, server, runner, and web checks already exist. `package.json`
  requires Node >=24, which is not stated beside the README quickstart.
  A clean-clone check and CI wiring are recommended; they were not performed
  in this exploration.
- **Primary, local source:** `apps/web/src/components/hosted-surface.tsx`
  ignores `card.published` and supplies an empty `cards` collection. The
  compiled knowledge is not exposed through a mounted memory surface.
- **Primary, local source:** `packages/runner/src/cli.ts`, `listWiki`,
  `parseCard`, `inlineBlocks`, `buildPrompt`, and `commitRun` already provide
  pieces for file-change detection, metadata, citations, wiki-first
  instructions, and commits in standalone agent repositories. This is not
  a memory system starting from zero. `buildPrompt` also includes available
  raw-material excerpts on each invocation; a new demo must establish that
  reuse really depends on compiled memory, rather than infer it from a
  fluent answer or a citation alone.
- **Documented prior runtime evidence, not rerun today:**
  `research/2026-09-03-buzz-interaction-inventory.md`, "Implementation and QA
  addendum (2026-09-04)", records teacher/student, responsive, route, and
  build checks. No fresh visual audit or model-quality evaluation occurred
  in this exploration.
- **Official-site indexed text, direct fetch unavailable:**
  <https://puentes.antigravity.capital/>, retrieved through web search on
  2026-09-05. The program describes a second interview round in which an
  engineer reviews a supplied project repository and assesses the
  applicant's depth of understanding. Direct page opens timed out twice;
  this is indexed official-site content, not a successful direct-page
  verification. No admission outcome or unpublished rubric is inferred.
- **Primary external engineering source:** Anthropic, "Effective context
  engineering for AI agents", published 2025-09-29, read directly on
  2026-09-05:
  <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>.
  It describes selecting relevant context and persisting structured notes
  outside the context window for later retrieval. This supports a simple
  implementation starting point; it is not evidence of educational impact
  or of Ada's quality.

## Recommended sequence

Inference from the clarified user goal and the evidence above: consolidate
the public repository first, then deliver a small, working, inspectable
course-memory feature with a finished interface. Technical depth, a
coherent product idea, and an understandable implementation are the
intended signals; this is a recommendation, not an official Puentes scoring
formula.

First, close out the existing shell work as a coherent milestone. Align
current-state documentation; make runtime/provider prerequisites explicit;
verify setup from a fresh clone; run the existing relevant checks in CI;
provide a short architecture/contribution map; and make the distinction
between mounted product and retained legacy paths easy to navigate while
preserving repository history. Keep this consolidation bounded by concrete
reader and contributor needs. A rewrite or a new test framework is not
implied.

Next, specify and implement the course-memory increment below. UI work
should establish consistent hierarchy, spacing, message readability, and
complete loading/empty/error states across the supported core flows. The
memory surface should receive the same standard. A short demonstration is
the final presentation of that real functionality, not its only quality
criterion.

1. Choose one course scenario with a small, coherent set of materials and
   plausible questions. Start with a public course channel, one course
   agent, and two students.
2. Specify memory behavior: what is worth saving; the source and scope of
   each note; how the agent retrieves it; how a new angle enriches it; how
   a factual correction supersedes it; who can inspect or correct it.
3. Demonstrate a question producing reusable knowledge, then a different
   student's differently phrased question producing a fresh answer based
   on that knowledge. Inspect the saved note and its sources. Include a
   correction and show subsequent retrieval using the current information.
4. Make that behavior visible with the smallest useful UI, such as a
   citation opening a note with sources and history. This would be an
   explicit next-phase revision of the current pause on cards UI; it is not
   authorized by this memo. Keep the existing simple component language.
5. Evaluate the loop on paraphrased questions, source contradictions,
   missing evidence, persistence across a runner restart, and access
   boundaries. Use actual traces/files as evidence; do not label a response
   as memory reuse just because the model says so. Record limitations.
6. Prepare a short demonstration and a readable repository explanation:
   problem, architecture, key tradeoffs, checks, current limits, and what
   Ignacio built and can explain. Packaging is proposed work, not work
   performed in this exploration.

Define course and student ownership/visibility early, but implement the
course loop first. An agent's execution state and instructions are a
different concern from course knowledge and student-specific knowledge;
multiple agent identities alone do not require independent duplicated
course brains. Multi-writer ownership and cross-agent sharing remain design
questions, not a silent replacement of §6's per-agent folders.

The current student-agent DMs are readable by teachers, with disclosure
(`DECISIONS.md` §23; the QA addendum). They must not be presented as the
teacher-inaccessible personal wiki envisioned in older documents. A later
personal-memory phase needs explicit visibility and promotion rules before
moving any student-derived material into shared knowledge.

Broad redesign, institution-wide memory, cross-cohort inheritance,
proactive teacher reports, hosted runners, billing, and a production pilot
are not prerequisites for this proposed application demonstration. Scope
would change if the user later requests actual independent use by others.
