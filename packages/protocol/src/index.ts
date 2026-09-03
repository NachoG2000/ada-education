/* @ada/protocol — the one place where Ada's domain model lives.
   Consumed by all three pieces: apps/web, apps/server, and packages/runner.
   The API events (REST + WS) get added here once the server is implemented
   (openspec/changes/demo-local-backend/specs/community-server). */
export * from "./types.js"
export * from "./events.js"
export * from "./hosted.js"
