> **Exploración descartada (22/08/2026).** Estos mockups HTML→Figma se abandonaron; la autoridad visual es `DESIGN.md` y el código en `src/`. Se conservan solo como registro.

# Mockups HTML → Figma (code-to-canvas)

Estos HTML **no son la app**. Son el "pincel" para dibujar pantallas en Figma vía
`generate_figma_design` del Figma MCP: se sirven en `localhost:3456`, se abren con el hash
`#figmacapture=<id>&figmaendpoint=…` y Figma los convierte en capas editables.

Archivo Figma: https://www.figma.com/design/EBYW0YL8u2jkYf1gDB5Cyu

## Servir

```bash
cd design/mockups && python3 -m http.server 3456
```

## Estructura

- `ada.css` — sistema mínimo (tokens, tipografía, componentes). Dirección A "Cuaderno".
- `theme-b.css` — override Dirección B "Bloques" (se carga después de `ada.css`).
- `ada.js` — inyecta avatares de agente (blobs con ojos) e íconos inline SVG.
- `NN-*.html` — una pantalla por archivo, 1440×900, `body` = frame.

## Reglas de captura (importante)

1. Cada HTML incluye `<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>`.
2. Fuentes: solo Google Fonts (Fraunces, Inter, JetBrains Mono) — Figma las tiene.
3. **Dentro de un párrafo que hace wrap, NO poner elementos `inline-block`/`inline-flex`
   (chips `.cite`, badges) seguidos de texto largo.** El capturador desalinea las líneas.
   Poné el chip al final de la línea/párrafo. `<b>`, `<i>`, `<code>` (inline puros) van bien.
4. Nada de `position: sticky`, scroll interno visible ni animaciones: el frame es estático.
5. Emojis se capturan bien. SVG inline se captura bien.

## Vocabulario de componentes (ver `ada.css`)

- Layout: `.screen > .app` (grid 248 | 1fr | 408) → `.surface` ×3 (sidebar `.sb`, `main`, panel).
- Sidebar: `.sb-community`, `.sb-section`, `.sb-item[.active|.unread]`, `.wstat.activo|entregado|archivado`, `.sb-member`, `.sb-me`.
- Avatares: persona `.av[.sm|.lg|.xl].{pink|sky|peach|mint|lavender|yellow}` + `.pres[.off]`;
  agente `<i class="blob [sm|lg|xl|xxl]" data-shape="square|bean|drop|star|cat|cloud" data-color="mint|lavender|peach|pink|sky|yellow" data-eyes="|closed|left|right" data-pres="|think|off|pub">`.
  Convención: **Ada** = `square` mint · **Tutor de Sofía** = `bean` lavender · **Corrector** = `drop` peach.
- Canal: `.ch-head`, `.pages-strip > .page-card[.base|.new|.upd|.rep|.compiling|.more|.add]` (color por `--pc: var(--t-apunte|consigna|decision|respuesta|entrega)`), `.msgs`, `.day-sep`, `.msg[.agent|.me|.frompage]`, `.pmsg > .page-msg-card`, `.composer`.
- Chips: `.chip[.sm].apunte|consigna|decision|respuesta|entrega|vis|agent|person|yellow|green|grey`, `.wchip.activo|entregado|archivado`, `.cite`, `.from-page`.
- Panel derecho: `.panel-tabs > .panel-tab[.active]`, `.panel-body`, `.thread-root`, `.thread-msgs`, `.published-card`, `.doc` (`.doc-kind`, `.doc-title`, `.doc-meta`, `.doc-body`, `.doc-actions`).
- Forms: `.card`, `.field`, `.input[.ph]`, `.textarea`, `.toggle[.on]`, `.check[.on]`, `.radio[.on]`, `.seg`, `.btn[.sm][.primary|.yellow|.ghost|.danger]`, `.compiling`.
- Íconos: `<i class="ico" data-ico="thread|page|clock|eye|lock|plus|search|send|bell|more|check|chev|chevd|arrow|at|upload|history|copy|edit|share|x|users|bolt|link|key|hash|file|spark|replace|archive|calendar|sort|filter|grid|home|layers" data-size="15">`.
