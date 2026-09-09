## Purpose

Provide each course member a focused attention queue that links relevant conversation activity back to its context.

## ADDED Requirements

### Requirement: Personal attention and read state
Inbox SHALL include authorized direct mentions, incoming own-DM messages and replies in participated threads, with persistent per-user read state and list/detail navigation.

#### Scenario: Unrelated course activity
- **WHEN** somebody replies in a thread the viewer neither authored nor participated in and does not mention them
- **THEN** that message is not added to their personal Inbox

#### Scenario: Open and revisit
- **WHEN** a user marks an item read and returns after reload
- **THEN** its read state is preserved without affecting another user's Inbox

#### Scenario: Restricted conversation
- **WHEN** a viewer loses access to a channel
- **THEN** its messages no longer appear in their Inbox
