## Purpose

El cliente web deja de ser una maqueta: se conecta al servidor de la comunidad, recibe eventos en vivo, escribe mensajes, y muestra la presencia de los agentes. Conserva el modo demo sin server. (La creación de agentes desde la UI quedó fuera del finde: `DECISIONS.md` §15.)

## ADDED Requirements

### Requirement: Fuente de datos conmutable
Si existe `VITE_ADA_SERVER`, el cliente SHALL hidratar `CommunityProvider` con `GET /api/community` y mantenerlo al día con los eventos de `/ws`. Si no existe, SHALL seguir usando la comunidad sintética de `demo.ts` exactamente como hoy. Los componentes de `components/ada` y las pantallas MUST NOT saber cuál de las dos fuentes está activa.

#### Scenario: modo conectado
- **WHEN** `VITE_ADA_SERVER=http://localhost:8787` y el server está arriba
- **THEN** la pantalla muestra el curso semilla y un mensaje nuevo aparece sin recargar

#### Scenario: modo demo
- **WHEN** no hay `VITE_ADA_SERVER`
- **THEN** la app corre con `demo.ts` y la fecha congelada `NOW`, igual que antes de este change

### Requirement: Identidad local
En modo conectado el cliente SHALL preguntar una vez "¿quién sos?" entre las personas del curso y guardar la elección en `localStorage["ada:me"]`. Esa persona SHALL ser `meId` y el `authorId` de lo que se escribe. MUST NOT haber registro por email ni contraseña este finde.

#### Scenario: primera visita
- **WHEN** se abre la app conectada sin `ada:me`
- **THEN** aparece un selector con `martin`, `sofia`, `ignacio`; al elegir, se entra al canal inicial como esa persona

### Requirement: Composer que escribe de verdad
El `Composer` SHALL enviar el texto a `POST /api/channels/:id/messages` (con `threadId` si está en un thread) y limpiar el campo al confirmar. Al escribir `@` SHALL ofrecer autocompletar con los miembros del canal, agentes primero. El mensaje propio SHALL aparecer cuando llega `message.created` (sin optimismo local este finde).

#### Scenario: mencionar a un agente
- **WHEN** `sofia` escribe `@ada` y elige el agente, completa la pregunta y envía
- **THEN** el mensaje aparece en el thread con la mención resaltada y, si `ada` está en línea, su estado pasa a `pensando`

### Requirement: Presencia y estado del agente
La lista de miembros y la cabecera del thread SHALL reflejar `presence` en vivo: `ausente` como "desconectado" (sin animación), `pensando` y `publicando` con el indicador ya existente en el diseño. Al mencionar a un agente `ausente`, el composer SHALL mostrar un aviso inline "`ada` está desconectada: su runner no está corriendo" sin impedir el envío.

#### Scenario: runner apagado
- **WHEN** el runner de `ada` se cierra
- **THEN** en menos de 2 s la UI muestra a `ada` como desconectada

### Requirement: Fichas en vivo
Al recibir `page.published` el cliente SHALL agregar o actualizar la `Page` en el estado (por `id`), mostrarla en la franja del canal con su `state` (`nueva` con el sol, `actualizada`, `reemplazada`), y renderizar el mensaje de publicación. Al recibir un mensaje con `fromPage` SHALL mostrar el sello "ya en el fichero · hace N".

#### Scenario: sellar
- **WHEN** llega un mensaje de `ada` con `fromPage`
- **THEN** se ve la animación de sellar (380 ms, respetando `prefers-reduced-motion`) y el pill abre la ficha en el panel

### Requirement: Ficha del agente
El panel de ficha de un agente SHALL mostrar ámbito, quién lo creó, runtime y modelo reportados por su runner (o "sin runner" si nunca se conectó), canales donde está, y fichas que publicó.

#### Scenario: ver a ada
- **WHEN** se abre la ficha de `ada` con su runner conectado
- **THEN** se lee "agente de la comunidad · creado por martin · claude · en línea" y la lista de fichas publicadas
