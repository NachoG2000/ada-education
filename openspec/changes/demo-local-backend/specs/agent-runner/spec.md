## Purpose

`ada-runner`: el proceso que hace que un agente exista. Se conecta al server con el token del agente, ejecuta un runtime de IA con `cwd` en la carpeta del agente, y traduce lo que el runtime hace (texto, citas, archivos nuevos en la wiki) a mensajes y fichas de la comunidad. Corre donde viven las credenciales: hoy la laptop, mañana un Railway del profesor o nuestro hosting.

## ADDED Requirements

### Requirement: Invocación por línea de comandos
El runner SHALL ejecutarse como `ada-runner --server <url> --token <token> --cwd <carpeta-del-agente> [--runtime claude|codex|pi] [--model <id>]`. `--runtime` SHALL tener default `claude`. Todos los flags SHALL poder darse también por variables `ADA_SERVER`, `ADA_TOKEN`, `ADA_AGENT_DIR`, `ADA_RUNTIME`, `ADA_MODEL`. El runner MUST NOT pedir, leer ni guardar credenciales de proveedores de IA: el runtime las resuelve por su cuenta (login de `claude`, `codex`, o las variables de entorno que `pi` espera).

#### Scenario: arranque normal
- **WHEN** se corre `ada-runner --server ws://localhost:8787 --token X --cwd data/redes-neuronales-2c-2026/agents/ada`
- **THEN** el runner verifica que `--cwd` exista y tenga `wiki/`, se conecta a `/ws/runner`, y loguea "ada · en línea · runtime claude"

#### Scenario: runtime no instalado
- **WHEN** el binario del runtime elegido no está en `PATH`
- **THEN** el runner termina con un mensaje que dice qué binario falta y cómo instalarlo, sin conectarse al server

### Requirement: Interfaz de runtimes
El runner SHALL definir una interfaz `Runtime` con `detect(): Promise<boolean>` y `run({ prompt, cwd, model? }): Promise<{ text: string; usage?: unknown }>`. SHALL implementar `claude` (spawn de `claude -p <prompt> --output-format json` con permisos no interactivos restringidos a lectura/escritura dentro de `cwd` y `git`). `codex` y `pi` SHALL existir como adaptadores con la misma interfaz (`codex exec`, `pi -p`), aunque solo `claude` se pruebe en la demo. Agregar un runtime MUST NOT requerir tocar el server ni el cliente.

#### Scenario: runtime claude
- **WHEN** llega una mención y el runtime es `claude`
- **THEN** el runner ejecuta el binario `claude` sin modificar, con `cwd` en la carpeta del agente, y toma el texto final de la salida JSON como respuesta

### Requirement: Presencia
Al conectar, el runner SHALL enviar `presence: "en-linea"` junto con `{ runtime, model }`. Mientras ejecuta una mención SHALL enviar `pensando`; mientras publica fichas, `publicando`; al terminar, `en-linea`.

#### Scenario: ciclo de una mención
- **WHEN** el runner procesa una mención
- **THEN** el agente pasa por `pensando` → (`publicando` si hubo fichas) → `en-linea`, y la UI lo refleja

### Requirement: Armado del prompt desde la capa inmediata
Por cada `agent.mention` el runner SHALL construir un prompt con: canal, quién pregunta (nombre y rol), los últimos mensajes del contexto en orden cronológico con autor y hora, el mensaje que menciona, y el recordatorio de que las reglas están en `CLAUDE.md` de `cwd`. El runner MUST NOT inyectar contenido de la wiki en el prompt: leer `wiki/index.md` y las fichas es tarea del runtime dentro de `cwd` (regla 1 de `agent-wiki`).

#### Scenario: mención en thread
- **WHEN** `sofia` menciona a `ada` en un thread con 4 respuestas previas
- **THEN** el prompt contiene el mensaje raíz y las 4 respuestas, con autores, y termina con la pregunta de `sofia`

### Requirement: Respuesta con citas
El runner SHALL convertir el texto del runtime en `paragraphs: MessageBlock[][]`. Toda referencia de la forma `[[<path-en-wiki>]]` o `[[<path-en-wiki>#<sección>]]` SHALL convertirse en un bloque `cite` apuntando a la ficha publicada con ese `path` (publicándola antes si todavía no estaba), con `text` igual al título de la ficha. Bloques de código con tres backticks SHALL convertirse en bloques `code`.

#### Scenario: respuesta que cita una ficha existente
- **WHEN** el runtime responde "Mirá [[modulos/03-backprop/gradiente-que-explota.md]]: el problema es el learning rate"
- **THEN** el mensaje publicado tiene un bloque `cite` con el `pageId` de esa ficha y el texto "Gradiente que explota"

### Requirement: "Respondido desde la ficha"
Si durante una corrida no cambió ningún archivo de `wiki/` y la respuesta cita al menos una ficha, el runner SHALL marcar el mensaje con `fromPage: { pageId: <primera cita>, ago: <tiempo desde publishedAt de esa ficha> }`. Si la corrida creó o modificó fichas, el mensaje MUST NOT llevar `fromPage`.

#### Scenario: segunda pregunta parecida
- **WHEN** `ignacio` pregunta algo que ya está en `preguntas/gradiente-que-explota.md` y el runtime responde citándola sin escribir en la wiki
- **THEN** el mensaje sale con `fromPage` y la UI muestra el sello "ya en el fichero · hace N días"

### Requirement: Publicación de fichas desde el filesystem
Antes de ejecutar el runtime el runner SHALL tomar una foto de `wiki/` (path → hash). Al terminar SHALL publicar como `Page` cada archivo `.md` nuevo o modificado bajo `wiki/` (excepto `index.md` y `log.md`), leyendo su frontmatter según `agent-wiki` y resolviendo `supersedes` a `replaces` por `path`. La publicación SHALL ir al canal de la mención, salvo que el frontmatter tenga `channel:`.

#### Scenario: ingest produce tres fichas
- **WHEN** `@ada ingest` termina y hay tres `.md` nuevos en `wiki/modulos/03-backprop/`
- **THEN** el runner publica tres `Page` con `state: "nueva"` y el canal muestra tres tarjetas de publicación

#### Scenario: decisión que reemplaza otra
- **WHEN** aparece `decisiones/2026-08-29-parcial-movido.md` con `supersedes: decisiones/2026-08-15-fecha-parcial.md`
- **THEN** la ficha nueva se publica con `replaces` apuntando a la vieja y la vieja pasa a `reemplazada`

### Requirement: Un commit por corrida
Si la carpeta del agente es un repositorio git, al final de cada corrida que cambió archivos el runner SHALL hacer `git add -A && git commit -m "<agente>: <resumen>"` dentro de esa carpeta. Si no es un repositorio, SHALL seguir sin versionar y avisar una vez en el log.

#### Scenario: git log como historia del agente
- **WHEN** terminan dos corridas que escribieron fichas
- **THEN** `git log --oneline` en la carpeta del agente muestra dos commits

### Requirement: Una mención a la vez por agente
El runner SHALL procesar menciones en serie (cola en memoria). Si el runtime falla o supera un timeout configurable (default 180 s), el runner SHALL publicar en el thread un mensaje corto del agente diciendo que no pudo responder, y SHALL seguir vivo para la siguiente mención.

#### Scenario: el runtime falla
- **WHEN** `claude` termina con error
- **THEN** el agente publica "No pude responder esta vez; probá de nuevo en un rato." y vuelve a `en-linea`
