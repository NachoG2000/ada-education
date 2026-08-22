# packages/protocol — el contrato compartido

**Hoy:** `src/types.ts` (el modelo de dominio que antes vivía en la SPA: `Community`, `Member`, `Page`, `Message`, `Thread`…) y `src/events.ts` (schemas Zod y tipos de eventos REST/WS), re-exportados por `src/index.ts`. `apps/web/src/lib/types.ts` re-exporta de acá para no romper los imports `@/lib/types`.

**Próximo paso:** usar estos contratos desde `apps/server` y `packages/runner`; si cambia un evento, actualizar primero este paquete y luego compilar las tres piezas.

Reglas: paquete de **solo fuente TS** (sin build: la web lo transpila con Vite; server y runner lo correrán con `tsx`). Nada acá puede depender de React, de Node APIs ni de la UI: tipos, esquemas y constantes compartidas únicamente. Si un tipo cambia, compilá las tres piezas antes de cerrar.
