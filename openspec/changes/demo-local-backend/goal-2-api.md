# Goal: implementar la API (`apps/server` + eventos en `@ada/protocol` + seed)

> Prompt de goal para un agente implementador (Codex). Autoridad: las specs de este change. Si algo acá contradice una spec, manda la spec.

## Objetivo

En este repo (monorepo npm workspaces, Node 24), implementar el servidor de la comunidad según `openspec/changes/demo-local-backend/specs/community-server/spec.md`, cubriendo las tareas **1.4b, 2.1–2.8 y 3.1** de `openspec/changes/demo-local-backend/tasks.md`. Leé antes: ese spec completo, `tasks.md`, `design.md` (decisiones 2, 3, 4, 5, 7 y la nota de pivot), `AGENTS.md` raíz, `apps/server/AGENTS.md`, `packages/protocol/AGENTS.md` y `data/AGENTS.md`.

## En scope

1. **`packages/protocol`** (tarea 1.4b): agregar `src/events.ts` con esquemas `zod` y tipos derivados, re-exportado desde `src/index.ts`. Agregar `zod` como dependencia del package. Definir exactamente:
   - `CommunitySnapshot = Omit<Community, "meId">`.
   - `ServerEvent` (server → clientes web): `{ type: "message.created", payload: { message: Message } }` | `{ type: "thread.created", payload: { thread: Thread } }` | `{ type: "page.published", payload: { page: Page, message: Message } }` | `{ type: "member.presence", payload: { memberId: string, presence: Presence, runtime?: string, model?: string } }`.
   - `RunnerServerMessage` (server → runner): `{ type: "agent.mention", payload: { channelId: string, threadId?: string, message: Message, from: Member, context: Message[] } }`.
   - `RunnerClientMessage` (runner → server): `{ type: "presence", payload: { presence: Presence, runtime?: string, model?: string } }` | `{ type: "message.create", ref: string, payload: { channelId: string, threadId?: string, paragraphs: MessageBlock[][], fromPage?: { pageId: string, ago: string }, publishes?: string } }` | `{ type: "page.publish", ref: string, payload: PagePublishInput }`.
   - `PagePublishInput = { channelId, path: string, title, type: PageType, visibility: Visibility, sources: Page["sources"], replaces?: string (path), body: string, base?: boolean }` (la `version`, `state`, `id`, `authorId` y `publishedAt` las decide el server).
   - Respuestas a mensajes con `ref`: `{ type: "ack", ref: string, ok: true, message?: Message, page?: Page }` | `{ type: "ack", ref, ok: false, error: string }`.
2. **`apps/server`** (tareas 2.1–2.8): Hono + `@hono/node-server` para REST, `ws` (WebSocketServer sobre el mismo http server) para `/ws` y `/ws/runner`, `node:sqlite` (`DatabaseSync`) para storage. Estructura sugerida: `src/index.ts` (arranque), `src/db.ts` (apertura + `schema.sql` + funciones por tabla), `src/api.ts` (rutas REST), `src/ws.ts` (hub de clientes + runners, broadcast), `src/mentions.ts` (detección + armado de contexto), `src/seed.ts` (script). Configuración por env: `PORT` (default **8787**), `ADA_DB` (default `apps/server/data/ada.db`), `ADA_COURSE` (default `data/redes-neuronales-2c-2026`).
   - Tablas: `community` (una fila: id, name, subtitle, initial), `members` (personas y agentes; columnas para ambos, `kind` discrimina; agentes con `token` en texto plano, `runtime`, `model`), `channel_members`, `channels`, `messages` (paragraphs/fromPage/publishes/reactions como JSON), `threads`, `pages` (única `(author_id, path)`). Presencia: **en memoria**, no en DB; al arrancar, agentes `ausente` y personas `en-linea`.
   - `GET /api/community` devuelve `CommunitySnapshot` con la misma forma que arma `apps/web/src/lib/demo.ts` (miralo como referencia de forma). `threads.replyIds` se deriva de `messages.thread_id` ordenado por `at`.
   - Menciones: regex sobre bloques `kind:"text"` buscando `@<id>` donde `<id>` es id de un miembro `kind:"agent"` del canal; contexto = últimos 20 mensajes del thread (o del canal si no hay thread) en orden cronológico, sin incluir mensajes futuros. Entregar solo al runner conectado de ese agente; si no hay runner conectado, no encolar nada.
   - `page.publish` / `POST /api/pages`: dedupe por `(authorId, path)` → si existe, `version+1` y `state:"actualizada"`; si trae `replaces` (path), resolverlo a la page del mismo autor y marcarla `state:"reemplazada"`; crear siempre el `Message` con `publishes` en el canal; emitir `page.published`.
   - `/ws/runner?token=`: comparar token plano contra `members.token`; inválido → cerrar con código 4401. Conectado → presencia `en-linea` + broadcast; desconexión → `ausente` + broadcast. Validar que todo lo que el runner escribe use el `authorId` de su agente.
3. **`data/redes-neuronales-2c-2026/community.json`** (tarea 3.1): curso "Redes Neuronales 2C 2026", canales `general`, `dudas`, `03-backprop` (group `curso`), personas `martin` (profesor, tone `sello-soft`), `sofia`, `ignacio` (alumnos), agente `ada` (`scope:"comunidad"`, `createdBy:"martin"`, en los tres canales, `token:"ada-demo-token"`, `figureSeed:"ada"`). Incluir `baseDocs: [{ channelId:"03-backprop", path:"martin/modulos/03-backprop/backprop.md", title:"Backpropagation — documento base", type:"apunte" }]` y crear ese archivo en `raw/` con 3–4 párrafos placeholder en español rioplatense (el contenido real es otra tarea). El seed publica los baseDocs como `Page` con `base:true` y `state` sin valor.
4. Scripts: en `apps/server/package.json`: `dev` (`tsx watch src/index.ts`), `seed` (`tsx src/seed.ts`), `check` (`tsc --noEmit`). En el raíz: `dev:server`, `seed` delegando al workspace, y `dev` pasa a correr web+server en paralelo (agregá `concurrently` como devDep raíz). `tsx` como devDep raíz. `apps/server/tsconfig.json` propio (module nodenext, strict, igual de estricto que el resto: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`).

## Fuera de scope (NO hacer)

- No tocar `apps/web` ni `packages/runner` (salvo nada). No implementar el runner ni el cliente.
- No agregar Postgres, ORMs, Docker, auth de personas, hashing de tokens, colas de menciones, ni endpoints que la spec no pida (`POST /api/agents` NO existe: `DECISIONS.md` §15).
- El server NUNCA llama a un modelo de IA ni lee credenciales (`apps/server/AGENTS.md`, regla de oro).
- No reformatear archivos existentes ni "mejorar" cosas fuera del scope.

## Convenciones

- Todo en español rioplatense con voseo: comentarios, mensajes de error, logs, JSON del curso.
- Tipos siempre desde `@ada/protocol`; no redefinir interfaces del dominio en el server.
- Código directo y chico: funciones, no clases; sin capas de abstracción especulativas.

## Verificación (criterio de terminado)

Correr en orden y pegar la salida en el reporte final:
1. `npm install` (raíz) y `npm run check -w @ada/server` sin errores; `npm run build` (la web sigue compilando); `npm run lint` sin errores nuevos.
2. `npm run seed` → loguea el curso creado; correrlo dos veces no duplica (idempotente: recrear DB o upsert, decidilo y documentalo).
3. `npm run dev:server` y con curl:
   - `curl -s localhost:8787/api/community | jq '.channels | length'` → 3; `.members | length` → 4; `.pages | length` → 1 (la base).
   - POST de un mensaje de `sofia` a `dudas` con un bloque `text` "hola @ada" → 200 con el mensaje persistido (con `id` y `at` del server).
   - `curl -s localhost:8787/api/community | jq '.messages | length'` → 1.
4. Smoke test WS (escribí `apps/server/scripts/smoke.ts`, corrible con `tsx`, y dejalo en el repo): abre un cliente en `/ws`, abre un runner con `?token=ada-demo-token`, verifica que (a) llega `member.presence` de `ada` en línea, (b) al postear "hola @ada" por REST el runner recibe `agent.mention` con `context`, (c) el runner manda `page.publish` + `message.create` con cite y el cliente recibe `page.published` y `message.created`, (d) token inválido cierra con 4401. El script termina con exit 0 y un resumen.
5. Actualizar: checkboxes de `tasks.md` (1.4b, 2.1–2.8, 3.1), la sección "Hoy" de `apps/server/AGENTS.md` y de `packages/protocol/AGENTS.md`, y la tabla de estado del `README.md` raíz (server → ✅ funcionando local).

## Condiciones de corte (parar y reportar en vez de improvisar)

- Si el repo no coincide con lo que este goal describe (paths, tipos, scripts), parar y reportar la diferencia.
- Si `node:sqlite` no está disponible en el Node instalado, reportar la versión y parar (no reemplazar por better-sqlite3 sin avisar).
- Si un comando de verificación falla dos veces por la misma causa, parar y reportar el error exacto.
- Reporte final: qué tareas quedaron tildadas, comandos corridos con su salida, decisiones tomadas donde la spec daba libertad, y qué quedó afuera.

Al terminar: un solo commit con mensaje en español que empiece con `api: `.
