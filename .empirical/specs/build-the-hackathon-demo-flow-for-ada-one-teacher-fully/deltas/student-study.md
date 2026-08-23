## Purpose

A student's home shows the agent's feedback on the last assignment, which module slipped and how to learn it, and a private conversation with the agent where a question about advancing in a module returns a prioritized plan built from the module's cards and the student's own feedback.

## ADDED Requirements

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

The student page embeds the private channel between the student and Ada (`sofia-ada`), with its seeded history, a composer bound to that channel, and a suggested question chip. Sending a message that names a module triggers the runner's `plan` intent.

#### Scenario: Press Enter on the suggested question

- GIVEN the scripted runner is connected
- WHEN Sofia presses the chip "How do I get ahead in 03-backprop?" and Enter
- THEN her message appears, Ada shows "thinking", and within 6 s a plan arrives that names her feedback gap, lists prioritized steps, cites at least two cards of 03-backprop, and ends with "Ada shared a summary of this plan with Martin"
- AND after reloading the page the plan is still there.

### Requirement: Study page is student-only

`#home` renders only when `me.role === "student"`; a teacher landing on it is sent to `#modules`. The sidebar shows "My study" for the student and "Switch person" in the footer for everyone.

#### Scenario: Switch person

- GIVEN Martin is chosen
- WHEN he presses "Switch person" in the sidebar footer
- THEN the identity picker appears and choosing Sofia lands on `#home`.
