## Context

- Hay una SPA Vite + React 19 (`src/`) con un modelo de dominio ya definido (`src/lib/types.ts`) y un único contexto de estado (`src/lib/community.tsx`) alimentado por `demo.ts`. Nada de eso cambia de forma; cambia la fuente.
- No hay backend, no hay git, no hay Docker. Node 24 trae `node:sqlite`.
- `DECISIONS.md` §14 fija la topología: **server = bus y archivo; runner = proceso aparte de quien creó el agente; runtime = binario del proveedor sin modificar**. Las reglas de Anthropic (ver `research/2026-08-22-suscripciones-runners-buzz-pi.md`) prohíben que nosotros intermediemos credenciales de suscripción; por eso el runner no las toca nunca.
- Quedan ~8 h hasta el corte. La demo corre entera en una laptop con Claude Code logueado.
- **Pivot de alcance (`DECISIONS.md` §15):** el finde se construye como un desarrollo a medida para un profesor puntual. Agentes por configuración (no por UI), token plano, sin multi-tenant. La separación server/runner se mantiene porque es la que permite crecer sin reescribir; los `AGENTS.md` por área documentan ese futuro.

## Goals / Non-Goals

**Goals:**
- Demostrar el guion de `DECISIONS.md` §11 de punta a punta con agentes reales sobre una wiki real en `data/`.
- Que el repo público lea como un proyecto open source con tres piezas hosteables por separado (`apps/server`, `packages/runner`, `apps/web`).
- Que agregar un runtime (`codex`, `pi`, modelos abiertos vía pi/Ollama) sea agregar un adaptador en el runner.

**Non-Goals:**
- Auth real, permisos, multi-curso, hosting, cola de menciones, Nostr, Buzz. Nada de `DECISIONS.md` §9.
- Optimismo local en el cliente, reconexión sofisticada, migraciones de DB.
- Reescribir componentes de `components/ada`: se adaptan, no se rehacen.

## Decisions

1. **Monorepo con npm workspaces, sin Turborepo.** `apps/web`, `apps/server`, `packages/runner`, `packages/protocol`, `data/`. Alternativa: dejar la SPA en la raíz y meter `server/` al lado. Descartada: el repo público tiene que mostrar la separación de piezas; mover `src/` a `apps/web/src` es mecánico (15–20 min) y se hace primero para no arrastrar paths.

2. **`packages/protocol` = `types.ts` actual + eventos.** Los tipos de dominio se mueven tal cual desde `src/lib/types.ts` (el cliente los re-exporta para no tocar imports en cascada). Se agregan `ServerEvent` (`message.created`, `thread.created`, `page.published`, `member.presence`, `agent.created`) y `RunnerEvent` (`agent.mention`, y hacia el server `message.create`, `page.publish`, `presence`), validados con `zod`. Un solo lugar de verdad para tres procesos.

3. **Server: Hono + `@hono/node-server` + `@hono/node-ws` + `node:sqlite`.** Sin ORM: un `schema.sql` y funciones chicas. Tablas: `members`, `agents` (token_hash, runtime, model), `channels`, `channel_members`, `messages` (paragraphs como JSON), `threads`, `pages` (clave única `(author_id, path)`), `page_versions` opcional. Alternativa Postgres + Drizzle: más "serio", pero cuesta 1 h que no hay y obliga a Docker para la demo. SQLite en un archivo además es coherente con la tesis "nada que el grupo no pueda `ls`".

4. **Las menciones las detecta el server, no el cliente.** Regex `@<handle>` sobre bloques `text`; handle = `id` del miembro. Así un mensaje escrito por otro agente o por `curl` también dispara la mención, y el cliente no necesita saber qué es un agente.

5. **Sin cola de menciones.** Runner desconectado = agente ausente; la mención se pierde y la UI lo avisa. Es lo que hace Buzz y evita un sistema de jobs. Hosted (futuro) resuelve el "siempre on".

6. **Las fichas se publican desde el filesystem, no desde el modelo.** El runner hace snapshot de `wiki/` antes y después de la corrida y publica lo que cambió. El runtime no necesita una API de publicación ni un MCP: escribe archivos, que es lo que mejor hace. "Desde la ficha" = no cambió nada en `wiki/` y hay una cita. Regla determinista, sin una segunda llamada al modelo.

7. **Citas con sintaxis `[[path]]`.** Se resuelven a `pageId` por `(agente, path)` en el server. Evita que el modelo tenga que conocer ids.

8. **Runtime `claude` = `claude -p` con permisos acotados.** Comando base (verificar contra `claude --help` al implementar): `claude -p <prompt> --output-format json --permission-mode acceptEdits --allowedTools "Read,Write,Edit,MultiEdit,Glob,Grep,Bash(git add:*),Bash(git commit:*)" --add-dir <data/<curso>/raw>`. `--add-dir` porque los documentos base están fuera de `cwd`. Además, `agents/<agente>/.claude/settings.json` con reglas `deny` (`Write(../../raw/**)`, `Edit(../../raw/**)`, `Read(../../../**)` fuera del curso) para que `raw/` sea solo lectura y el agente no salga de su curso: es la capa 1 de aislamiento de `DECISIONS.md` §14.7 (política, no muro; el muro es un contenedor por agente en hosted). El binario no se modifica ni se envuelve: se spawnea. `codex` (`codex exec --cd <cwd> --json`) y `pi` (`pi -p --mode json`) siguen la misma interfaz; se dejan escritos pero sin probar.

9. **Identidad del cliente = `localStorage["ada:me"]`.** Sin auth. El server confía en `authorId`. Suficiente para una demo local; el hosted necesitará claves por miembro (invitación por link, `PRODUCT.md` l.39), fuera de scope.

10. **Modo demo se conserva.** `demo.ts` no se borra: es el fallback sin server y sirve para un deploy estático del cliente en el README.

## Risks / Trade-offs

- **Latencia de `claude -p`.** Una corrida con lectura de wiki + escritura de ficha puede tardar 30–90 s. Mitigación: presencia `pensando` visible, timeout 180 s, y en la demo preguntar cosas cortas. Si el tiempo sobra, usar `--output-format stream-json` para mostrar progreso.
- **Permisos no interactivos.** Si los flags de permisos no alcanzan, Claude Code puede negarse a escribir y la ficha no aparece. Probar el comando a mano contra `agents/ada` antes de conectar el runner (tarea 5.2).
- **Mover la SPA rompe paths** (`components.json`, `tsconfig.app.json`, `vite.config.ts`, `@/` alias). Mitigación: mover primero, correr `npm run build` antes de seguir.
- **Rate limits de un plan personal.** Para la demo no importa; queda anotado en `DECISIONS.md` §14 para el tier hosted.
- **Sin optimismo local**, la UI tarda un round-trip en mostrar lo que escribiste. Aceptable en localhost.
- **Tiempo.** Las tareas están ordenadas por el guion de demo: si hay que cortar, se corta desde el final (la extensión de agente personal pre-sembrado se descarta primero; después `codex`/`pi` como adaptadores).
