# AGENTS.md

Reglas del repo para cualquier agente que trabaje acá (Claude Code, Codex, Cursor, el que sea). `CLAUDE.md` importa este archivo: **editá este, no aquel.**

## Qué es este repo

**Ada** (nombre provisorio "Ada Education"): comunidad de curso donde humanos y agentes de IA conviven en canales y el conocimiento se compila solo en **fichas** (páginas markdown con tipo, versión, fuentes y "reemplaza a"). Hackathon Aleph 2026, General Track. Corte: domingo 23/08 04:00.

**Alcance vigente (pivot del 22/08, `DECISIONS.md` §15):** este finde Ada se construye como un desarrollo a medida para **un profesor puntual, todo local en su computadora**. La arquitectura completa (runners remotos, hosted, tiers) es dirección a futuro, no código.

**Estado real del código hoy:** una SPA Vite + React 19 (`apps/web/`) que todavía corre contra una comunidad sintética (`apps/web/src/lib/demo.ts`), un server local implementado en `apps/server/`, tipos/eventos compartidos en `packages/protocol/`, el seed de ejemplo en `data/redes-neuronales-2c-2026/` y `packages/runner/` como esqueleto documentado. El plan de forkear Buzz quedó descartado (`DECISIONS.md` §7 → §14). Leé `DECISIONS.md` §14-§15 antes de tocar arquitectura, memoria de agentes o alcance.

**Cada área del repo tiene su `AGENTS.md`** corto con qué es hoy y cómo crece mañana (`src/`, `docs/`, y cada workspace nuevo debe traer el suyo). Si tocás un área, mantené su archivo al día.

Documentos de verdad, en orden de autoridad:
- `PROBLEM.md` — el problema antes que la solución: quién lo sufre, evidencia a 2026, causas raíz, qué no es el problema. Si una feature no ataca algo de acá, no va.
- `DECISIONS.md` — visión, tesis, modelo de memoria, stack, orden de construcción, guion de demo, fuera de scope.
- `PRODUCT.md` — usuarios, terminología fija, estados que hay que mostrar, restricciones de marca.
- `DESIGN.md` — sistema de diseño «El fichero» (tokens, tipografía, reglas con nombre). Los tokens reales viven en `src/index.css` y pueden diferir en detalle; el código manda.
- `research/` — investigación con fuentes, un archivo por sesión. Respaldo de `PROBLEM.md`; no es autoridad por sí misma.
- `openspec/` — specs y changes: qué se está construyendo y en qué orden. El change activo es `demo-local-backend`.
- `docs/*.html` — **inspiración a futuro** (arquitectura completa, casos de uso, API ampliada). No describen el código actual; si contradicen al código o al spec, mandan estos últimos.
- `design/BRIEF.md` y `design/mockups/` — historia, no autoridad. Los mockups HTML están descartados.

Idioma: todo (UI, contenido, comentarios, docs) en **español rioplatense con voseo**. Mantenelo.

## Regla: toda la información entra en el repo

Lo que se usó para pensar o decidir algo del proyecto se escribe en un archivo markdown del repo **antes de cerrar la tarea**. Nada queda solo en el chat, en un PDF del Drive, en un hilo de Discord ni en la cabeza de alguien. Es la tesis del producto aplicada a nosotros mismos: el conocimiento vive en archivos que el grupo posee.

Dónde va cada cosa:
- `PROBLEM.md` — el problema, quién lo sufre, evidencia y causas. Se actualiza cuando aparece evidencia nueva; cada cifra lleva su fuente.
- `DECISIONS.md` — decisiones y su rationale. Una decisión que cambia no se borra: se marca como reemplazada y se agrega la nueva, con fecha.
- `PRODUCT.md` / `DESIGN.md` — producto y diseño.
- `research/AAAA-MM-DD-<tema>.md` — investigación: cada afirmación con fuente, URL, fecha y si se verificó en la fuente original o solo en un snippet de búsqueda. También van acá los resúmenes de documentos externos que el usuario aporta (por ejemplo, el TFG de 2024), con la ruta o URL del original.
- Si algo no encaja en ningún lado, va en `research/` igual, con una nota de por qué.

Cómo lo aplica un agente:
- Si durante una tarea aprendiste algo del dominio, del usuario, del mercado o de una decisión que otro agente o persona necesitaría saber, escribilo en el archivo que corresponde antes de terminar, y decí en el cierre qué archivo tocaste.
- Si el usuario te pasa un documento externo (PDF, link, captura, transcripción), dejá en `research/` un resumen con lo que importa y de dónde salió. El original puede quedar afuera del repo si tiene datos personales; el resumen no.
- No inventes fuentes ni cifras. Una cifra sin fuente se marca como estimación. Una cifra de 2012 se dice que es de 2012.
- Citá por path y sección («ver `PROBLEM.md` §3.2»), nunca «como hablamos antes».
- Los mismos principios que el producto exige a sus agentes (leer el índice antes de responder, citar, no editar lo viejo sino reemplazar con `supersedes`) valen para trabajar en este repo.

## Comandos

Monorepo con **npm workspaces** (sin Turborepo): `apps/web` (SPA), `apps/server` (API local), `packages/runner` (esqueleto), `packages/protocol` (tipos y eventos compartidos), `data/<curso>/` (cursos). Cada área tiene su `AGENTS.md`.

```bash
npm install            # una sola vez, en la raíz (instala todos los workspaces)
npm run seed           # carga data/redes-neuronales-2c-2026 en la DB local
npm run dev            # web + server en paralelo → http://localhost:5173 y :8787
npm run dev:web        # solo la SPA con HMR → http://localhost:5173
npm run dev:server     # solo el server → http://localhost:8787
npm run check -w @ada/server # typecheck del server
npx tsx apps/server/scripts/smoke.ts # smoke WS/REST, con el server levantado
npm run build          # tsc -b && vite build de apps/web → apps/web/dist/
npm run lint           # oxlint sobre apps y packages; warnings only-export-components en ficha.tsx y ui/sidebar.tsx son conocidos
npm run typecheck      # tsc -b apps/web (noUnusedLocals/Parameters activos: una variable sin usar rompe el build)
cd apps/web && npx shadcn add <componente>   # primitivas a src/components/ui (estilo base-nova, Base UI, ícono lucide)
```

No hay tests. Pantalla de desarrollo del generador de personajes: abrir `http://localhost:5173/#figuras`.

## Arquitectura

> Paths de esta sección relativos a `apps/web/` (la SPA vivía en la raíz hasta el 22/08). Los tipos (`types.ts`) ahora viven en `packages/protocol` y `apps/web/src/lib/types.ts` los re-exporta.

**Sin router.** `src/App.tsx` elige pantalla por `location.hash` (`#figuras` → `FigureSheet`; si no, `ChannelScreen`) y fija el `NOW` de la demo (`2026-08-22T12:00-03:00`): los mensajes con `at > now` se filtran y las etiquetas "hoy/ayer" se calculan contra esa fecha, no contra el reloj real.

**Estado = un solo contexto.** `src/lib/community.tsx` → `CommunityProvider` / `useCommunity()`. Recibe la `Community` completa (inmutable en la demo) y expone:
- `activeChannelId` + `setActiveChannelId`.
- `panels`: stack del panel contextual derecho, **máximo 2** (`{kind:"thread"}` | `{kind:"ficha"}`). `openThread` reemplaza el thread anterior; `openPage` deduplica por `pageId`; el tope del stack es `panels[0]`. `popPanel` vuelve al anterior, `closePanel` vacía (y el canal ocupa todo el ancho).
- lookups `member/page/thread/message(id)` que **lanzan** si el id no existe: un id roto en `demo.ts` tira la pantalla entera.
- helpers: `isNew(page, now)` (estado `nueva` y < 24 h), `isAgent`, `formatTime`, `dayLabel` (locale `es-AR`).

**Modelo de dominio** en `src/lib/types.ts` (comentado contra `PRODUCT.md`). Lo no obvio:
- Un `Message` no es texto: es `paragraphs: MessageBlock[][]`, con bloques `text | cite | code`. Un bloque `cite` apunta a una `Page` (+ sección opcional) y se renderiza como pill de cita que abre la ficha en el panel.
- `message.fromPage` = respuesta **desde la ficha** (el momento clave de la demo: sello "ya en el fichero · hace N días"). `message.publishes` = el mensaje es la tarjeta de publicación de una ficha. `thread.publishedPageId` = ficha que cierra el thread.
- `Page.state` (`nueva | actualizada | reemplazada | compilando`), `Page.base` (documento base del canal, no sale de la conversación), `Page.replaces`.
- `Agent.scope` (`comunidad | personal`) es una diferencia de producto que debe verse en la UI; `Agent.figureSeed`/`figureColor` alimentan el personaje.
- `Channel.group` (`curso | trabajo | privados`) y `Channel.work.status` (`activo | entregado | archivado`) son los "cajones" del sidebar.

**Capas de componentes:**
- `src/screens/` — pantallas. `Channel.tsx` arma sidebar (shadcn inset) + dos `ResizablePanel` (canal · contexto); el layout se persiste en `localStorage["ada:layout:channel"]`. El comentario de cabecera del archivo es la declaración de dirección de diseño de la pantalla.
- `src/components/ada/` — componentes de producto. `folder` (panel con lengüetas tipo carpeta; `Folder`, `FolderTab`, `FloatingButton`), `channel` (cabecera, `FichaRow`, `Conversation`, `Composer`), `panel` (`PanelStack`: Thread y Ficha), `ficha` (pestaña plegada `Tab`, `Pill`, `PageState`, `FichaTab`, `Cite`, `FichaCard`, y los mapas `TAB_BG/INK/DOT/FILL` por `PageType`), `message` (`MessageRow`, `Inline`), `identity` (avatares: personas = círculo pastel con iniciales, agentes = `Figure`; `agentInk` da el color del nombre del agente), `markdown` (renderer mínimo propio: `##`, párrafos, listas numeradas, `**`, `*`, `` ` ``; no soporta más que eso).
- `src/components/ui/` — primitivas generadas por shadcn. Se pueden tocar, pero preferí componer desde `components/ada`.
- `src/lib/figure.ts` — generador **determinista por seed** de personajes de agente (silueta sólida + corona + pies + dos ojos; paleta `FIGURE_COLORS`). `figureParams(seed)` → `silhouette(p)` (SVG). Un agente nuevo = nueva seed; "tirar otra" = cambiar la seed.

**Datos:** `src/lib/demo.ts` es la única fuente (curso "Redes Neuronales 2C 2026"; personas `martin`, `sofia`, agente `ada`, `tutor-sofia`; canal inicial `dudas`, thread `t-explota`). Todo es ficticio y se presenta como demo; no inventar cifras, testimonios ni clientes. `PAGE_TYPE_LABEL` (etiquetas de tipo) también vive ahí.

## Sistema de diseño en el código

Tokens como Tailwind v4 `@theme` en `src/index.css`: colores `ground/panel/panel-2/panel-3/line/ink/ink-2..4/sol/sol-soft/sello/alerta/ok`, `tab-<tipo>` y `tab-<tipo>-ink` por tipo de ficha, `estado-<status>`; fuentes `font-sans` (Inter, UI) · `font-serif` (Literata, fichas) · `font-mono` (Geist Mono, código/versión); radios `rounded-panel/card/ficha/control/pill`; `shadow-card/pop`. Las variables semánticas de shadcn (`background`, `primary`, `sidebar-*`…) están mapeadas a estos tokens en `@theme inline`; no uses colores de Tailwind crudos ni violetas.

Clases utilitarias propias: `.panel`, `.label`, `.meta`, `.pill`, `.animate-archivar`, `.animate-sellar`. Rayos X de fuentes: `html[data-xray]` atenúa los `[id^="msg-"]` salvo los `[data-xray-target]`.

Reglas con nombre que afectan código (detalle en `DESIGN.md`):
- **Tab Rule:** un color de tipo solo aparece en la pestaña plegada o en el punto de una cita. Nunca en fondos, botones ni texto.
- **One Sun Rule:** `sol` (#ffd43b) cubre una sola superficie grande por pantalla (la ficha nueva) y los pills "ya en el fichero".
- **Three Voices:** Literata para lo que se lee/archiva, Inter para lo que se conversa/opera, Geist Mono para código y versión. No titular fichas en Inter.
- Agentes: solo silueta y dos ojos (sin bocas, degradados ni sombras); nunca badge "BOT". Personas: círculos.
- Sin burbujas de chat, sin gradientes violeta, sin sparkles, sin bordes de 1 px como sistema de profundidad.
- Animaciones solo en cambios de estado (archivar 360 ms, sellar 380 ms, rayos X 300 ms); respetar `prefers-reduced-motion`.

## Decisiones y dudas abiertas (no resolverlas por tu cuenta)

- **Sello «ya en el fichero · hace N días».** Puede leerse como caché («te muestro lo que ya respondí»). La semántica correcta es «compuesta desde el fichero» (ver `DECISIONS.md`, compromiso 3): respuesta nueva, armada con fichas existentes. Copy de `demo.ts`/`ficha.tsx` a revisar con el usuario antes de cambiarlo.
- **API del MVP (de `docs/usecases-api.html` §8):** `fromPage` debería pasar a plural (`fromFichero: { pageIds[], oldestAgo }`) porque componer implica varias fichas — cambia `types.ts`, `demo.ts`, `message` y `ficha`; el id de una ficha sería su path en la wiki; el frontmatter tiene 7 tipos y la UI 5 (`dificultad` y `persona` no se publican en canales); ingest automático cada N mensajes queda apagado en el MVP. Ninguna está decidida: preguntar antes de implementar.
- **Nombre del agente de ejemplo.** `DECISIONS.md` y `demo.ts` lo llaman "Ada"; `PRODUCT.md` dice que Ada es el producto y los agentes llevan otros nombres. Preguntar antes de renombrar.
- Backend: Buzz fork (`just dev`) vs Plan B (Next.js + Postgres + Agent SDK). La UI y el modelo de memoria son los mismos en ambos; esta SPA es la cáscara.
- Fuera de scope este finde (no construir): permisos, corrección de entregas, edición colaborativa, búsqueda vectorial/global, multi-curso, móvil, notificaciones, canales de trabajo más allá del diseño. Tampoco gamificación ni personalización algorítmica por alumno: eran la solución del TFG de 2024 y `PROBLEM.md` §9 explica por qué ya no son el problema.

## Docs en HTML

`docs/` tiene páginas HTML autocontenidas (sin build, se abren con doble clic) que explican el sistema a personas. Son **inspiración a futuro**: describen el producto completo, no el código de hoy, y cada una lo dice en su banner. `docs/como-funciona.html` = modelo mental (server / runner / runtime / carpeta, secuencia de una mención, aislamiento, tiers). `docs/usecases-api.html` = casos de uso y API del MVP ampliado. Si cambia `DECISIONS.md` §14-§15 o el spec de OpenSpec, se actualizan en la misma tarea.
