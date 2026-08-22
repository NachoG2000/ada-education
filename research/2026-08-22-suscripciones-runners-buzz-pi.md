# Suscripciones vs API keys, topología de Buzz y pi.dev — 2026-08-22

Investigación para decidir dónde corren los agentes y con qué credenciales (ver `DECISIONS.md` §14). Tres pasadas paralelas de búsqueda + verificación directa de la fuente principal de Anthropic. Marcado por afirmación: **[V]** = ✓ primaria (leída en la fuente original), **[S]** = ~ snippet o ≈ secundaria.

## 1. Anthropic: qué permite con Claude Code y suscripciones

Fuente primaria, leída completa: https://code.claude.com/docs/en/legal-and-compliance (2026-08-22) **[V]**

- Sección *"Can customers offer Claude Code in their products?"*: se puede pre-instalar o correr Claude Code en un producto ("hosted sandboxes or other agent infrastructure") bajo los Commercial Terms si (a) **el binario no se modifica** ni se le quita ningún método de auth, y (b) **no se paga, revende ni intermedia** el uso en nombre de los usuarios: cada usuario se autentica con su propia API key o su propia suscripción, y se le factura a él.
- Cita textual: *"Nor does it prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription, including where a platform hosts Claude Code."* → un profesor puede correr `claude` con su suscripción en su propio Railway.
- Cita textual: *"Developers building products or services… including those using the Agent SDK, should use API key authentication… Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users. Moreover, developers may not collect, store, or intermediate Claude.ai credentials or session tokens."* → nosotros nunca guardamos ni pedimos tokens de suscripción; el tier hosted es API key.
- *"Advertised usage limits for Pro and Max plans assume ordinary, individual usage of Claude Code and the Agent SDK."* → un agente de curso con un plan personal es zona gris de rate limits, no de legalidad.
- `claude setup-token` genera un token OAuth de larga duración (`CLAUDE_CODE_OAUTH_TOKEN`) para uso headless/CI bajo suscripción **[S]** (docs de Claude Code en CI; verificar al implementar hosting).

Cronología del cierre a terceros **[S]** (VentureBeat, The Register, GitHub issues): bloqueo server-side a clientes que se hacían pasar por Claude Code (OpenCode y otros) el 2026-01-09; términos formalizados 2026-02-19/20; OpenCode quitó la integración 2026-03-19.

## 2. OpenAI: Codex y ChatGPT **[S]**

- Codex CLI permite login con ChatGPT; para CI/automatización recomiendan API key. No se encontró prohibición explícita a clientes de terceros con login de ChatGPT; lo que persiguen es pooling/reventa de una suscripción entre varios usuarios ("sub2api").
- Un ingeniero de OpenAI declinó confirmar cumplimiento de ToS de clientes forkeados con login de ChatGPT (GitHub Discussion #8338, 2026-02-09).
- Las páginas primarias de términos de OpenAI devolvieron 403 a la búsqueda automatizada: **no verificado en fuente original**.

## 3. Buzz (Block): topología de agentes **[V]** en README/ARCHITECTURE del repo

Repo: https://github.com/block/buzz (Apache-2.0). Docs: `ARCHITECTURE.md`, `crates/buzz-acp/README.md`, `crates/buzz-agent/`.

- El relay (Rust, Postgres/Redis/S3) es solo bus + storage. **No ejecuta agentes.**
- `buzz-acp` es un binario aparte: "can be deployed on any system with network access to the Buzz relay". Se conecta por WebSocket con NIP-42 y la clave Nostr del agente (`BUZZ_RELAY_URL`, `BUZZ_PRIVATE_KEY`). Spawnea el runtime por stdio/ACP.
- Claude Code y Codex no hablan ACP nativo: adaptadores `claude-agent-acp` (org agentclientprotocol / Zed) y `codex-acp`.
- Registrar Claude Code desde el desktop abre el OAuth de Anthropic en el browser; el token queda en `~/.claude/`, fuera de Buzz **[S]** (dplooy.com).
- Laptop cerrada → subproceso muerto → agente offline. **Inferido del diseño, no documentado.**
- "Buzz Agent" (`buzz-agent`) es un runtime propio mínimo que **sí requiere API key** (`ANTHROPIC_API_KEY` / OpenAI-compat / OpenRouter / Databricks) **[V]**. Blogs que dicen "sin API key" lo confunden con el flujo de Claude Code.

## 4. pi.dev **[V]** README y docs del repo

Repo: https://github.com/earendil-works/pi (antes badlogic/pi-mono), MIT. Paquete `@earendil-works/pi-coding-agent`.

- CLI + SDK. Modos: interactivo, `-p` (print), `--mode json`, `--mode rpc` (JSON por stdin/stdout), SDK embebible. Corre en Linux headless.
- 15+ providers: Anthropic, OpenAI, Google, Bedrock, Mistral, Groq, xAI, OpenRouter, **Ollama** (modelos abiertos locales), etc.
- Lee `AGENTS.md`/`CLAUDE.md`, tiene skills y tools `read/write/edit/bash`. **Sin MCP ni ACP nativos** (adaptador comunitario `pi-acp`). **Sin sistema de permisos**: recomiendan contenedor.
- Login OAuth con suscripción (Claude Pro/Max, ChatGPT) existe en pi, pero para Claude es exactamente lo prohibido en §1: desde ~abril 2026 la API responde "Third-party apps now draw from your extra usage, not your plan limits" (issue #3372) y hay riesgo de revocación (discussion #1999).

## 5. Conclusión (lo que cambia el plan)

1. Server y runner son procesos separados; el server nunca llama modelos.
2. Suscripción solo vale corriendo el binario del proveedor sin modificar, logueado por el usuario, donde el usuario lo corra (laptop o su propio Railway).
3. Hosted nuestro = API keys (BYO o nuestras con margen). Modelos abiertos vía pi/Ollama/OpenRouter sin problema de términos.
4. pi es el harness multi-provider para el tier con API keys, no una vía a suscripciones.
