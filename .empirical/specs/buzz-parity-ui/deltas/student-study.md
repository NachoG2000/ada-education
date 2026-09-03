## Purpose

Student feedback and plan data remain available to the course system, but the
Buzz-parity chat/config phase has no dedicated My study page.

## MODIFIED Requirements

### Requirement: Ask the agent for a plan

Students ask agents in their authorized private/course channels using the same
composer, mention, runner, card citation, and report pipeline as other chat.
There is no embedded `#home` study dashboard, feedback page, module list, or
suggested-question page in this phase.

#### Scenario: Old study hash is retired

- GIVEN Sofia opens a saved `#home` URL
- WHEN the new SPA resolves the hash
- THEN it replaces the destination with Inbox, where her authorized private
  conversation remains available, and no feedback/study document page renders.
