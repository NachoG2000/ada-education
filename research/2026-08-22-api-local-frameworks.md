# Local API: frameworks and runtime

Date: 2026-08-22.

This note records the technical claims used to implement Ada's local API. Every source was verified against the original on 2026-08-22.

- **Hono on Node:** Hono's current documentation for Node shows startup with `@hono/node-server` and a `WebSocketServer({ noServer: true })` passed to `serve` via the `websocket` option; it also flags `@hono/node-ws` as deprecated. Primary source verified: [Hono — Getting Started: Node.js](https://hono.dev/docs/getting-started/nodejs).
- **WebSocket:** the `ws` README explicitly documents `WebSocketServer({ noServer: true })`, the manual route via `server.on("upgrade")` and `handleUpgrade`, and the ability to route connections across multiple paths. Primary source verified: [`ws` — README](https://github.com/websockets/ws/blob/master/README.md).
- **Built-in SQLite in Node:** Node 24 exposes `node:sqlite` and `DatabaseSync`, a synchronous API for SQLite. The documentation states the API has been available since Node 22.5.0. Primary source verified: [Node.js v24 — `node:sqlite`](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html).

Local verification: `node --version` returned `v24.14.1`; `node:sqlite` is available in this environment. The project's current contract uses `DatabaseSync` and plain tokens because this cut's development runs locally on the professor's computer (`DECISIONS.md` §15).
