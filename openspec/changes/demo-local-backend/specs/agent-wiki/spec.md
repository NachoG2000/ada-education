## Purpose

La memoria del agente como archivos: el layout de `data/<curso>/agents/<agente>/`, el frontmatter de cada ficha, las reglas que el runtime lee en `CLAUDE.md`, y el contrato que permite al runner publicar fichas y detectar "respondido desde la ficha". Implementa `DECISIONS.md` §6.

## ADDED Requirements

### Requirement: Layout de la carpeta del agente
Cada agente SHALL tener una carpeta `data/<curso>/agents/<agente>/` con: `CLAUDE.md` (y `AGENTS.md` como symlink o copia, para runtimes que leen ese nombre), `wiki/index.md`, `wiki/log.md`, y subcarpetas `wiki/modulos/<nn>-<slug>/`, `wiki/decisiones/`, `wiki/preguntas/`, `wiki/dificultades/`, `about/`. Los documentos base del curso SHALL vivir fuera de la carpeta del agente, en `data/<curso>/raw/<persona>/...`, y el agente SHALL poder leerlos pero MUST NOT escribir ahí.

#### Scenario: agente recién creado
- **WHEN** el server crea un agente y el runner arranca por primera vez con un `--cwd` vacío
- **THEN** el runner genera el layout desde `packages/runner/templates/` con `index.md` vacío y `CLAUDE.md` con las instrucciones del agente

### Requirement: Frontmatter de ficha
Todo `.md` bajo `wiki/` salvo `index.md` y `log.md` SHALL empezar con frontmatter YAML con, como mínimo: `type` (`tema | decision | pregunta | consigna | entrega | dificultad`), `title`, `valid_from` (fecha), `updated` (fecha), `sources` (lista de paths en `raw/` o ids `msg:<id>`), y opcional `supersedes` (path de la ficha que reemplaza) y `channel` (id del canal donde publicarla). El runner SHALL mapear `type` al `PageType` del cliente: `tema → apunte`, `pregunta → respuesta`, `dificultad → apunte`, y el resto igual. Una ficha sin frontmatter válido MUST NOT publicarse; el runner SHALL loguear el path y el error.

#### Scenario: ficha válida
- **WHEN** el runtime escribe `wiki/preguntas/gradiente-que-explota.md` con `type: pregunta`, `title`, `valid_from`, `updated` y `sources: [msg:m-42]`
- **THEN** el runner la publica como `Page` de tipo `respuesta`, con `sources` de kind `mensaje` apuntando a `m-42`

### Requirement: Reglas del agente en `CLAUDE.md`
El `CLAUDE.md` de cada agente SHALL contener, además de las instrucciones propias del agente, las reglas fijas de `DECISIONS.md` §6: (1) leer `wiki/index.md` antes de responder y abrir como máximo 5 fichas; (2) citar fichas por path con la sintaxis `[[path]]`; (3) archivar la respuesta como ficha nueva solo si otra persona podría preguntar lo mismo; (4) nunca escribir fuera de la carpeta del agente; (5) ante una fuente que contradice una ficha, crear una nueva con `supersedes` en vez de editar la vieja; (6) mantener `index.md` (una línea por ficha: path, tipo, título) y `log.md` (una línea por corrida). SHALL explicitar que la respuesta al canal es el texto final, sin preámbulos ni meta-comentarios, en español rioplatense.

#### Scenario: respuesta reutilizable
- **WHEN** el agente responde una duda conceptual que otro alumno podría tener
- **THEN** crea una ficha en `wiki/preguntas/`, agrega su línea a `index.md`, y la respuesta en el canal la cita con `[[preguntas/<slug>.md]]`

#### Scenario: respuesta que ya está en el fichero
- **WHEN** la pregunta ya está cubierta por una ficha del índice
- **THEN** el agente responde citándola con `[[path]]` y no escribe ningún archivo

### Requirement: Ingest explícito
Al recibir una mención cuyo texto empieza con `ingest`, el agente SHALL leer los documentos nuevos en `raw/` que no figuren en `log.md`, producir fichas de tipo `tema` en `wiki/modulos/<nn>-<slug>/` (una por tema, no una por archivo), actualizar `index.md` y `log.md`, y responder en el canal con la lista de fichas creadas citadas con `[[path]]`.

#### Scenario: primer ingest del módulo de backprop
- **WHEN** `martin` sube `raw/martin/modulos/03-backprop/backprop.md` y escribe `@ada ingest`
- **THEN** aparecen varias fichas `tema` en `wiki/modulos/03-backprop/` y una respuesta que las lista

### Requirement: Versionado con git
La carpeta del agente SHOULD ser un repositorio git propio (`git init` lo hace el runner en el primer arranque si no existe). `git log` de esa carpeta SHALL ser la historia de lo que aprendió el agente; `git diff` entre dos fechas, lo que aprendió en ese período.

#### Scenario: cierre de la demo
- **WHEN** se corre `ls -R data/redes-neuronales-2c-2026/agents/ada/wiki` y `git -C <esa carpeta> log --oneline`
- **THEN** se ven las fichas en markdown y un commit por corrida

### Requirement: Curso semilla
El repo SHALL incluir `data/redes-neuronales-2c-2026/` con `community.json`, `raw/martin/modulos/03-backprop/backprop.md` (documento base real, en español, ~2–4 páginas sobre backpropagation y gradientes que explotan/desvanecen), y `agents/ada/` con `CLAUDE.md` y `wiki/index.md` vacío. Todo el contenido SHALL ser ficticio o de dominio público y presentarse como demo.

#### Scenario: clonar y correr
- **WHEN** alguien clona el repo y corre `npm install && npm run seed && npm run dev`
- **THEN** tiene el curso semilla con el documento base cargado y puede arrancar un runner contra `agents/ada`
