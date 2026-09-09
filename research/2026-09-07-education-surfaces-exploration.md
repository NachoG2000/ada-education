# Educational surfaces before the second brain

Status: exploration, not approved scope or implementation. Date: 2026-09-07.

## User direction and evidence

The user wants ideas before building: retain channels as the principal interface, add non-channel pages beginning with a Buzz-inspired Inbox, explore personalized learning support and teacher follow-up, and give modules/assignments artifacts and distinct educational interactions before implementing the second brain. The previous education project's location was requested and is still unconfirmed; no claims about it are made.

GitHub read through `gh issue list --state all --json ...`: #1 is closed; #3 (Buzz interaction parity) and #4 (Ada-only QA) are still open. Their bodies describe older scope, including manual enrollment and default-only styling. Local archive `openspec/changes/archive/2026-09-05-buzz-interaction-parity/` and DECISIONS §§23–26 record completed/superseded work. Reconcile those issues against evidence before closing; do not use them as the new educational backlog. No issue was edited or created in this exploration.

Sources: https://github.com/NachoG2000/ada-education/issues/1, /issues/3, /issues/4 (direct API, 2026-09-07). Buzz local checkout `/Users/ignaciogarcia/Desktop/Personal/buzz`, commit `0720f5380`; inspected `desktop/src/features/home/ui/HomeView.tsx` and `HomeScreen.tsx`. Its Inbox composes a feed, list/detail panes, selection, context and read-state logic. This is evidence about the pinned checkout, not a claim about current upstream. Ada `components/workspace/pages.tsx` has a basic Inbox component but lacks that full interaction/state system and a primary navigation entry.

Read PROBLEM.md §§2, 7, 9, PRODUCT.md and DECISIONS.md. Individual algorithmic scoring and grading were explicitly outside previous scope; user interest here reopens exploration, not automatic authorization to implement them. Course-grounded visible assistance and evidence-based teacher follow-up are a more coherent starting point. The OpenSpec executable was not available on PATH; existing specs/config/archive were inspected directly. No new change was scaffolded.

## Proposed product structure

Keep channels as conversation homes. Pages are cross-channel views of the same underlying modules, assignments and evidence, not competing stores.

- **Inbox:** actionable personal attention. Mentions, replies in participated/followed threads, then assignment feedback and due changes once those features exist. List/detail with direct context and persistent read state. Avoid counting every course message or every thread reply as personal attention. Separate read, followed and resolved semantics.
- **Course:** ordered modules, objectives, materials and next activities. Each module opens its learning channel, preserving place/context. A module is a course object associated with a channel, not a folder requiring a second chat.
- **My learning (student):** resume a task, explicit goals, drafts/submissions and feedback needing action. Start with observable task states and learner self-report. An AI suggestion cites the exercise or conversation behind it, remains editable, and does not declare mastery based on message volume.
- **Teaching (teacher):** requests for help, pending reviews, and follow-up items. Show evidence and age; teacher resolves or dismisses suggestions. Explicit help requests and submission states precede inferred difficulty. Clearly disclose what personal information teachers can see; shared AI summaries are separate from current teacher-readable DM access.

Do not build all these pages first. Initial slice: Inbox + one learning module/channel. Next: one assignment and submission lifecycle. Then derive student/teacher views from real evidence rather than empty dashboards.

## Channel examples

- **Discussion:** normal conversation for questions and coordination.
- **Learning module:** persistent objective/current activity, Conversation and Materials tabs, preview of a selected artifact alongside conversation. Example: Trees and recursion with an illustrated traversal, practice set and tutor.
- **Assignment:** persistent brief, due date and submission status; shared questions plus private individual/team submission area. Student submits a version, teacher returns feedback, student revises. Visibility and group work must be decided; never post a student's submission publicly by default.
- **Announcements:** optional later, teacher-posted updates with scoped questions. No need to invent many channel types at the outset.

Treat a type as a constrained preset of useful capabilities with role-aware layouts, not an unrelated page template. A general chat plus a renamed icon is not an educational channel.

## Artifacts and AI support

An artifact is a durable object (note, diagram, exercise, notebook/link, brief, rubric, submission) attached to a module or assignment, with author, type, date, version and visibility. Refer to the same object from messages, materials and a global page. Defer automatic extraction, semantic retrieval and cross-cohort memory. User-visible editable content can exist before a second brain.

Example: a learner opens Inbox feedback on a recursion exercise, enters the module with the exercise visible, asks the tutor for a hint, submits a revised solution, and the teacher reviews the actual evidence. Personalization is in the assistance and next action, not in a black-box score.

## Candidate issues, for review

1. Reconcile historical #3/#4 status and record recent agent/UI work.
2. Education interaction map and one visual walkthrough, before implementation.
3. Actionable Inbox: list/detail, attention eligibility, read state, context navigation, role filtering and responsive behavior.
4. Module channel and manual artifacts: objectives/materials/conversation with one shared object model.
5. Assignment channel: brief/due date, private submissions, revisions and human feedback; no automated grades.
6. My learning and Teaching views derived from actual artifacts/tasks/help requests, with explicit sharing and reviewable AI suggestions.
7. Second-brain design after the preceding interaction vocabulary is understood.

These are proposed issue boundaries and order, not created issues or commitments. The smallest educational demo should show one coherent learning journey before expanding to multiple dashboards or a workflow builder.

## Follow-up: tutor workspace and adaptive artifacts

The user prefers combining personal learning and follow-up with artifacts inside the course tutor conversation, instead of introducing static My learning/Teaching dashboards. They propose template-based artifacts with freedom to present different learning activities and ask whether the tutor should become a primary surface rather than look like an ordinary DM. They also ask whether educational channels enhance the existing channel implementation.

Revised recommendation, still exploration: promote a designated tutor conversation to a primary Tutor workspace, reusing its conversation identity/history and existing access semantics rather than creating a duplicate chat. Ordinary DMs remain available for other agents. Tutor can offer persistent, reopenable artifacts alongside conversation: resumable practice, an annotated explanation, a plan or a comparison. The learner may initiate this via Continue learning; unsolicited tutor messages require an explicit future trigger/preferences decision because existing agents are mention-driven and templates prohibit unsolicited initiation.

Use a stable shell and a constrained artifact interaction vocabulary, with adaptable content/composition: context/title, provenance, activity blocks, progress/resume state, and explicit actions. The agent can choose appropriate blocks and compose their content, but a first implementation should not execute arbitrary generated application code with account privileges. Truly freeform visual simulations could later be sandboxed separately. Creating a diagram/exercise must not silently create a graded assignment or submit work. Distinguish durable artifact state from a transient assistant message; preserve versions and stable identity so an artifact can be found and resumed after chat scrolls away.

Enhance existing channels with a purpose and linked course objects: retain messages, membership, threads and shell; add module objectives/materials or assignment brief/submission views. Channel purpose and visibility are independent. Shared questions and private submissions are separate scoped objects, not inferred from a tab label. This is UI reuse plus a real domain extension, not only restyling.

Avoid three speculative dashboards initially. Suggested primary navigation: Inbox, Tutor, Agents, then course channels; learning materials/artifacts are discoverable from their module and the Tutor workspace. A Course overview can remain a later lightweight navigation aid when channel count demands it. Teacher oversight may begin with requested tutor briefings and reviewable artifacts; a persistent review queue becomes justified if teachers need to sort/filter/process many submissions, rather than because every role must have a dashboard.

Illustrative flow (fictional): learner asks to continue studying; Tutor reopens a recursion exercise artifact with their saved attempt, proposes a focused hint based on that actual attempt, and offers another case. The artifact changes activity blocks while keeping identity/context and saved state understandable. This does not assert that current Ada already persists attempts, runs simulations, proactively checks in, or has personal learning memory.

This follow-up supersedes the earlier recommended priority of dedicated My learning and Teaching pages as a product direction under discussion, not as an implemented or formally approved specification. No code, GitHub issue, permission rule, or automated messaging behavior was changed.

## Clarification: public course flow, private contextual support

The user clarified that the tutor/artifact design was useful; the public/private concern did not mean removing the private tutor. The human teacher chooses the course roadmap and course content starts in shared module channels. A channel-level module artifact can present the module's content and activities. Learners may choose Ask privately on a specific question, exercise or case, carrying its reference into the private tutor conversation. Individual learning progress and assistance belong in a personal surface, not unsolicited public agent messages.

Artifacts may appear as recognizable preview cards in pages or conversations. Opening one occupies the existing right auxiliary panel, replacing the currently displayed thread/details/artifact surface instead of adding another pane. On narrow screens, reuse the existing overlay pattern. Preserve the underlying conversation and return location when opening/closing an artifact. This is a navigation proposal, not an implemented artifact model.

This clarification supersedes the previous recommendation to remove Tutor as a primary surface outright: public channels are the starting point for course learning, while the private tutor remains a persistent, resumable support space. Exact navigation placement is still to be designed. The module overview artifact should be easy to find independently of message chronology. Teacher-authored roadmap and required content remain authoritative; AI suggestions must not silently rewrite them.

Illustrative interaction: open a teacher-selected module in its channel, open the module card into the right panel, select an exercise and Ask privately, then enter the existing tutor conversation with a reference to the exercise and an editable question. Return to the module restores the public learning context. Opening this flow does not automatically send a message, publish private attempts, or imply consent to share learning progress. Explicitly sharing a derived explanation later requires a visible choice.

Important existing-system boundary: current Ada DMs are teacher-readable and say so in their headers. The user's concern here clearly prohibits public exposure, but does not by itself settle whether teachers should retain access to raw tutor conversations, see only approved summaries, or see no individual progress. Do not silently redefine DM permissions from the word private. Keep audience labeling explicit and decide that boundary before implementing personal learning artifacts.

No UI, access rules, GitHub issues, or OpenSpec implementation scope changed in this clarification.

## Implemented educational extension

The user approved implementation on 2026-09-07, explicitly placing the channel
Artifacts entry immediately before member avatars. DECISIONS.md §27 records the
resulting scope; docs/educational-artifacts.md is the current workflow guide.
This supersedes the planning-only status of the preceding exploration, without
approving memory or automatic personalization.

Implemented: manual typed artifacts and versions, guide previews, one
list/detail auxiliary panel, owner-only personal answers, explicit assignment
snapshots and human feedback, contextual unsent tutor drafts, and an eligible
Inbox with persistent read state. Narrow-screen handoff opens the draft first;
the source remains available through Open material and Return to module.

External implementation reference verified in the original documentation:
[react-markdown repository](https://github.com/remarkjs/react-markdown), accessed
2026-09-07. Used documented Markdown components, remark-gfm, skipHtml and default
safe URL handling. No raw HTML, custom executable artifact code or remote-image
fetching was added.

Validation: complete `npm run check` passed after the implementation, including
typechecks, hosted/provider/agent regressions, build, new education/Inbox tests,
and retained fixture/migration/gated/smoke checks. Lint retained existing legacy
warnings only; build retained its large-main-chunk warning. Artifact templates
and Markdown load in a separate lazy chunk.

Browser QA used localhost:8877 and a disposable SQLite database, separate from
the real course on localhost:5173. Tested guide and assignment authoring, guide
preview/header count, list/detail navigation, private saves, explicit submission,
teacher feedback, contextual unsent tutor handoff and return, Inbox read state,
and desktop (1280×720) / mobile (390×844) layouts. The Inbox message was an
explicit fake-agent fixture in that isolated database. No model was invoked and
no message or artifact was created in the user's real community. Browser error
log was empty in the final check. Temporary viewport override was reset.

Remaining boundaries are deliberate: manual templates, 15-second cross-viewer
refresh, tab-local unpublished drafts, no auto-generation/memory, no automatic
submission-feedback Inbox event, and no grading or mastery inference.

OpenSpec completion: all nine implementation tasks are checked and
`openspec validate educational-artifacts --strict` passed. An automatic approval
review rejected `openspec archive educational-artifacts --yes`, interpreting
implementation authorization as insufficient for syncing/archiving the plan.
The archive command did not run. Main specifications were not synced and the
completed change remains at `openspec/changes/educational-artifacts/`, pending
explicit approval for that documentation lifecycle action.
