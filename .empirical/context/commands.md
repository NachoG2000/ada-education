# Commands

Only commands verified in `package.json` (root and workspaces) and `AGENTS.md`.

## Setup

- `npm install` — once, at the root (installs every workspace). Node 24.x (verified: v24.14.1, npm 11.11.0).
- `npm run seed` — loads `data/neural-networks-2026` into the local SQLite DB (`apps/server/data/ada.db`); idempotent.

## Run, test, and build

- `npm run dev` — seed + web + server + Ada's runner (`ADA_RUNTIME` defaults to `scripted`; `ADA_RUNTIME=claude` needs `claude` installed and logged in) → http://localhost:5173 (proxied to :8787).
- `npm run dev:web` / `npm run dev:server` / `npm run runner` — each process alone. `npm run dev:demo` — SPA only against the synthetic demo community.
- `npm run typecheck` — `tsc -b apps/web` (noUnusedLocals/Parameters on: one unused variable fails).
- `npm run check -w @ada/server` — server typecheck.
- `npm run lint` — oxlint over apps and packages (known warnings: only-export-components in `card.tsx` and `ui/sidebar.tsx`).
- `npm run build` — `tsc -b && vite build` of `apps/web` → `apps/web/dist/`.
- `npm run smoke` — WS/REST smoke test against a throwaway copy of the course (`scripts/smoke-run.ts`: temp course + temp DB + port 8799). `scripts/smoke.ts` mutates what it targets; never point it at the demo DB.
- `npm run check:seed -w @ada/server` — seeds twice into a temp DB and asserts the demo snapshot.
- `npm run check:e2e -w @ada/server` — full teacher/student flow against the real scripted runner on a throwaway stack (port 8798).
- `npm run check:scripted -w @ada/runner` — scripted-runtime assertions against a synthetic snapshot.
- `node scripts/docs-check.mjs` — the documentation that must ship with a feature exists and says what it must.
- `npm run check -w @ada/runner` — runner typecheck.
- **There is no test suite** (no `test` script, no test files as of 2026-08-23).

## Verification evidence

- Static: `npm run typecheck`, `npm run check -w @ada/server`, `npm run lint`, `npm run build`.
- Runtime: `npm run smoke`; browser flows on http://localhost:5173 (or a second stack on `PORT=8790` + `vite --port 5174` when the main checkout's dev stack is up) with screenshots for [UI] criteria. `apps/web/.env` (`VITE_ADA_SERVER=/`) is gitignored: a fresh worktree needs it to run connected.
- Figure-generator dev screen: `http://localhost:5173/#figures`.
