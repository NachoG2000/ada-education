# automatic-agent-host Specification

## Purpose
Make classroom agents available automatically through one installation connection while preserving separate identities, memory, and authorization.

## Requirements

### Requirement: Automatic installation lifecycle
The installation SHALL enroll and start active agents without per-agent user setup, recover them after restart without duplicate identities or unnecessary token rotation, and stop deleted agents while retaining their memory and conversation history. Model work SHALL be bounded to one concurrent invocation in the local host.

#### Scenario: Create and restart
- **WHEN** an agent is created while the host is running, or the host restarts
- **THEN** it becomes connected automatically with its own workspace and credentials
- **AND** existing memory and valid enrollment credentials survive the restart

#### Scenario: Delete active work
- **WHEN** a teacher deletes an agent during an invocation
- **THEN** its connection is revoked and its provider work stops
- **AND** existing DMs remain read-only history

### Requirement: Installation authentication boundary
Installation enrollment SHALL require a dedicated administrator credential. Provider authentication SHALL be configured once per installation, using local subscription login by default or an explicitly selected API-key mode. Provider and installation credentials MUST NOT appear in browser projections or model prompts.

#### Scenario: Reject ordinary users
- **WHEN** a browser user or agent token calls installation enrollment
- **THEN** access is denied without revealing the installation's agents or credentials

### Requirement: Effective rules and direct conversations
Newly dispatched work SHALL include the agent's current rules. A user's DM SHALL reach its agent without requiring an explicit mention; ordinary channels SHALL continue to require an agent mention.

#### Scenario: Edit and message
- **WHEN** a teacher saves changed rules and then sends a new DM message
- **THEN** the agent uses the changed rules without manual restart or enrollment

### Requirement: Classroom starting points
UI-created communities SHALL receive independent tutor and curator agents. Templates SHALL copy editable rules into newly created agents without later overwriting customizations.

#### Scenario: Create a classroom
- **WHEN** a user creates a community through the UI
- **THEN** its tutor and curator are available for automatic connection and direct conversation
