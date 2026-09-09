# packages/protocol — the shared contract

**Today (2026-09-04):** `src/types.ts` owns the shared workspace model (`Community`, `Member`, `Card`, `Message`, `Thread`…) and `src/events.ts` owns the retained workspace Zod/REST/WS contracts. `src/hosted.ts` owns the issue #1/#3/#4 tenant contract: account and community projections, profile/membership mutations, safe invite metadata/revocation/consumption, channel membership assignments, agent avatars/enrollment timestamps, and viewer-scoped events. Everything is re-exported by `src/index.ts`; `apps/web/src/lib/types.ts` re-exports from here so the `@/lib/types` imports remain stable.

**Current workspace contract:** this package owns channel visibility/lifecycle metadata, user/agent channel assignments, agent configuration/status/avatar and one-time enrollment results, message edit/delete/client IDs, attachments, aggregate reactions, typed REST inputs/errors and the complete legacy plus hosted event unions. Both server and web parse this boundary; do not recreate a client-local network event union. Runner mention/publish/module/report events remain source-compatible, and raw user/invite/runner credentials remain limited to creation/rotation responses or authentication frames.

Rules: **TS-source-only** package (no build: the web app transpiles it with Vite; server and runner will run it with `tsx`). Nothing here can depend on React, Node APIs, or the UI: shared types, schemas, and constants only. If a type changes, build all three pieces before closing out the task.

**Automatic agents (§25):** `agent-templates.ts` owns editable tutor/curator
starting points. Community creation can request starters; agent creation
defaults runtime/model for compatibility. Host enrollment schemas are a
dedicated installation-only boundary, never a browser projection. Work frames
can include current instructions.

**Identity-aware mentions (§26):** MessageBlock includes `{ kind: "mention", memberId, text }` in both legacy and hosted Zod boundaries. `mentions.ts` resolves unambiguous legacy text names with complete-name boundaries; code blocks remain literal. IDs are authoritative, display labels are canonicalized by the server, and same-name identities must not be guessed.

`education.ts` owns typed educational templates, artifact versions, personal
work, submission snapshots and Inbox read-state responses (§27). Practice and
assignment templates require questions. These contracts do not change runner
memory cards or grant agent credentials access to hosted user endpoints.

**Pi runtime (§28):** hosted runtime and retained runner-event schemas also
accept `pi`. Authentication, enrollment, presence and agent projections retain
the same shape; provider authentication stays outside these contracts.

**Primary Ada (§30):** optional `systemRole: 'ada'` in agent projections is the
stable primary identity. Clients must not infer that role from an editable name.

`memory.ts` defines strict governed sources, proposals, records, views, reviews,
processing states and correlated `memory.work`/`memory.result` frames. Models
cannot supply trusted generation/review fields. UI and runner parse these shared
schemas. Keep domain extensions in the OKF serializer in the server, not here.
