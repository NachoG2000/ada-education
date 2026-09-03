## Purpose

Agents are first-class course members that can be created and configured from
the SPA while execution and provider credentials stay outside Ada's server.

## ADDED Requirements

### Requirement: Agent identities and configuration persist

Typed REST/WS and SQLite state support list/get/create/update, deterministic
figure reroll, channel assignment, deactivate/reactivate, safe delete, and token
rotation. Configurable fields are name, description, instructions,
community/personal scope, scripted/claude runtime, optional model label, figure,
and channel IDs. Ordinary snapshots never contain the runner token.

#### Scenario: Create an educational agent

- GIVEN Martin opens Agents
- WHEN he creates community agent `Socratic coach`, selects Claude, assigns two course channels, and rerolls its figure
- THEN the catalog and channel rosters update live, one runner token/setup command is revealed, and a reload preserves the exact configuration and figure.

### Requirement: Provider credentials never enter Ada

Agent endpoints reject provider API keys/secrets. The create/rotate response
contains only Ada's runner enrollment token and an exact external-runner command;
the token is shown once, protected according to the existing token model,
redacted from logs/snapshots, and usable only on `/ws/runner`.

#### Scenario: Rotate runner access

- GIVEN an agent has an active external runner
- WHEN Martin rotates its token
- THEN the old runner closes/fails 4401, the new setup command connects, and no provider credential was requested or stored.

### Requirement: Agent lifecycle preserves authored history

Deactivation revokes runner access and removes the agent from active assignment
pickers while old messages/cards still resolve to its identity. Reactivation
requires a new token. Delete succeeds only when the agent has no authored
messages/cards/reports and no active channel memberships; otherwise it returns
409 with a deactivate recommendation.

#### Scenario: Authored agent cannot be deleted

- GIVEN Ada authored messages and cards
- WHEN Martin confirms Delete
- THEN no row or history changes, the dialog explains the conflict, and Martin can deactivate Ada instead.

### Requirement: Agent catalog and dialogs match the workspace

Agents is a route-level catalog with responsive Buzz-like page actions, status,
runtime/model/channel summaries, identity preview, create/edit dialogs, pending
and error states, setup-command copy affordances, and visible community/personal
scope. Agents use Ada's deterministic silhouette and never a BOT badge.

#### Scenario: Narrow agent actions

- GIVEN the Agents route is 375 px wide
- WHEN Sofia opens a personal agent's actions
- THEN actions are available from an accessible overflow menu and the edit dialog fits without horizontal scrolling.
