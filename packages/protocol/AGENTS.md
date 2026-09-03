# packages/protocol — the shared contract

**Today:** `src/types.ts` (the domain model that used to live in the SPA: `Community`, `Member`, `Card`, `Message`, `Thread`…) and `src/events.ts` (Zod schemas and REST/WS event types), re-exported by `src/index.ts`. `apps/web/src/lib/types.ts` re-exports from here so the `@/lib/types` imports don't break.

**Current workspace contract (2026-08-24):** this package owns channel visibility/lifecycle metadata, agent configuration/status and one-time enrollment results, message edit/delete/client IDs, attachments, aggregate reactions, typed REST inputs/errors and the complete `ServerEvent` Zod discriminated union. Both server and web consume it; do not recreate a client-local event union. Runner mention/publish/module/report events remain source-compatible.

Rules: **TS-source-only** package (no build: the web app transpiles it with Vite; server and runner will run it with `tsx`). Nothing here can depend on React, Node APIs, or the UI: shared types, schemas, and constants only. If a type changes, build all three pieces before closing out the task.
