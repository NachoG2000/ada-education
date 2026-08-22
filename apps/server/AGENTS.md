# apps/server — el servidor de la comunidad

**Hoy:** esqueleto sin código. Se implementa según `openspec/changes/demo-local-backend/specs/community-server/spec.md` (grupo 2 de `tasks.md`).

**Qué va a ser:** la fuente de verdad de miembros, canales, mensajes, threads y fichas publicadas de *un* curso. Node 24 + Hono + `node:sqlite` (un archivo, sin Docker) + WebSocket. Detecta menciones `@agente` y se las reenvía al runner conectado. **Regla de oro: nunca ejecuta modelos ni guarda credenciales de IA** (`DECISIONS.md` §14.1): es un bus y un archivo.

**Alcance del finde (`DECISIONS.md` §15):** un curso, agentes definidos en `data/<curso>/community.json` con token plano, sin auth de personas, corriendo en la computadora del profesor.

**Cómo crece (idea, no código):** multi-curso por tenant, identidad por link de invitación con claves por miembro, hosting (Railway/nuestro), cola de menciones opcional. La API ampliada está dibujada en `docs/usecases-api.html` (inspiración a futuro).

**Deploy a Railway para un profesor (futuro cercano, ~1-2 h sobre lo del finde):** (1) volumen persistente para `ada.db` y `data/<curso>/`; (2) servir `apps/web/dist` desde el server (o segundo servicio + CORS); (3) token de runner propio por deploy (no el de demo del repo público); (4) decidir identidad de personas (hoy el server confía en `authorId`: en localhost da igual, con URL pública no); (5) el runner acepta `wss://`. Regla legal (research 22/08): la credencial del agente la pone el profesor — su `claude setup-token` en *sus* env vars, o una API key — nunca pasa por nuestras manos.
