# apps/server — el servidor de la comunidad

**Hoy:** implementación local de la fuente de verdad de un curso. Hono sirve `GET /api/community`, mensajes, threads y publicaciones por REST; `ws` comparte `/ws` para clientes y `/ws/runner` para runners. SQLite vive en un archivo mediante `node:sqlite`/`DatabaseSync`; la presencia de agentes se mantiene en memoria y las menciones se entregan solo al runner conectado.

Configuración: `PORT` (default `8787`), `ADA_DB` (default `apps/server/data/ada.db`) y `ADA_COURSE` (default `data/redes-neuronales-2c-2026`). `npm run seed` carga el curso desde `community.json` de forma idempotente mediante upserts: no duplica ni pisa mensajes o fichas dinámicas ya publicadas. `npm run check` valida TypeScript; el smoke reproducible corre con `npx tsx apps/server/scripts/smoke.ts` mientras el server está levantado.

**Responsabilidad:** es la fuente de verdad de miembros, canales, mensajes, threads y fichas publicadas de *un* curso. Usa Node 24 + Hono + `node:sqlite` (un archivo, sin Docker) + WebSocket. Detecta menciones `@agente` y se las reenvía al runner conectado. **Regla de oro: nunca ejecuta modelos ni guarda credenciales de proveedores de IA** (`DECISIONS.md` §14.1): es un bus y un archivo.

**Alcance del finde (`DECISIONS.md` §15):** un curso, agentes definidos en `data/<curso>/community.json` con token plano, sin auth de personas, corriendo en la computadora del profesor.

**Cómo crece (idea, no código):** multi-curso por tenant, identidad por link de invitación con claves por miembro, hosting (Railway/nuestro), cola de menciones opcional. La API ampliada está dibujada en `docs/usecases-api.html` (inspiración a futuro).

**Deploy a Railway para un profesor (futuro cercano, ~1-2 h sobre lo del finde):** (1) volumen persistente para `ada.db` y `data/<curso>/`; (2) servir `apps/web/dist` desde el server (o segundo servicio + CORS); (3) token de runner propio por deploy (no el de demo del repo público); (4) decidir identidad de personas (hoy el server confía en `authorId`: en localhost da igual, con URL pública no); (5) el runner acepta `wss://`. Regla legal (research 22/08): la credencial del agente la pone el profesor — su `claude setup-token` en *sus* env vars, o una API key — nunca pasa por nuestras manos.
