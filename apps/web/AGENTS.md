# apps/web — the web client

**Today:** Ada's most complete piece. A Vite + React 19 SPA that runs against the synthetic community in `src/lib/demo.ts` with a frozen date (`NOW` in `App.tsx`), or connected to `apps/server` when `VITE_ADA_SERVER` is set (`src/lib/api.ts`: REST + WS behind the same `CommunityProvider`; local identity in the "Who are you?" screen). No router (`location.hash`), a single context (`lib/community.tsx`), product components in `components/ada/`, shadcn primitives in `components/ui/`, "The card file" design system in `index.css` (named rules in `DESIGN.md`: Tab Rule, One Sun Rule, Three Voices). Domain types live in `@ada/protocol` (`src/lib/types.ts` only re-exports). Full detail in the root `AGENTS.md` → Architecture section.

**How it grows (don't implement without a spec):** per `openspec/changes/demo-local-backend/specs/web-client/`. Later (inspiration, not code: `docs/usecases-api.html`): live presence, agent creation from the UI, invite-link identity, Tauri packaging.

Local rules: don't touch `components/ui/` unless necessary (prefer composing in `components/ada/`); broken ids in `demo.ts` take the whole screen down (the lookups throw); everything in English.
