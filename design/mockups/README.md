> **Discarded exploration (08/22/2026).** These HTML→Figma mockups were abandoned; visual authority is `DESIGN.md` and the code in `apps/web/src/`. Kept only as a record.

# HTML → Figma mockups (code-to-canvas)

These HTML files **are not the app**. They're the "brush" for drawing screens in Figma via
the Figma MCP's `generate_figma_design`: served on `localhost:3456`, opened with the hash
`#figmacapture=<id>&figmaendpoint=…`, and Figma turns them into editable layers.

Figma file: https://www.figma.com/design/EBYW0YL8u2jkYf1gDB5Cyu

## Serving

```bash
cd design/mockups && python3 -m http.server 3456
```

## Structure

- `ada.css` — minimal system (tokens, typography, components). Direction A "Notebook".
- `theme-b.css` — Direction B "Blocks" override (loads after `ada.css`).
- `ada.js` — injects agent avatars (blobs with eyes) and inline SVG icons.
- `NN-*.html` — one screen per file, 1440×900, `body` = frame.

## Capture rules (important)

1. Every HTML includes `<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>`.
2. Fonts: Google Fonts only (Fraunces, Inter, JetBrains Mono) — Figma has them.
3. **Inside a wrapping paragraph, do NOT put `inline-block`/`inline-flex` elements
   (`.cite` chips, badges) followed by long text.** The capturer misaligns the lines.
   Put the chip at the end of the line/paragraph. `<b>`, `<i>`, `<code>` (pure inline) are fine.
4. No `position: sticky`, no visible inner scroll, no animations: the frame is static.
5. Emojis capture fine. Inline SVG captures fine.

## Component vocabulary (see `ada.css`)

- Layout: `.screen > .app` (grid 248 | 1fr | 408) → `.surface` ×3 (sidebar `.sb`, `main`, panel).
- Sidebar: `.sb-community`, `.sb-section`, `.sb-item[.active|.unread]`, `.wstat.activo|entregado|archivado`, `.sb-member`, `.sb-me`.
- Avatars: person `.av[.sm|.lg|.xl].{pink|sky|peach|mint|lavender|yellow}` + `.pres[.off]`;
  agent `<i class="blob [sm|lg|xl|xxl]" data-shape="square|bean|drop|star|cat|cloud" data-color="mint|lavender|peach|pink|sky|yellow" data-eyes="|closed|left|right" data-pres="|think|off|pub">`.
  Convention: **Ada** = `square` mint · **Sofia's tutor** = `bean` lavender · **Grader** = `drop` peach.
- Channel: `.ch-head`, `.pages-strip > .page-card[.base|.new|.upd|.rep|.compiling|.more|.add]` (color via `--pc: var(--t-apunte|consigna|decision|respuesta|entrega)`), `.msgs`, `.day-sep`, `.msg[.agent|.me|.frompage]`, `.pmsg > .page-msg-card`, `.composer`.
- Chips: `.chip[.sm].apunte|consigna|decision|respuesta|entrega|vis|agent|person|yellow|green|grey`, `.wchip.activo|entregado|archivado`, `.cite`, `.from-page`.
- Right panel: `.panel-tabs > .panel-tab[.active]`, `.panel-body`, `.thread-root`, `.thread-msgs`, `.published-card`, `.doc` (`.doc-kind`, `.doc-title`, `.doc-meta`, `.doc-body`, `.doc-actions`).
- Forms: `.card`, `.field`, `.input[.ph]`, `.textarea`, `.toggle[.on]`, `.check[.on]`, `.radio[.on]`, `.seg`, `.btn[.sm][.primary|.yellow|.ghost|.danger]`, `.compiling`.
- Icons: `<i class="ico" data-ico="thread|page|clock|eye|lock|plus|search|send|bell|more|check|chev|chevd|arrow|at|upload|history|copy|edit|share|x|users|bolt|link|key|hash|file|spark|replace|archive|calendar|sort|filter|grid|home|layers" data-size="15">`.

Note: the class names inside `ada.css`/`ada.js` (`.apunte`, `.wstat.activo`, …) keep their original Spanish names — these mockups are discarded and frozen as a record; renaming them would only churn dead files.
