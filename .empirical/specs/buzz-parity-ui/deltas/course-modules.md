## Purpose

Module data and runner ingest remain part of Ada's knowledge system, but the
Buzz-parity chat/config phase has no dedicated Modules page.

## MODIFIED Requirements

### Requirement: Modules are part of the community snapshot

The snapshot continues to carry modules/materials/difficulty/cards for runners
and inline conversation artifacts. The visible SPA has no `#modules` route,
sidebar entry, module sheet, or document-management surface; module channel
messages and card publications remain readable as conversation content subject
to channel authorization.

#### Scenario: Old modules hash is retired

- GIVEN Martin opens a saved `#modules` URL
- WHEN the new SPA resolves the hash
- THEN it replaces the destination with Inbox, exposes no module page or upload
  UI, and the existing module/card data remains intact through API and runner checks.
