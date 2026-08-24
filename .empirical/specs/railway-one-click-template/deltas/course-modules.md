## Purpose

Material ingest works across machines: the runner no longer assumes it shares
a filesystem with the server.

## MODIFIED Requirements

### Requirement: Teacher uploads material to a module

`POST /api/modules/:id/materials` keeps storing the file under the course's
`raw/` and triggering the ingest mention — and the server now also serves a
stored material's content over an endpoint authenticated by agent token (or
person token when membership gating is on), so runners and clients never need
the server's disk.

#### Scenario: Upload still compiles cards

- GIVEN a teacher dropping a markdown file on a module
- WHEN the upload lands
- THEN the material is listed, the module flips to compiling, and the agent's ingest publishes cards exactly as today.

#### Scenario: Remote runner reads a material

- GIVEN a material uploaded through the web client
- WHEN a runner on another machine receives the ingest mention
- THEN it downloads the mentioned module's materials it lacks into its local `raw/` (skipping files it already has) before invoking the runtime, and the runtime reads them as local files — unchanged runtimes, and same-machine setups behave exactly as today.
