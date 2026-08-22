# packages/protocol — the shared contract

**Today:** `src/types.ts` (the domain model that used to live in the SPA: `Community`, `Member`, `Card`, `Message`, `Thread`…) and `src/events.ts` (Zod schemas and REST/WS event types), re-exported by `src/index.ts`. `apps/web/src/lib/types.ts` re-exports from here so the `@/lib/types` imports don't break.

**Next step:** consume these contracts from `apps/server` and `packages/runner`; if an event changes, update this package first and then build all three pieces.

Rules: **TS-source-only** package (no build: the web app transpiles it with Vite; server and runner will run it with `tsx`). Nothing here can depend on React, Node APIs, or the UI: shared types, schemas, and constants only. If a type changes, build all three pieces before closing out the task.
