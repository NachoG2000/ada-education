## Purpose

Allow a course to organize shared learning materials and activities while preserving personal work and contextual tutor support.

## ADDED Requirements

### Requirement: Channel artifact lifecycle
The system SHALL persist typed artifacts with versions, authorized editing, and channel-scoped access. Shared artifacts SHALL be teacher managed; DM artifacts SHALL be owner managed.

#### Scenario: View module content
- **WHEN** a member opens Artifacts beside channel members
- **THEN** the existing auxiliary panel shows channel artifacts and opens a selected artifact without another pane
- **AND** a module guide remains discoverable above the conversation

#### Scenario: Concurrent edit
- **WHEN** a save uses an outdated artifact version
- **THEN** the server rejects the overwrite and the client retains the draft

### Requirement: Personal work and explicit submission
Personal answers SHALL be visible only to their author until an explicit assignment submission shares a snapshot with teachers. Subsequent drafts SHALL NOT mutate prior submissions.

#### Scenario: Private practice
- **WHEN** a student saves practice answers
- **THEN** peers and teachers cannot retrieve that private draft through the API

#### Scenario: Assignment submission
- **WHEN** a student explicitly submits assignment work
- **THEN** teachers can review the submitted snapshot while other students cannot

### Requirement: Contextual private assistance
Ask privately SHALL stage an editable question in a selected same-community agent DM, with source and return context, without automatically sending or exposing private work publicly.

#### Scenario: Consult about an exercise
- **WHEN** the learner chooses an artifact prompt and an available agent
- **THEN** its context accompanies the private draft and the learner can return to the module
