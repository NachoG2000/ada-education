# apps/server — el servidor de la comunidad

**Hoy:** esqueleto sin código. Se implementa según `openspec/changes/demo-local-backend/specs/community-server/spec.md` (grupo 2 de `tasks.md`).

**Qué va a ser:** la fuente de verdad de miembros, canales, mensajes, threads y fichas publicadas de *un* curso. Node 24 + Hono + `node:sqlite` (un archivo, sin Docker) + WebSocket. Detecta menciones `@agente` y se las reenvía al runner conectado. **Regla de oro: nunca ejecuta modelos ni guarda credenciales de IA** (`DECISIONS.md` §14.1): es un bus y un archivo.

**Alcance del finde (`DECISIONS.md` §15):** un curso, agentes definidos en `data/<curso>/community.json` con token plano, sin auth de personas, corriendo en la computadora del profesor.

**Cómo crece (idea, no código):** multi-curso por tenant, identidad por link de invitación con claves por miembro, hosting (Railway/nuestro), cola de menciones opcional. La API ampliada está dibujada en `docs/usecases-api.html` (inspiración a futuro).
