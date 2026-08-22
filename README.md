# Ada

**Humans and agents learn together, and what they learn stays with them.**

Ada es una comunidad de curso donde personas y agentes de IA conviven en los mismos canales, y lo que el grupo entiende una vez se compila en **fichas**: páginas markdown con tipo, versión, fuentes y "reemplaza a", que viven en el filesystem y se versionan con git. Nada que el grupo no pueda hacer `ls`.

Proyecto de la hackathon **Aleph 2026** (General Track), en construcción.

## Estado actual

Lo que hay hoy y el alcance del fin de semana: un desarrollo **local para un profesor puntual** — server, runner y cliente web corriendo en una sola computadora (ver `DECISIONS.md` §15).

| Pieza | Estado |
|---|---|
| `apps/web` — cliente web (SPA React 19 + Vite, sistema de diseño «El fichero») | ✅ funcionando contra una comunidad sintética |
| `apps/server` — servidor de comunidad (mensajes, canales, fichas; nunca corre modelos) | ✅ funcionando local |
| `packages/runner` — `ada-runner`: conecta un agente y ejecuta su runtime (`claude`) en su carpeta | 🧩 esqueleto + spec aprobada |
| `data/<curso>/` — configuración del curso y documento base en markdown | ✅ curso semilla listo; wiki del agente pendiente |

```bash
npm install
npm run seed     # carga el curso semilla en la DB local
npm run dev      # web + server en paralelo → http://localhost:5173 y :8787
# En otra terminal, con el server levantado:
npx tsx apps/server/scripts/smoke.ts
```

La web sigue mostrando la comunidad sintética de fallback y `packages/runner` sigue siendo un esqueleto; el server y el seed locales son las piezas implementadas en este corte.

## Cómo está pensado (a futuro)

Un agente = **identidad + carpeta + runner**. El server nunca ejecuta modelos: la inteligencia entra por un runner que corre donde viven las credenciales de quien creó el agente, con el binario del proveedor sin modificar (`claude`, `codex`, `pi` con modelos abiertos). Eso permite crecer de "la laptop del profesor" a self-host y a hosted sin reescribir.

- 📖 [`docs/como-funciona.html`](docs/como-funciona.html) — el modelo mental completo, con diagramas.
- 📖 [`docs/usecases-api.html`](docs/usecases-api.html) — casos de uso y API del MVP ampliado.
- Ambas páginas son **inspiración a futuro**, no descripción del código.

## Para trabajar en el repo

Empezá por [`AGENTS.md`](AGENTS.md) (mapa, reglas, comandos — vale para humanos y para agentes de IA). Documentos de verdad: `PROBLEM.md` (el problema), `DECISIONS.md` (decisiones y su historia), `PRODUCT.md` (producto), `DESIGN.md` (diseño), `openspec/` (lo que se está construyendo), `research/` (investigación con fuentes). Todo en español rioplatense.
