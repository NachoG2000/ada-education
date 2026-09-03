# Student Study Specification

## Purpose

A student's home shows the agent's feedback on the last assignment, which module slipped and how to learn it, and a private conversation with the agent where a question about advancing in a module returns a prioritized plan built from the module's cards and the student's own feedback.

## Requirements

### Requirement: Feedback on the last assignment

The snapshot carries `assignments` (id, moduleId, channelId, title, due, status) and `feedback` (id, assignmentId, studentId, agentId, at, score {got, of}, summary, strengths[], gaps[{moduleId, note}], nextSteps[{text, cardId?}], visibility: "student"). The student page shows the latest feedback addressed to `me`.

#### Scenario: Sofia sees her feedback

- GIVEN the seed has feedback for Sofia on "Assignment 2 · Backprop by hand" with a gap on 03-backprop
- WHEN Sofia opens `#home`
- THEN the page shows the score, strengths, the slipped module "03-backprop" and next steps whose citation pills open the cited cards in the context panel.

### Requirement: Learn the slipped module

The module list on `#home` marks every module named in a feedback gap as "slipped · learn it"; opening it shows the module's compiled cards.

#### Scenario: Learn 03-backprop

- GIVEN Sofia's feedback names 03-backprop
- WHEN she presses "Learn it" on 03-backprop
- THEN the module's cards are listed and the first one opens in the context panel.

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

### Requirement: Study page is student-only

`#home` renders only when `me.role === "student"`; a teacher landing on it is sent to `#modules`. The sidebar shows "My study" for the student and "Switch person" in the footer for everyone.

#### Scenario: Switch person

- GIVEN Martin is chosen
- WHEN he presses "Switch person" in the sidebar footer
- THEN the identity picker appears and choosing Sofia lands on `#home`.
