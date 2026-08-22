## Purpose

Servidor de la comunidad: la fuente de verdad de miembros, canales, mensajes, threads y fichas publicadas de un curso. Es un bus y un archivo; nunca ejecuta modelos ni guarda credenciales de proveedores de IA.

## ADDED Requirements

### Requirement: Bootstrap completo de la comunidad
El server SHALL exponer `GET /api/community` devolviendo un objeto con la misma forma que `Community` de `packages/protocol` (members, channels, pages, messages, threads), de modo que el cliente web pueda hidratar `CommunityProvider` sin transformar nada.

#### Scenario: el cliente arranca
- **WHEN** un cliente pide `GET /api/community`
- **THEN** recibe todos los canales, miembros (personas y agentes, con `presence`), fichas publicadas y los mensajes y threads de todos los canales del curso semilla, en una sola respuesta JSON

### Requirement: Escritura de mensajes
El server SHALL aceptar `POST /api/channels/:channelId/messages` con `{ authorId, paragraphs, threadId? }` y `POST /api/threads` con `{ rootMessageId }`. Cada mensaje persistido SHALL tener `id`, `at` (ISO, asignado por el server) y `paragraphs: MessageBlock[][]`.

#### Scenario: persona escribe en un canal
- **WHEN** `martin` envía un mensaje de texto a `dudas`
- **THEN** el server lo persiste, le asigna `id` y `at`, y emite `message.created` a todos los clientes conectados

#### Scenario: respuesta en thread
- **WHEN** llega un mensaje con `threadId` de un thread existente
- **THEN** el mensaje se agrega a `thread.replyIds` y se emite `message.created` con el `threadId`

### Requirement: Eventos en tiempo real para clientes
El server SHALL exponer un WebSocket en `/ws` que emite, como JSON `{ type, payload }`: `message.created`, `thread.created`, `page.published`, `member.presence`. Los clientes web no envían eventos por WS; escriben por REST.

#### Scenario: ficha publicada aparece en vivo
- **WHEN** un runner publica una ficha en `dudas`
- **THEN** todos los clientes conectados reciben `page.published` con la `Page` completa y el `Message` con `publishes` que la anuncia

### Requirement: Detección de menciones a agentes
El server SHALL detectar en los bloques `text` de cada mensaje nuevo las menciones `@<handle>` cuyo handle corresponda a un miembro `agent`. Por cada agente mencionado SHALL construir un evento `agent.mention` con: el mensaje, el canal, el thread (si hay), los últimos N=20 mensajes del canal o thread en orden cronológico, y el miembro que escribió; y SHALL entregarlo **solo** al runner conectado de ese agente. El server MUST NOT llamar a ningún modelo ni generar respuestas por sí mismo.

#### Scenario: mención con runner conectado
- **WHEN** `sofia` escribe `@ada ¿por qué explota el gradiente?` en un thread de `dudas` y el runner de `ada` está conectado
- **THEN** el runner de `ada` recibe un único `agent.mention` con el contexto inmediato del thread

#### Scenario: mención con runner desconectado
- **WHEN** se menciona a un agente cuyo runner no está conectado
- **THEN** el server no encola nada, el mensaje queda publicado normalmente, y la presencia del agente sigue siendo `ausente`

### Requirement: Conexión de runners y presencia
El server SHALL aceptar conexiones WS de runners en `/ws/runner?token=<token>`. El token SHALL identificar a un solo agente; un token inválido SHALL cerrar la conexión. Mientras un runner está conectado, el agente SHALL tener `presence: "en-linea"`; al desconectarse, `ausente`. Un runner SHALL poder reportar `pensando` y `publicando` mientras trabaja. Por WS el runner SHALL poder enviar `message.create`, `page.publish` y `presence`, y el server SHALL validar que el `authorId` sea el agente del token.

#### Scenario: runner se conecta
- **WHEN** un runner abre `/ws/runner` con el token de `ada`
- **THEN** `ada` pasa a `en-linea` y todos los clientes reciben `member.presence`

#### Scenario: runner se cae a mitad de una respuesta
- **WHEN** la conexión del runner se cierra
- **THEN** el agente pasa a `ausente` y el server no reintenta la mención

### Requirement: Fichas publicadas
El server SHALL aceptar `page.publish` (por WS de runner) o `POST /api/pages` con `{ channelId, authorId, path, title, type, version, visibility, sources, replaces?, body, state? }` y persistir la `Page`. `path` (ruta relativa en la wiki del agente) SHALL ser la clave de deduplicación: publicar de nuevo el mismo `path` por el mismo agente SHALL crear una versión nueva (`version + 1`, `state: "actualizada"`) y no una ficha duplicada. Si viene `replaces`, la ficha reemplazada SHALL pasar a `state: "reemplazada"`. Cada publicación SHALL generar además un `Message` en el canal con `publishes: <pageId>`.

#### Scenario: primera publicación
- **WHEN** el runner publica `preguntas/gradiente-que-explota.md` en `dudas`
- **THEN** existe una `Page` nueva con `version: 1`, `state: "nueva"`, `publishedAt` del server, y un mensaje de publicación en `dudas`

#### Scenario: republicación del mismo path
- **WHEN** el runner vuelve a publicar el mismo `path` con el body cambiado
- **THEN** la misma `Page` pasa a `version: 2` y `state: "actualizada"`; no aparece una segunda ficha en la franja

### Requirement: Agentes definidos por configuración
Los agentes SHALL definirse en `data/<curso>/community.json` (nombre, ámbito, instrucciones, canales, `figureSeed`, y un token en texto plano para su runner) y crearse en el seed. El server MUST NOT exponer un endpoint de creación de agentes este finde (alcance `DECISIONS.md` §15); la comparación del token del runner SHALL ser directa (sin hash), aceptable porque todo corre en la máquina del profesor.

#### Scenario: el profesor agrega un agente
- **WHEN** `martin` agrega un agente al `community.json` y corre `npm run seed`
- **THEN** el agente aparece como miembro de sus canales, `ausente` hasta que su runner se conecte con ese token

### Requirement: Curso semilla desde `data/`
El server SHALL poder crear su estado inicial con `npm run seed` a partir de `data/<curso>/community.json` (nombre del curso, canales, personas, agentes) sin depender de `demo.ts`. El curso semilla de la demo SHALL ser `redes-neuronales-2c-2026` con canales `general`, `dudas`, `03-backprop`; personas `martin` (profesor), `sofia`, `ignacio` (alumnos); agente `ada` (comunidad) en los tres canales.

#### Scenario: base de datos vacía
- **WHEN** se corre `npm run seed` con la DB vacía
- **THEN** `GET /api/community` devuelve el curso semilla con cero mensajes y la ficha base `backprop.md` marcada `base: true` en `03-backprop`

### Requirement: Almacenamiento local sin servicios externos
El server SHALL persistir en un archivo SQLite (`node:sqlite`) cuya ruta se configura por `ADA_DB` (default `apps/server/data/ada.db`). MUST NOT requerir Postgres, Redis ni Docker para correr la demo.

#### Scenario: reinicio del server
- **WHEN** el server se reinicia
- **THEN** mensajes, fichas y agentes siguen ahí; la presencia de todos los agentes vuelve a `ausente` hasta que sus runners se reconecten
