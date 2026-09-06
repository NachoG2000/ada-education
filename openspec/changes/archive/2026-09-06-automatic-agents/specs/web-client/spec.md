## MODIFIED Requirements

### Requirement: Agents management route and dialogs
The client SHALL provide a routed Agents list to every member and teacher-only create, edit, channel-assignment, and delete controls. Creation SHALL ask for name, rules, and optional channels with editable starter templates. Runtime, model, credentials, and runner enrollment MUST NOT be required or exposed in the mounted agent flow. Status MUST distinguish online, thinking, publishing, offline, and a 15-second Starting grace after creation.

#### Scenario: Create and enroll an agent
- **WHEN** a teacher submits valid name, rules, and channel assignments
- **THEN** the dialog closes, a confirmation appears, and the new agent detail opens
- **AND** the installation connects the agent automatically without an enrollment dialog

#### Scenario: Edit an agent
- **WHEN** a teacher saves a valid prefilled Edit agent dialog
- **THEN** the dialog closes, the list reflects the result, and a confirmation toast appears

#### Scenario: Add an agent to a channel
- **WHEN** a teacher opens Add to channel for an agent
- **THEN** active non-DM channels are selectable, existing memberships are disabled, and the first eligible channel is the default

#### Scenario: Disconnected installation
- **WHEN** an agent is offline after its Starting grace
- **THEN** its detail explains that the administrator can check the shared connection

#### Scenario: Delete an agent
- **WHEN** a teacher confirms agent deletion
- **THEN** the agent detail panel closes, the list updates, and its DMs become archived read-only history

#### Scenario: Rotate an enrollment token
- **WHEN** the installation replaces an invalid agent enrollment
- **THEN** the mounted agent flow requires no token copying or runner command
- **AND** the host reconnects the agent through the shared installation connection
