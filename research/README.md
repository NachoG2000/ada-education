# research/

Research with sources. Backs up `PROBLEM.md`; it is not an authority on its own (see `AGENTS.md`, "all information goes into the repo").

Convention: one file per session or document, `YYYY-MM-DD-<topic>.md`. Every claim carries a source, a URL, and a verification level: **✓ primary** (read at the original source), **~ snippet** (only seen in a search result), **≈ secondary** (news or blog coverage of the source). A figure without a source is marked as an estimate.

| File | What it is |
|---|---|
| `2026-08-22-problem-impact.md` | 2025–2026 evidence across six fronts (students, teachers, knowledge loss, agent memory and AI tutors, Argentina, tools) + what the research does not prove. |
| `2026-08-22-subscriptions-runners-buzz-pi.md` | Anthropic/OpenAI rules on subscriptions in third-party servers and harnesses, Buzz's agent topology, and what pi.dev is. Basis for `DECISIONS.md` §14. |
| `2026-08-22-why-now.md` | Verified technological timing (MCP, ACP, Buzz, costs, memory-as-files, AI policy) and an audit of the "the problem is attention/pace" claim: which framing survives the evidence. Basis for `PROBLEM.md` §4/§8/§9. |
| `2026-08-22-open-source-vs-premium.md` | Precedents from open source edtech and open-core vs. selling to elite schools; Aleph jury criteria. Basis for `DECISIONS.md` §16. |
| `2026-08-22-aleph-submission-and-pitch.md` | Aleph 2026 submission rules and pitch guidance: demo video constraints, judging criteria, and what we decided for the pitch structure. |
| `2026-08-22-api-local-frameworks.md` | Technical claims used to implement Ada's local API: Hono on Node, WebSocket, and Node's built-in SQLite. |
| `2026-09-01-buzz-fork-vs-own-frontend.md` | Buzz-fork versus own-frontend assessment and re-verification of the pinned Buzz desktop source. |
| `2026-09-01-strategy-scoped-agents-group-brain.md` | Strategy memo on scoped agents, shared memory, chat adapters, and the proposed course-community position. |
| `2026-09-01-instinct-thesis-memory-as-compiler.md` | Summary of the supplied “Instinct Thesis” and what it validates or leaves missing in Ada's memory model. |
| `2026-09-03-codex-local-runner.md` | Official Codex CLI authentication and non-interactive command findings for issue #1's subscription-backed local runner. |
| `2026-09-03-issue-1-implementation.md` | Scope, architecture boundaries, preservation record, baseline evidence, and primary review log for GitHub issue #1. |
| `2026-09-03-buzz-interaction-inventory.md` | Buzz (`desktop/src`, `0720f5380`) and Ada interaction patterns inventoried side by side — entry point, container, steps, landing, confirmation, permissions — with `path:line` per source claim, plus the 2026-09-04 implementation/teacher-student/responsive QA addendum and the simple-visual clarification. Evidence for `openspec/changes/buzz-interaction-parity/` and issues #3/#4. |
| `2026-09-05-application-demo-priorities.md` | Puentes application context; recommendation to demonstrate a small, inspectable course-memory loop with focused UI polish and a technically explainable repository. Exploration only, with source and verification limits. |
| `2026-09-05-repository-consolidation.md` | Public-repository consolidation: reproducible setup, canonical local/CI checks, current architecture/contributor guides, preserved history, specification sync, and validation evidence. |

- [Agent management and automatic execution](2026-09-06-agent-management-exploration.md):
  user requirements, SDK/CLI comparison, and official authentication sources.
