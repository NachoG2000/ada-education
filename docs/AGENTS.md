# docs/ — pages for people, future direction

**What it is:** Self-contained HTML (no build, double-click and go) that explains Ada to humans. **It doesn't describe today's code**: it describes the full product, in the direction it's growing toward. Every page carries a banner that says so. If they contradict the code or `openspec/`, the code and spec win.

- `how-it-works.html` — mental model: server / runner / runtime / folder, the sequence of a mention, where `data/` lives, three-layer isolation, the three tiers (local / self-host / hosted).
- `usecases-api.html` — use cases and API surface for the expanded MVP.

**Today (real scope, `DECISIONS.md` §19; deployment shape from §15):** of everything these pages show, only the fully local install exists (server + runner + client on one machine, course defined by a config file).

Rules: same visual language as `src/index.css` (the tokens are copied into each page); English; if `DECISIONS.md` §14-§15 or the spec changes, update the page in the same task; check the render (SVG diagrams) before closing out.
