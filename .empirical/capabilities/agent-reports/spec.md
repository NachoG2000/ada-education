# Agent Reports Specification

## Purpose

After advising a student, the agent files a report to the teacher: what it told the student (summary, not transcript) and what it recommends changing in the module. The teacher reconciles it into a decision card so the module improves without leaving its learning goals. The student can see that the summary was shared.

## Requirements

### Requirement: Agent files a report

The runner message `report.create` {studentId, moduleId, assignmentId?, told, recommendations[{id, text}], cites[]} stores a report with status `new`, broadcasts `report.updated`, and the agent also posts a message in `#teachers` summarising it with a citation to the plan card.

#### Scenario: Report after a plan

- GIVEN Sofia received a plan for 03-backprop
- WHEN the runner finishes the plan
- THEN Martin sees a new report on 03-backprop in `#modules` and a message from Ada in `#teachers` that cites the plan card.

### Requirement: Teacher reconciles a report

`POST /api/reports/:id/reconcile` {accepted[], note} publishes a `decision` card in the module's channel authored by the teacher (title "<module> · revision after <assignment>", body = accepted recommendations + note), updates the module's `revision` summary, sets the report to `reconciled`, and broadcasts `card.published` and `report.updated`.

#### Scenario: Apply to module

- GIVEN a `new` report on 03-backprop with three recommendations
- WHEN Martin checks two of them, writes "Keep the vectorized form as the goal; add the scalar example first" and presses "Apply to module"
- THEN a decision card appears in `#03-backprop`'s card row, the report shows "reconciled" with his note, and the module sheet shows the revision line.

### Requirement: Reports are transparent to the student

A report is never shown to a student, but the plan message that produced it ends with a line stating that a summary was shared with the teacher.

#### Scenario: Student sees the sharing line

- GIVEN Ada answered Sofia with a plan
- WHEN Sofia reads the plan
- THEN the last paragraph reads "Ada shared a summary of this plan with Martin" and no report contents are visible to her.
