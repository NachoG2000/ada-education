## Purpose

A `scripted` runner runtime answers mentions without a model, from templates filled with live community state, through the same WebSocket protocol and wiki → card pipeline as the `claude` runtime. It exists so the demo is convincing and reproducible; it is selectable per process and never replaces the real runtime.

## ADDED Requirements

### Requirement: Runtime selection

`ada-runner --runtime scripted` (or `ADA_RUNTIME=scripted`) is accepted; `claude` keeps working unchanged. `npm run dev` starts the scripted runtime by default for the demo; `ADA_RUNTIME=claude npm run dev` starts the real one.

#### Scenario: Start the scripted runner

- WHEN `npm run runner` starts with `ADA_RUNTIME=scripted`
- THEN the log says it connected as runtime `scripted` and the member sheet for Ada shows runtime "scripted".

### Requirement: Intent-driven, state-filled answers

On `agent.mention` the runtime announces `thinking`, waits 1.2–2.5 s, and picks an intent: `ingest` (module material: writes one `topic` card per heading of the material, or three default sections if the material has no headings, sets the module `ready` and sends `module.suggest`), `plan` (a student asks how to advance/prioritize in a module: answer with steps citing the module's cards and the student's feedback gap, write a `question` card with the plan, send `report.create`, post in `#teachers`), `question` (any other mention: answer from the module/card titles it finds, citing at least one card, or say what it looked for).

#### Scenario: Ingest writes cards from headings

- GIVEN `attention.md` has three `##` headings
- WHEN the runtime handles the ingest mention for module 04
- THEN three files exist under `wiki/modules/04-attention/`, three `note` cards are published in the module's channel, and `module.suggest` carries a level and rationale that name the material.

#### Scenario: Plan uses the feedback

- GIVEN Sofia's feedback has the gap "chain rule through the activation" on 03-backprop
- WHEN she asks how to get ahead in 03-backprop
- THEN the answer's first step names that gap and cites the module's chain-rule card.

#### Scenario: Unknown question

- GIVEN a mention with no module named and no matching card title
- WHEN the runtime answers
- THEN it says which modules it checked and invites a more specific question, without inventing a citation.
