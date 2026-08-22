# API local: frameworks y runtime

Fecha: 2026-08-22.

Esta nota registra las afirmaciones técnicas usadas para implementar la API local de Ada. Cada fuente se verificó en la fuente original el 22/08/2026.

- **Hono en Node:** la documentación actual de Hono para Node muestra el arranque con `@hono/node-server` y un `WebSocketServer({ noServer: true })` pasado a `serve` mediante la opción `websocket`; también marca `@hono/node-ws` como deprecado. Fuente primaria verificada: [Hono — Getting Started: Node.js](https://hono.dev/docs/getting-started/nodejs).
- **WebSocket:** el README de `ws` documenta explícitamente `WebSocketServer({ noServer: true })`, la ruta manual con `server.on("upgrade")` y `handleUpgrade`, y la posibilidad de enrutar conexiones en múltiples paths. Fuente primaria verificada: [`ws` — README](https://github.com/websockets/ws/blob/master/README.md).
- **SQLite integrado en Node:** Node 24 expone `node:sqlite` y `DatabaseSync`, una API síncrona para SQLite. La documentación indica que la API está disponible desde Node 22.5.0. Fuente primaria verificada: [Node.js v24 — `node:sqlite`](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html).

Verificación local: `node --version` devolvió `v24.14.1`; `node:sqlite` está disponible en este entorno. El contrato vigente del proyecto usa `DatabaseSync` y tokens planos porque el desarrollo de este corte corre localmente en la computadora del profesor (`DECISIONS.md` §15).
