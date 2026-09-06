# packages/protocol — the shared contract

**Today (2026-09-04):** `src/types.ts` owns the shared workspace model (`Community`, `Member`, `Card`, `Message`, `Thread`…) and `src/events.ts` owns the retained workspace Zod/REST/WS contracts. `src/hosted.ts` owns the issue #1/#3/#4 tenant contract: account and community projections, profile/membership mutations, safe invite metadata/revocation/consumption, channel membership assignments, agent avatars/enrollment timestamps, and viewer-scoped events. Everything is re-exported by `src/index.ts`; `apps/web/src/lib/types.ts` re-exports from here so the `@/lib/types` imports remain stable.

**Current workspace contract:** this package owns channel visibility/lifecycle metadata, user/agent channel assignments, agent configuration/status/avatar and one-time enrollment results, message edit/delete/client IDs, attachments, aggregate reactions, typed REST inputs/errors and the complete legacy plus hosted event unions. Both server and web parse this boundary; do not recreate a client-local network event union. Runner mention/publish/module/report events remain source-compatible, and raw user/invite/runner credentials remain limited to creation/rotation responses or authentication frames.

Rules: **TS-source-only** package (no build: the web app transpiles it with Vite; server and runner will run it with `tsx`). Nothing here can depend on React, Node APIs, or the UI: shared types, schemas, and constants only. If a type changes, build all three pieces before closing out the task.

**Automatic agents (§25):** `agent-templates.ts` owns editable tutor/curator
starting points. Community creation can request starters; agent creation
defaults runtime/model for compatibility. Host enrollment schemas are a
dedicated installation-only boundary, never a browser projection. Work frames
can include current instructions.
