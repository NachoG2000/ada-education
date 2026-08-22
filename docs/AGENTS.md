# docs/ — páginas para personas, inspiración a futuro

**Qué es:** HTML autocontenido (sin build, doble clic y listo) que explica Ada a humanos. **No describe el código actual**: describe el producto completo hacia donde crece. Cada página lleva un banner que lo dice. Si contradicen al código o a `openspec/`, mandan estos últimos.

- `como-funciona.html` — modelo mental: server / runner / runtime / carpeta, secuencia de una mención, dónde vive `data/`, aislamiento en tres capas, los tres tiers (local / self-host / hosted).
- `usecases-api.html` — casos de uso y superficie de API del MVP ampliado.

**Hoy (alcance real, `DECISIONS.md` §15):** de todo lo que muestran estas páginas, este finde solo se construye la instalación local para un profesor puntual (server + runner + cliente en una máquina, curso definido por archivo de configuración).

Reglas: mismo lenguaje visual que `src/index.css` (los tokens están copiados en cada página); español rioplatense; si cambia `DECISIONS.md` §14-§15 o el spec, actualizá la página en la misma tarea; verificá el render (diagramas SVG) antes de cerrar.
