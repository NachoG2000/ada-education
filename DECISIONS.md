# DECISIONS.md — Ada Education

Contexto completo del proyecto. Léelo entero antes de tocar código. Actualizado sábado 22/08 (Aleph Hackathon 2026, General Track únicamente).

> **Qué es este archivo:** dirección e ideas, con su historia (las secciones reemplazadas quedan marcadas, no se borran). **No describe el código actual.** El estado real del código vive en `AGENTS.md` (mapa del repo) y `openspec/` (spec de lo que se está construyendo). El alcance vigente del finde es **§15**; §14 es la arquitectura a futuro.

---

## 0. Problema

Este archivo es la solución. **El problema está en `PROBLEM.md`**: cuatro fugas por las que el conocimiento de un curso se pierde (se repregunta lo respondido; se pregunta donde nada queda; desde 2025 se pregunta en privado a una IA que no conoce el curso; y al terminar el cuatrimestre no queda nada), a quién le duele, causas raíz, y los ocho criterios (§7) que cualquier feature tiene que cumplir. Evidencia con fuentes en `research/2026-08-22-impacto-del-problema-en-2026.md`.

Antecedente: el TFG de noviembre de 2024 (`research/2024-11-tfg-siglo21.md`) tenía la misma intuición con un problema genérico y una solución que descartamos (LMS en Next.js + Postgres, chatbot por pestaña, gamificación). Lo que sobrevive de ahí es la visión de abajo; lo que no, está explicado en `PROBLEM.md` §9.

## 1. Visión

Every group of people who learn together builds up knowledge that mostly disappears: the explanation that finally made something click, the reason a decision was made, the question three people asked separately. We believe that knowledge should belong to the group, grow on its own, and outlive any single conversation. So we're building a place where humans and AI agents are members of the same community, where what gets understood once becomes something everyone can read, and where the agents remember alongside the people instead of starting over every time.

**Humans and agents learn together, and what they learn stays with them.**

Tres compromisos que no cambian:
1. **Los agentes son miembros.** Identidad propia, pertenecen a canales, firman lo que escriben. Los crea la comunidad, no la plataforma.
2. **El conocimiento vive en archivos que el grupo posee.** Páginas legibles, versionadas, con fuentes. Nada que el grupo no pueda hacer `ls`.
3. **Se compila una vez, se compone cada vez.** Lo caro es leer las fuentes crudas y entenderlas, y eso se hace una sola vez: el resultado son fichas conectadas entre sí (temas, decisiones, dificultades), no una lista de respuestas. Cada respuesta se compone fresca desde las fichas, a la medida de quien pregunta, sin volver a las fuentes. **No es un caché de respuestas:** la segunda persona que pregunta «lo mismo» lo pregunta con otras palabras y otro hueco, y lo que le sirve es una respuesta nueva armada con lo que el grupo ya entendió, quizás conectando dos fichas que la primera persona nunca necesitó juntas. Si el ángulo nuevo no estaba cubierto, la ficha se enriquece; no nace un duplicado. La memoria compila, no acumula.

## 2. Tesis a probar

1. La UI del futuro es **Buzz** (Block) con agentes como miembros, canales y permisos. Buzz es la referencia única; no comparamos con Slack.
2. La memoria (second brain / company brain) funciona en **filesystem**, no en DB. Referencias: LLM wiki de Karpathy, Stash (Fergana), Archil. Contrapunto: Cortex (DB relacional + world model compilado). Acá probamos lo opuesto.
3. **Educación** es un buen dominio: un curso es un grupo de cerebros con canales, decisiones y conocimiento que se pierde cada cuatrimestre.

## 3. Qué es Buzz (y por qué lo forkeamos)

Buzz es un workspace self-hosteable donde humanos y agentes comparten las mismas rooms. Es un relay Nostr: cada mensaje, reacción, paso de workflow y evento de git es un evento firmado en un solo log, con la misma forma, identidad y audit trail sea persona o proceso. Backend en PostgreSQL (eventos + full-text search), Redis (pub/sub) y S3/MinIO para media; cliente desktop en Tauri + React; servidor en Rust. Habla NIP-01, NIP-42 (auth) y NIP-34 (git). Funciona hoy: relay, canales, threads, DMs, canvases, media, búsqueda, audit log, desktop app, buzz-cli, harness ACP para Goose/Codex/Claude Code, motor de workflows, personas y equipos de agentes, huddles. En progreso: mobile (Flutter), approval gates, push. Pendiente: git hosting, web-of-trust, emojis/polls, E2E en DMs. Tiene modo multi-comunidad (tenants scopeados por host) y deploy del relay a Railway en un click. Licencia Apache-2.0.

**Cómo entran los agentes.** El harness `buzz-acp` escucha @mentions en el relay, le pasa el prompt al agente, y el agente responde usando el Buzz CLI. Buzz Desktop permite registrar cualquier runtime que hable ACP: Goose, Claude Code, Codex y Buzz Agent son tier-1 con instaladores y onboarding; Cursor, OpenCode, OpenClaw y otros son presets.

**Por qué esto cambia todo para nosotros:** el agente de curso puede ser **Claude Code (o Codex) corriendo en la carpeta de la wiki**, invocado por `buzz-acp` en cada @mention, respondiendo con `buzz-cli`. El harness, la identidad del agente, los canales, los threads y los canvases ya existen. Nuestro trabajo es la wiki, el skill del agente, y la capa "curso" sobre "organización".

**Reglas para forkear.** Apache-2.0 permite fork, renombrar y uso comercial. Hay que conservar `LICENSE` y `NOTICE` con la atribución a Block, y no usar "Buzz" como nombre del producto (marca). Block no acepta PRs externos; irrelevante para un fork. Berd describe "distribution seams" para que terceros armen distribuciones propias; buscar si Buzz tiene lo mismo antes de modificar el core.

**Nombre del producto:** Ada Education (a confirmar). El agente de ejemplo se llama Ada.

## 4. Modelo de producto: open-core, igual que Buzz

- **Open source (Apache-2.0).** Cualquier profesor o institución puede correrlo gratis: relay + desktop + agentes con su propia API key o su suscripción de Claude/Codex (buzz-acp ya soporta los runtimes).
- **Tres formas de correrlo**, las mismas que Buzz: (a) todo local con `docker compose` + desktop app; (b) relay self-hosteado en Railway en un click + desktop app; (c) **hosted** (premium): relays multi-comunidad administrados por nosotros, onboarding por link, agentes gestionados, sin setup.
- **No hay "API propia" aparte del relay.** El relay es la API. Un cliente web, si se hace, habla Nostr contra el relay igual que el desktop.
- **Premium futuro:** hosting, agentes gestionados (con nuestras API keys, nunca con suscripciones de usuarios: ver §14), backups de la wiki, analíticas del curso para la institución.

Respuesta a "¿local y que cada uno se hostee, o web fácil?": **las dos, porque Buzz ya separa relay de cliente.** El hackathon demuestra (a). El producto vende (c).

## 5. Entidades (Buzz → curso)

> Tabla histórica: mapea conceptos de Buzz a los nuestros. Sigue siendo útil como diccionario, pero ya no hay Buzz en el stack (§14); "Canvas" hoy es la ficha publicada en nuestro server.

| Buzz | Ada Education | Nota |
|---|---|---|
| Community | Curso | Un relay / un tenant = un curso (multi-comunidad después) |
| Channel | Canal estable (`#general`, `#dudas`, `#03-backprop`) | Uno por módulo |
| Branch-as-room (canal volátil) | Canal de trabajo (TP, evaluación) | Nace con una consigna, se archiva al cerrar. **Solo diseño este finde.** |
| DM | Canal privado alumno ↔ agente personal | |
| Canvas | Página | Tipo, autor, versión, `sources`, `supersedes`, visibilidad |
| Agent (persona + runtime) | Agente de curso / agente personal | El profesor crea los de curso; cada alumno puede crear uno personal |
| Member / role | profesor · alumno · agente | |
| Media upload | Documento base del canal | Lo sube el profesor en settings del canal; el agente lo ingiere |

**UI:** mismo layout de tres paneles que Buzz y mismos componentes, para que se sienta familiar. Cambios solo donde el curso lo pide: franja de páginas del canal, marcador "respondido desde una página", ficha de agente con "en qué canales está / qué páginas publicó", estado de canal de trabajo. Estilo en `DESIGN.md`.

## 6. Modelo de memoria

Tres capas, como un LLM tradicional:

| Capa | Dónde vive | Quién la escribe | Cuándo se lee |
|---|---|---|---|
| **Inmediata** | últimos N mensajes del canal/thread, los manda el server con cada mención | todos | en cada respuesta del agente |
| **Wiki (compilada)** | filesystem, carpeta del agente | solo ese agente | en cada respuesta (lee `index.md` + ≤5 páginas) |
| **Raw** | filesystem, documentos base y uploads | humanos | en ingest |

**Ingest no es por mensaje.** Triggers: `@agente ingest` explícito, o cada N=20 mensajes en un canal, o diario. Entre ingests, el agente responde con la capa inmediata + la wiki, y archiva respuestas reutilizables como páginas en el momento. Así la wiki está "al día" sin recompilar por mensaje.

```
data/<curso>/
  raw/<profesor>/modulos/<nn>-<slug>/...
  raw/<alumno>/...
  agents/<agente>/
    wiki/
      index.md
      log.md
      modulos/<nn>-<slug>/<tema>.md
      decisiones/<fecha>-<slug>.md
      preguntas/<slug>.md            ← cómo se preguntó un tema (índice de ángulos), apunta a modulos/; no es un log de Q&A
      dificultades/<modulo>.md        ← agregado por módulo, visible al profesor
    about/<alumno>.md                 ← lo que el agente sabe de cada alumno
  people/<alumno>/wiki/               ← escribe el agente personal del alumno
```

**Permisos = composición de carpetas.** Cada agente ve un árbol virtual con las carpetas de los canales donde es miembro + la suya. Si no está montada, no existe. Archil hace exactamente esto (capas montadas con permisos); para el finde, directorio local con la misma estructura; Archil si el paso 7 está hecho a tiempo.

**Quién ve qué (decisión):**
- El profesor ve todo lo que escriben los agentes **que él creó**: wiki, `dificultades/`, `about/<alumno>`. No ve canales privados ni `people/<alumno>/wiki`.
- El alumno ve la wiki del curso, su `about/` y su wiki personal.
- Regla general: **quien crea el agente ve lo que el agente escribe.**

**Versionado:** un commit de git por ingest. `git diff` = "qué aprendió el agente esta semana".

**Frontmatter:**
```yaml
---
type: tema | decision | pregunta | consigna | entrega | dificultad | persona
title: ...
valid_from: 2026-08-22
supersedes: decisiones/....md
sources: [raw/martin/..., nostr:<event-id>]
updated: 2026-08-22
---
```

**Reglas del agente (van en su CLAUDE.md / AGENTS.md):**
1. Antes de responder, leer `index.md`. Abrir máximo 5 páginas.
2. Toda respuesta cita páginas por path.
3. Componer desde las fichas, nunca pegar una respuesta anterior. Si la pregunta trae un ángulo que la ficha no cubría, enriquecer la ficha (sección o link nuevo); no crear otra ficha para lo mismo.
4. Archivar como ficha solo lo que otro alumno podría necesitar: el concepto, la conexión o la dificultad, no la conversación.
5. Nunca escribir fuera de su carpeta.
6. Si una fuente contradice una página: nueva página con `supersedes`, no editar la vieja. (Enriquecer ≠ contradecir: agregar un ángulo es editar; cambiar un hecho es reemplazar.)
7. Publicar páginas nuevas como canvas en el canal (`buzz-cli`), con link al archivo.

## 7. Stack y arquitectura

> **Reemplazada el 22/08 19:45 por §14.** El fork de Buzz no se hizo antes del checkpoint de las 14:00; se ejecuta el Plan B con la topología de §14. El modelo de memoria (§6) no cambia.

```
Buzz relay (Rust, docker)  ←──Nostr/WS──→  Buzz Desktop (Tauri + React), forkeado y renombrado
        ↑
   buzz-acp (harness)  ──@mention──→  Claude Code / Codex
                                       cwd = data/<curso>/agents/<agente>/
                                       CLAUDE.md = reglas de la sección 6
                                       tools = filesystem + buzz-cli
                                       (Archil mount cuando esté)
```

- El agente **es** el CLI (Claude Code o Codex) con un `CLAUDE.md`/`AGENTS.md` y un skill `ada-wiki`. Esto cumple tu pedido: todo se puede laburar desde Claude Code o Codex, y un profesor puede usar su suscripción en vez de una API key.
- Personalización del desktop: mínima. Presets de canales por curso, franja de páginas (canvases filtrados por tag `page`), marcador "desde una página", ficha de agente.
- Comunicación agente → UI: `buzz-cli` para mensajes y canvases. Sin endpoints nuevos.

**Plan B (si `just dev` de Buzz no levanta antes de las 14:00):** app propia en Next.js + Postgres para mensajes + mismo `data/` en filesystem + Claude Agent SDK. El modelo de memoria y el skill son idénticos; cambia solo la cáscara.

## 8. Descartado

- **WDK, QVAC, Pears (tracks de Tether).** Cada uno obligaba a una tecnología (wallet, inferencia local, runtime Bare) que ponía el riesgo en la infraestructura en vez de en el producto. Pears encajaba bien con la tesis de memoria (Hyperdrive, permisos = keys); queda como experimento futuro.
- **Construir el chat desde cero.** Buzz ya tiene relay, desktop, agentes y canvases.
- **Slack como referencia.** La referencia es Buzz.

## 9. Fuera de scope este finde

> Ampliado por §15: también quedan fuera del finde crear agentes desde la UI, agentes personales de alumnos, tokens/hosting y todo lo multi-tenant. Y "cliente web" acá abajo está al revés: el cliente **es** la web (esta SPA); lo que no hay es desktop.

Corrección de entregas · edición colaborativa de páginas · búsqueda vectorial · multi-curso · pantalla de permisos · revocación · canales de trabajo (solo diseño) · móvil · cliente web (el desktop es el cliente).

## 10. Orden de construcción

> **Reemplazada el 22/08 por el spec de OpenSpec** (`openspec/changes/demo-local-backend/tasks.md`), que es el orden vigente bajo el alcance de §15. Los pasos 1-2 (Buzz) no se hicieron; el resto sobrevive con otra forma.

1. **Levantar Buzz** (`just dev` o docker). Relay + desktop corriendo. Dos personas chateando. *Hasta 14:00 o Plan B.*
2. Fork + rename + presets de curso: `#general`, `#dudas`, `#03-backprop`, roles profesor/alumno.
3. Agente "Ada" vía `buzz-acp` con Claude Code, cwd en `data/<curso>/agents/ada/`, `CLAUDE.md` con las reglas. Responde a un @mention en un thread.
4. Skill `ada-wiki`: ingest de un md desde `raw/` → páginas + `index.md` + `log.md` + commit. Publicar página como canvas.
5. Query con citas + archivar respuesta. Franja de páginas en el canal.
6. Segunda pregunta parecida → "respondido desde una página", marcador visual.
7. Decisiones con `supersedes`. `dificultades/<modulo>.md`.
8. Agente personal: un alumno crea el suyo desde la UI de agentes de Buzz; canal privado; `people/<alumno>/wiki`.
9. Archil como mount de `data/` si 1-8 están hechos antes de las 02:00.
10. Lint si sobra.

Corte: domingo 04:00. Después, solo video y README.

## 11. Guion de demo (3 min)

1. Martín abre el curso, invita a Sofía e Ignacio. (20s)
2. Crea a Ada, la agrega a `#general`, `#dudas`, `#03-backprop`. Se ve como miembro. (20s)
3. Carga `backprop.md` como documento base. `@Ada ingest`. Aparecen páginas en la franja. (20s)
4. Sofía pregunta en `#dudas`. Ada responde en el thread citando. Aparece `preguntas/...`. (30s)
5. Ignacio pregunta «lo mismo» con otras palabras y otro hueco. Ada responde **desde el fichero**: compone con dos fichas, sin releer el apunte, y la ficha gana una sección con el ángulo nuevo. (20s)
6. Martín anuncia que mueve el parcial. Aparece `decisiones/...` con rationale. (20s)
7. Sofía crea su agente personal; le pide un plan; aparece en su wiki. (20s)
8. Terminal: `ls data/` + `git log`. "Esto es todo lo que sabe el curso, en markdown." (20s)
9. Cierre: humans and agents learn together, and what they learn stays with them. (10s)

## 12. Dudas abiertas

- Nombre final del producto.
- ~~¿Buzz tiene "distribution seams" como Berd?~~ Cerrada: no forkeamos Buzz (§14).
- ~~¿Los canvases de Buzz soportan frontmatter completo?~~ Cerrada: la página vive en el archivo del agente; el server guarda la copia publicada (§14.6).
- N del ingest automático (arrancar con 20).
- ~~Archil: ¿mount por agente o un solo mount para el finde?~~ Cerrada: sin Archil este finde; directorio local, capas de aislamiento en §14.7.

## 13. Timeline

- Sáb 12:00 — kickoff. Paso 1.
- Sáb 14:00 — checkpoint Buzz levantado o Plan B.
- Sáb 18:00 — checkpoint: pasos 1-4.
- Dom 00:00 — checkpoint: pasos 5-8.
- Dom 04:00 — corte.
- Dom 12:00 — cierre. Juzgado 13:00–17:00, demo async.

## 14. Topología de agentes: identidad + carpeta + runner (22/08, reemplaza a §7)

Decisión tomada después de verificar las reglas de Anthropic, la arquitectura de Buzz y pi.dev (`research/2026-08-22-suscripciones-runners-buzz-pi.md`). Spec de implementación: `openspec/changes/demo-local-backend/`.

**Un agente = identidad en la comunidad + carpeta (wiki) + runner.** La comunidad solo conoce identidad, membresía y fichas publicadas. Dónde corre, con qué modelo y con qué credencial es problema del runner, y el runner es de quien creó el agente.

```
            server de la comunidad (Railway / nuestro)
            mensajes · miembros · canales · fichas publicadas · NUNCA inferencia
                   ▲                  ▲                    ▲
      WS + token   │                  │                    │
      del agente   │                  │                    │
   runner en la laptop      runner en el Railway     runner hosteado por nosotros
   del alumno/profe         del profe                pi + modelo abierto, o Claude/GPT con API key
   claude/codex (suscrip.)  claude (setup-token)     premium · siempre on · se cobra
   o pi + Ollama            gratis · siempre on
   gratis · offline si se apaga
```

Analogía: runners de GitHub Actions, self-hosted o hosted.

1. **El server nunca ejecuta modelos.** Es bus + storage. No intermediamos credenciales de nadie (cumple Anthropic), no elegimos proveedor por el usuario, hostearlo es barato.
2. **El runner es un proceso aparte y pluggable** (`ada-runner`): se conecta saliente con el token del agente, recibe menciones, spawnea el runtime con `cwd = carpeta del agente`, publica respuesta y fichas. Runtime = `claude` | `codex` | `pi` | `goose`. Modelos abiertos entran por pi (Ollama, OpenRouter, vLLM). "Detectar tus agentes" = ver qué binarios hay en PATH.
3. **Quien crea el agente lo corre y ve lo que escribe.** El profesor crea agentes de comunidad; cada alumno, el suyo. Crear = identidad + carpeta + token. Conectar = pegar un comando.
4. **Online/offline es estado de producto.** Runner desconectado = agente "desconectado" en la UI. Sin cola de menciones. La solución al "se apagó la laptop" es el punto 5.
5. **Hosted = runner nuestro con API keys, jamás con suscripciones ajenas.** BYO key o la nuestra con margen. Modelo abierto como default barato; Claude/GPT premium. Acá se cobra (por tokens o por asiento: pendiente).
6. **La wiki vive donde vive el runner; el server guarda la copia publicada.** Privacidad real para agentes personales; export para hosted.

7. **Aislamiento por capas, según el tier.** (1) *Política*: `cwd` en la carpeta del agente, `--add-dir` solo para `raw/`, `--allowedTools` acotado y reglas `deny` por path en `.claude/settings.json` de la carpeta; alcanza para el tier local (en tu máquina todo es tuyo) y para este finde. (2) *Muro*: un contenedor por agente con `raw/` en solo lectura y su carpeta en lectura/escritura; para hosted v1, sin servicios nuevos. (3) *Composición*: árbol virtual por agente con las carpetas de los canales donde es miembro (§6, "permisos = composición de carpetas"), con bind mounts y, multi-máquina, Archil. Archil da la vista compuesta, no el aislamiento; es hosted y por eso queda para el tier hosted. Explicado con diagramas en `docs/como-funciona.html`.

No hacer: que el server llame modelos "por comodidad"; pedir tokens de Claude en nuestra UI; diseñar alrededor de un solo proveedor.

**Plan B en concreto (este finde):** `apps/server` (Node 24 + Hono + `node:sqlite` + WS), `packages/runner` (CLI, runtime `claude -p`), `packages/protocol` (tipos + eventos), `apps/web` (la SPA actual), `data/<curso>/` (wiki). Todo local en una laptop. Detalle en el change de OpenSpec.

## 15. Pivot de alcance: un desarrollo para un profesor puntual (22/08, tarde)

Consejo del mentor, adoptado: *"prefiero que el sistema sea acotado — como un desarrollo para un profesor en particular, para que lo tenga en su computadora — antes que un sistema escalable y completo".*

**Qué significa para el finde:**
- Construimos Ada como si fuera un desarrollo a medida para **un profesor concreto**: todo corre en su computadora (server + runner + cliente web en localhost; los alumnos podrían entrar por LAN, pero la demo es una sola máquina).
- El curso, los canales, las personas y el agente se definen en un archivo de configuración (`data/<curso>/community.json`), no desde la UI. Sin creación de agentes por UI, sin agentes personales de alumnos, sin tokens con hash, sin multi-curso, sin hosting.
- La separación server / runner / carpeta del agente **se mantiene** (§14): es barata hoy y es lo que permite crecer después sin reescribir.
- Guion de demo (§11): el núcleo son los pasos 1-6 y el cierre en terminal (`ls data/` + `git log`). Los pasos de agente personal (7) quedan como extensión solo si sobra tiempo.

**Dónde vive cada cosa a partir de este pivot:**
- El **código y su verdad**: `AGENTS.md` (mapa, comandos, estado real) + `openspec/changes/demo-local-backend/` (spec de lo que se construye hoy).
- La **arquitectura completa a futuro** (runners remotos, tiers, hosted, open source a escala): §14 de este archivo + `docs/como-funciona.html` y `docs/usecases-api.html`, que son **inspiración a futuro, no descripción del código**.
- Cada área del repo lleva su propio `AGENTS.md` corto: qué es hoy, y cómo crecería mañana. Regla: si tocás el área, mantené ese archivo al día.

