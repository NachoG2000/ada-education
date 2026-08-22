## 1. Repo y workspace (≈30 min)

- [ ] 1.1 `git init` en la raíz; `.gitignore` para `node_modules`, `dist`, `apps/server/data/*.db`, `data/**/agents/**/.git` no (se versiona la wiki, no el `.git` interno: agregar `data/**/agents/*/.git/` al ignore).
- [ ] 1.2 Mover `src/`, `index.html`, `public/`, `vite.config.ts`, `tsconfig.app.json`, `components.json`, `.oxlintrc.json` a `apps/web/`; `package.json` de `apps/web` con los scripts actuales. Verificar `npm run build` y `#figuras`.
- [ ] 1.3 `package.json` raíz como workspace (`apps/*`, `packages/*`) con scripts `dev` (server + web en paralelo), `dev:web`, `dev:server`, `runner`, `seed`, `build`, `lint`, `typecheck`.
- [ ] 1.4 `packages/protocol`: mover `src/lib/types.ts` ahí, agregar eventos con `zod`; `apps/web/src/lib/types.ts` pasa a re-exportar.
- [ ] 1.5 `README.md` nuevo: qué es Ada, diagrama server/runner/runtime, "correr la demo en 4 comandos", licencia Apache-2.0 con `LICENSE`.

## 2. Servidor de la comunidad (≈2 h)

- [ ] 2.1 `apps/server` con Hono + `node:sqlite`; `schema.sql`; `db.ts` con funciones por tabla.
- [ ] 2.2 `GET /api/community` devolviendo `Community` (sin `meId`; lo pone el cliente).
- [ ] 2.3 `POST /api/channels/:id/messages`, `POST /api/threads`; emisión de `message.created` / `thread.created` por `/ws`.
- [ ] 2.4 Detección de menciones `@handle` → `agent.mention` al runner conectado, con los últimos 20 mensajes del contexto.
- [ ] 2.5 `/ws/runner?token=`: validación por hash, presencia `en-linea`/`ausente`, eventos `presence`, `message.create`, `page.publish` con verificación de `authorId`.
- [ ] 2.6 `POST /api/pages` + `page.publish`: dedupe por `(authorId, path)`, versionado, `replaces`, mensaje con `publishes`, evento `page.published`.
- [ ] 2.7 Agentes desde `community.json` en el seed (token plano por agente); sin endpoint de creación (§15).
- [ ] 2.8 `npm run seed` desde `data/<curso>/community.json`; ficha base `backprop.md` con `base: true`.

## 3. Curso semilla y agente Ada (≈40 min)

- [ ] 3.1 `data/redes-neuronales-2c-2026/community.json` (curso, canales, personas, agente `ada`, token de demo fijo para no copiarlo en vivo).
- [ ] 3.2 `raw/martin/modulos/03-backprop/backprop.md`: documento base en español, ~3 páginas, ficticio.
- [ ] 3.3 `packages/runner/templates/CLAUDE.md` con las seis reglas de `agent-wiki`, sintaxis `[[path]]`, ingest, formato de respuesta; `agents/ada/CLAUDE.md` = template + instrucciones de Ada; `wiki/index.md`, `wiki/log.md` vacíos.
- [ ] 3.4 `git init` dentro de `agents/ada/` (lo hace el runner en 5.6; acá solo verificar).

## 4. Runner (≈2 h)

- [ ] 4.1 `packages/runner` CLI (`commander`), flags + env vars, validación de `--cwd`, `detect()` del runtime, conexión WS con reconexión simple.
- [ ] 4.2 Runtime `claude`: probar a mano `claude -p` con los flags de `design.md` §8 contra `agents/ada` (lee `index.md`, escribe una ficha, devuelve texto). Ajustar flags hasta que funcione sin prompts interactivos.
- [ ] 4.3 Armado del prompt desde `agent.mention` (canal, quién, contexto cronológico, pregunta).
- [ ] 4.4 Parser de respuesta: párrafos, `[[path]]` → `cite`, bloques de código → `code`.
- [ ] 4.5 Snapshot de `wiki/` antes/después; lectura de frontmatter; mapeo `type`; `supersedes` → `replaces`; publicación por WS; `fromPage` cuando no hubo cambios y hay cita.
- [ ] 4.6 `git init` si falta; commit por corrida; cola en serie; timeout y mensaje de error del agente; presencia `pensando`/`publicando`.
- [ ] 4.7 Adaptadores `codex` y `pi` con la misma interfaz (escritos, no probados), y `README` del runner explicando dónde viven las credenciales.

## 5. Cliente web conectado (≈1.5 h)

- [ ] 5.1 `apps/web/src/lib/api.ts` (fetch + WS) y `CommunityProvider` con reducer para los eventos; selección de fuente por `VITE_ADA_SERVER`.
- [ ] 5.2 Selector "¿quién sos?" → `localStorage["ada:me"]`.
- [ ] 5.3 `Composer` que postea por REST, con autocompletar de `@` y aviso de agente desconectado.
- [ ] 5.4 Presencia en vivo en lista de miembros, cabecera de thread y ficha del agente (`ausente` = "desconectado", runtime/modelo del runner).
- [ ] 5.5 `page.published` → franja de fichas + tarjeta de publicación; `fromPage` → sello con animación existente.

## 6. Demo de punta a punta y docs (≈40 min)

- [ ] 6.1 Ensayar el guion (`DECISIONS.md` §11 pasos 1-6 + terminal, según §15): seed → runner de `ada` → ingest → pregunta de `sofia` → pregunta parecida de `ignacio` (`fromPage`) → decisión con `supersedes` → `ls data/` + `git log`. Extensión solo si sobra: agente personal `tutor-sofia` pre-sembrado en `community.json` con su propio runner.
- [ ] 6.2 Actualizar `AGENTS.md` raíz (sección Comandos y Arquitectura al layout nuevo) y crear el `AGENTS.md` de cada workspace nuevo (`apps/web`, `apps/server`, `packages/runner`, `packages/protocol`, `data/`): qué es hoy + cómo crece mañana.
- [ ] 6.3 Anotar en `DECISIONS.md` qué quedó fuera al corte.
