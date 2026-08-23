# Independent code review — teacher modules, student study, agent reports

Reviewed by five independent reviewer agents (correctness, efficiency, simplification, altitude, conventions) over the full uncommitted diff, plus the lead's decision audit. High effort level.

## Findings and outcomes

| # | Finding | Severity | Outcome |
|---|---|---|---|
| 1 | `POST /api/modules/:id/materials` built the raw path from the client-supplied `name` unsanitized — path traversal to an arbitrary file write | high | **Fixed**: `safeMaterialName` (basename-only, strict charset, length cap) + containment check against the raw root (`apps/server/src/api.ts`) |
| 2 | `PATCH /api/modules/:id` let any `authorId` set `difficulty.setBy`, permanently muting agent suggestions | medium | **Fixed**: `teacherOr403` gate on materials upload, module PATCH and report reconcile |
| 3 | Hardcoded `martin/` folder for uploads | medium | **Fixed**: folder derived from the gated `authorId` (byte-identical for the seeded course) |
| 4 | Duplicate hash listener (App.tsx vs community.tsx) | low | **Fixed**: one subscription in `apps/web/src/lib/hash.ts` |
| 5 | Role check duplicated in three shapes | low | **Fixed**: shared `isTeacher` in community.tsx used by the gate, the sidebar and the study copy |
| 6 | `ago`/`LEVEL_LABEL` duplicated with divergent wording between the two pages | low | **Fixed**: `apps/web/src/lib/format.ts` |
| 7 | `moduleCards(m.id).length` per module per render in ModuleList | low | **Fixed**: one memoized count map per `community.cards` change |
| 8 | `listModules` N+1 (2 queries per module) | low | **Fixed**: batched to 3 queries total |
| 9 | Check-script boilerplate duplicated across server scripts | low | **Fixed**: `apps/server/scripts/lib.ts` (harness, runTsx, serverUp, until). The runner's check keeps its own small harness — a cross-workspace import would be worse than the duplication |
| 10 | Dead comments left in study.tsx after the helper move | low | **Fixed**: removed |
| 11 | New check scripts undocumented in area AGENTS.md | low | **Fixed**: apps/server and packages/runner AGENTS.md updated |

## Decision audit

D-001 (scripted runtime lives in the runner), D-002 (per-student report transparent to the student; the E2E asserts the report carries the agent's summary and never the student's words), D-003 (views in the shell, role-gated) — all implemented as accepted; no contradictions, no superseding entries needed.

## Known drift, accepted

- The frozen spec's AC-8 says "DECISIONS.md §16"; on disk the section is §18 because §16–17 already existed. Content matches the criterion.
- Lint baseline moved 20 → 21: the new `isTeacher` export in community.tsx joins that file's existing known `only-export-components` warnings.
- 8 of the 10 screenshots were captured before the low-severity fixes; the only visible delta is relative-time wording. The two anchor screenshots were retaken on the fixed build, and the E2E receipt runs on the final tree.

Verdict: every acceptance criterion implemented and evidenced; all review findings fixed; no open contradictions.
