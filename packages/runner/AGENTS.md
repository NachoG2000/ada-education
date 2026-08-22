# packages/runner — ada-runner

**Hoy:** esqueleto sin código. Se implementa según `openspec/changes/demo-local-backend/specs/agent-runner/spec.md` (grupo 4 de `tasks.md`).

**Qué va a ser:** el proceso que hace existir a un agente. Se conecta *saliente* al server con el token del agente (`/ws/runner?token=`), recibe menciones, ejecuta el **runtime** elegido con `cwd` en la carpeta del agente, convierte citas `[[path]]` en fichas, publica los `.md` nuevos/modificados de `wiki/` y hace un commit por corrida. Runtimes: `claude` (este finde), `codex` y `pi` (misma interfaz, sin probar). **Nunca pide ni guarda credenciales de IA**: eso es del binario del proveedor (reglas verificadas en `research/2026-08-22-suscripciones-runners-buzz-pi.md`).

**Cómo crece (idea, no código):** correr en la máquina de cada alumno (agente personal), en el Railway del profe (`claude setup-token`), o en nuestro hosting con API keys y modelos abiertos vía `pi` — sin tocar server ni cliente (`DECISIONS.md` §14, `docs/como-funciona.html`).
