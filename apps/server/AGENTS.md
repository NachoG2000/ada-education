# apps/server — the community server

**Today:** local implementation of a course's source of truth. Hono serves `GET /api/community`, messages, threads, and publications over REST; `ws` shares `/ws` for clients and `/ws/runner` for runners. SQLite lives in a file via `node:sqlite`/`DatabaseSync`; agent presence is kept in memory and mentions are delivered only to the connected runner.

Configuration: `PORT` (default `8787`), `ADA_DB` (default `apps/server/data/ada.db`), and `ADA_COURSE` (default `data/neural-networks-2026`). `npm run seed` loads the course from `community.json` idempotently via upserts: it doesn't duplicate or overwrite messages or dynamic cards already published. `npm run check` validates TypeScript; the reproducible smoke test runs with `npx tsx apps/server/scripts/smoke.ts` while the server is up.

**Responsibility:** it's the source of truth for members, channels, messages, threads, and published cards of *one* course. Uses Node 24 + Hono + `node:sqlite` (a single file, no Docker) + WebSocket. Detects `@agent` mentions and forwards them to the connected runner. **Golden rule: it never runs models or stores AI provider credentials** (`DECISIONS.md` §14.1): it's a bus and an archive.

**Scope for this weekend (`DECISIONS.md` §15):** one course, agents defined in `data/<course>/community.json` with a plain token, no person auth, running on the teacher's computer.

**How it grows (idea, not code):** multi-course per tenant, identity via invite link with per-member keys, hosting (Railway/ours), optional mention queue. The expanded API is sketched in `docs/usecases-api.html` (future inspiration).

**Deploy to Railway for one teacher (near future, ~1-2h on top of this weekend's work):** (1) persistent volume for `ada.db` and `data/<course>/`; (2) serve `apps/web/dist` from the server (or a second service + CORS); (3) a runner token of its own per deploy (not the public repo's demo one); (4) decide person identity (today the server trusts `authorId`: fine on localhost, not with a public URL); (5) the runner accepts `wss://`. Legal rule (research 08/22): the teacher provides the agent's credential — their `claude setup-token` in *their* env vars, or an API key — it never passes through our hands.
