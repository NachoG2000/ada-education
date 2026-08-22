# packages/protocol — el contrato compartido

**Hoy:** `src/types.ts` (el modelo de dominio que antes vivía en la SPA: `Community`, `Member`, `Page`, `Message`, `Thread`…) re-exportado por `src/index.ts`. `apps/web/src/lib/types.ts` re-exporta de acá para no romper los imports `@/lib/types`.

**Próximo paso (grupo 1.4 pendiente + grupo 2):** los eventos de la API con `zod` — `ServerEvent` (`message.created`, `page.published`, `member.presence`, …) y los mensajes del runner (`agent.mention`, `page.publish`, `presence`) — según `openspec/changes/demo-local-backend/`.

Reglas: paquete de **solo fuente TS** (sin build: la web lo transpila con Vite; server y runner lo correrán con `tsx`). Nada acá puede depender de React, de Node APIs ni de la UI: tipos, esquemas y constantes compartidas únicamente. Si un tipo cambia, compilá las tres piezas antes de cerrar.
