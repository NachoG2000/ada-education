# App Settings Specification

## Purpose

Ada exposes only the configuration needed to operate a course conversation:
course/profile, appearance, agent runner setup, invites, and shortcuts.

## Requirements

### Requirement: Scoped settings replace the app surface

Settings uses Buzz's grouped two-column route shell with Back to Ada, responsive
off-canvas navigation, deep-linkable sections, loading/error/empty states, and
Escape close behavior. Its only sections are Course & profile, Appearance,
Agent runner setup, Invites, and Keyboard shortcuts.

#### Scenario: Return to prior channel

- GIVEN Martin opens Settings from `#questions`
- WHEN he changes appearance and chooses Back to Ada
- THEN `#questions` returns with its scroll/draft/thread state intact and the theme remains after reload.

### Requirement: Course, profile, appearance, and invites work

Teachers can update course name/subtitle and mint invite links; each person can
update their own display name/profile fields. Students see course fields read
only and cannot mint invites. Light/dark/system is local and honors OS changes;
shortcut keycaps document the implemented commands.

#### Scenario: Student cannot change the course

- GIVEN Sofia opens Course & profile
- WHEN she inspects the course section
- THEN name/subtitle are read only, invite controls are absent, and a forged course update request is 403.

### Requirement: Runner setup is operational documentation

The Agent runner section lists active agents, their runtime/status, token-rotation
control when authorized, and copyable commands using the current server origin.
It never asks for provider credentials and explains that those stay in the
external runner's environment.

#### Scenario: Copy a Claude runner command

- GIVEN Martin rotated a Claude agent token
- WHEN he copies the revealed command
- THEN it includes the server URL, agent working directory placeholder, runtime,
  and one-time token but no API key.
