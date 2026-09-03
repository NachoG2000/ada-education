# Course Modules Specification

## Purpose

A course is organised in modules. The teacher loads study material per module on a dedicated page, sets a difficulty level calibrated to the cohort (with the agent's rationale), and sees what the agent compiled from the material. The server owns modules, materials and difficulty; the agent only suggests.

## Requirements

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

### Requirement: Teacher uploads material to a module

`POST /api/modules/:id/materials` with `{name, kind, size, text?}` stores the text under `data/<course>/raw/martin/modules/<nn>-<slug>/<name>`, records the material on the module, sets the module status to `compiling`, broadcasts `module.updated`, and sends Ada's runner an `agent.mention` with `intent: "ingest"` and the module id.

#### Scenario: Dropping a markdown file

- GIVEN Martin is on `#modules` with module 04 selected and Ada's runner connected
- WHEN he drops `attention.md` on the material zone
- THEN the material appears in the list at once, the module shows "compiling" and Ada's presence shows "publishing a card"
- AND within 6 s new `note` cards appear in the module (the newest in full yellow) and the module reads "ready" with a suggested difficulty and rationale.

#### Scenario: Upload without a runner

- GIVEN Ada's runner is not connected
- WHEN Martin uploads a material
- THEN the material is stored and listed, the module stays "compiling", and the page shows Ada as offline so the operator can see why nothing compiles.

### Requirement: Difficulty is set by the teacher, suggested by the agent

`PATCH /api/modules/:id` accepts `{difficulty: {level, rationale?}, objectives?}` and broadcasts `module.updated`. The runner's `module.suggest` message sets `difficulty.suggestedBy = "ada"` with a rationale and cohort evidence without overriding a level the teacher set by hand.

#### Scenario: Accepting Ada's suggestion

- GIVEN module 04 shows "Ada suggests Core — the material assumes matrix calculus; 2 of 3 students slipped on the chain rule in Assignment 2"
- WHEN Martin presses "Use Core"
- THEN the difficulty control shows Core as selected, the rationale stays visible, and a second browser tab on `#modules` shows the same without reload.

### Requirement: Modules page is teacher-only

`#modules` renders inside the shell only when `me.role === "teacher"`; a student landing on it is sent to `#home`. The sidebar shows "Modules" for the teacher above the Course drawer.

#### Scenario: A student opens the teacher page

- GIVEN Sofia is the chosen person
- WHEN she navigates to `#modules`
- THEN the hash becomes `#home` and her study page renders.
