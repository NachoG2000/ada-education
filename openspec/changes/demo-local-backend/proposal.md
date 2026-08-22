## Why

La SPA corre contra una comunidad sintética (`apps/web/src/lib/demo.ts`, hoy `src/lib/demo.ts`). No hay servidor, no hay agentes reales y no hay wiki en filesystem: nada de la tesis de `DECISIONS.md` §1–§6 se puede demostrar todavía. El fork de Buzz (§7) no se hizo y el checkpoint de las 14:00 pasó, así que este change ejecuta el **Plan B** de §7 (server propio + mismo `data/` + CLI del agente), con la topología de §14: **un agente = identidad + carpeta + runner**, y el server nunca corre inferencia.

**Alcance (pivot del mentor, `DECISIONS.md` §15): un desarrollo a medida para un profesor puntual, todo en su computadora.** Curso, canales, personas y agentes definidos en `data/<curso>/community.json`; sin creación de agentes por UI, sin agentes personales de alumnos, sin hashing de tokens, sin hosting. El repo va a ser público: la estructura igual deja claro que server, runner y cliente son piezas separadas que mañana crecen por separado (los `AGENTS.md` de cada área describen ese futuro).

## What Changes

- **Monorepo con npm workspaces.** La SPA se mueve a `apps/web`. Nacen `apps/server` (servidor de la comunidad), `packages/runner` (CLI `ada-runner` que corre agentes) y `packages/protocol` (tipos y eventos compartidos). Los cursos viven en `data/<curso>/`.
- **Servidor de la comunidad** (`apps/server`): Node 24 + Hono + `node:sqlite` + WebSocket. Guarda miembros, canales, mensajes, threads y **fichas publicadas**; detecta menciones a agentes y se las reenvía al runner conectado; publica presencia. No llama a ningún modelo.
- **Runner** (`packages/runner`): proceso aparte que se conecta *saliente* al server con el token de un agente, recibe menciones, ejecuta el runtime elegido (`claude` este finde; `codex` y `pi` como adaptadores con la misma interfaz) con `cwd` en la carpeta del agente, convierte citas a fichas, detecta fichas nuevas/modificadas en `wiki/` y las publica, y hace un commit por corrida.
- **Wiki del agente** (`data/<curso>/agents/<agente>/`): `CLAUDE.md`/`AGENTS.md` con las reglas de §6, `wiki/index.md`, `log.md`, frontmatter fijo. Curso semilla `redes-neuronales-2c-2026` con `raw/martin/modulos/03-backprop/backprop.md`.
- **Cliente web** (`apps/web`): reemplaza `demo.ts` por un cliente del server (bootstrap por REST + eventos por WS) detrás del mismo `CommunityProvider`; muestra presencia de agentes. Sin `VITE_ADA_SERVER`, sigue funcionando con la demo sintética. La creación de agentes desde la UI queda fuera del finde (§15): los agentes se definen en la configuración del curso.

## Capabilities

### New Capabilities
- `community-server`: estado de la comunidad (miembros, canales, mensajes, threads, fichas publicadas), API REST de bootstrap y escritura, eventos WS para clientes y runners, detección de menciones, presencia de agentes, semilla del curso.
- `agent-runner`: CLI que conecta un agente al server, ejecuta el runtime con `cwd` en su carpeta, arma el prompt con la capa inmediata, publica fichas y respuestas, reporta presencia, y expone la interfaz de runtimes (`claude` | `codex` | `pi`).
- `agent-wiki`: layout de la carpeta del agente, frontmatter de fichas, reglas del agente (`CLAUDE.md`), contrato de citas y de "respondido desde la ficha", ingest y versionado con git.
- `web-client`: conexión en vivo del cliente al server, identidad local del usuario, presencia, composición con menciones, creación de agentes, y modo demo sin server.

### Modified Capabilities
<!-- No hay specs previas en openspec/specs: todo es nuevo. -->

## Impact

- `src/` → `apps/web/src/` (mover, no reescribir). `vite.config.ts`, `tsconfig*.json`, `components.json`, `index.html`, `public/` acompañan.
- `package.json` raíz pasa a ser el workspace; los scripts `dev`, `build`, `lint` se redefinen para todo el monorepo.
- Nuevas dependencias: `hono`, `@hono/node-server`, `@hono/node-ws`, `zod`, `commander` (o `citty`), `ws` en el runner. Sin ORM, sin Postgres, sin Docker este finde.
- `AGENTS.md`/`CLAUDE.md` y `README.md` se actualizan al nuevo layout (dejan de decir "este repo contiene solo la UI").
- Requiere `git init` del repo (hoy no es un repositorio) y, por separado, `git init` dentro de cada carpeta de agente para el versionado de la wiki.
- Claude Code instalado y logueado en la laptop de la demo; el runner no maneja credenciales.
