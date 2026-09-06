# docs/ — current guides and future references

`README.md` is the documentation index. `architecture.md` describes the mounted hosted implementation and links to contributor instructions. Keep it aligned with the code and `DECISIONS.md` §22–§24.

The self-contained HTML pages (no build, double-click and go) describe future direction. Every page carries a banner that says so. If they contradict the code or current specifications, the code and spec win.

- `how-it-works.html` — mental model: server / runner / runtime / folder, the sequence of a mention, where `data/` lives, three-layer isolation, the three tiers (local / self-host / hosted).
- `usecases-api.html` — use cases and API surface for the expanded MVP.

`history/` preserves former workspace instructions for the retained singleton/fixture APIs and old web client. Those files are historical descriptions, not current setup instructions.

Rules: English; preserve historical decisions; keep current and future material explicitly labeled. If changing an HTML page or its SVG diagrams, check its render before closing out. The reference tokens are copied from `apps/web/src/index.css`. Add current setup/architecture documentation in Markdown rather than expanding the future API sketch into a second source of truth.

`agent-host.md` is the current local automatic-agent and installation-auth
runbook (§25). Preserve the external server/runner boundary when updating it.
