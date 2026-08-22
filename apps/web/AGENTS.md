# apps/web — el cliente web

**Hoy:** la única pieza implementada de Ada. SPA Vite + React 19 que corre contra la comunidad sintética de `src/lib/demo.ts` con fecha congelada (`NOW` en `App.tsx`). Sin router (`location.hash`), un solo contexto (`lib/community.tsx`), componentes de producto en `components/ada/`, primitivas shadcn en `components/ui/`, sistema de diseño «El fichero» en `index.css` (reglas con nombre en `DESIGN.md`: Tab Rule, One Sun Rule, Three Voices). Los tipos de dominio viven en `@ada/protocol` (`src/lib/types.ts` solo re-exporta). Detalle completo en el `AGENTS.md` raíz → sección Arquitectura.

**Cómo crece (no implementar sin spec):** según `openspec/changes/demo-local-backend/specs/web-client/`, esta app gana `src/lib/api.ts` (REST + WS contra `apps/server`) detrás del mismo `CommunityProvider`; `demo.ts` queda como modo sin server (`VITE_ADA_SERVER` ausente). Más adelante (inspiración, no código: `docs/usecases-api.html`): presencia en vivo, creación de agentes desde la UI, identidad por link de invitación, empaquetado Tauri.

Reglas locales: no tocar `components/ui/` salvo necesidad (preferí componer en `components/ada/`); ids rotos en `demo.ts` tiran la pantalla entera (los lookups lanzan); español rioplatense en todo.
