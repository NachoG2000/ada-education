# Course Membership Specification

## Purpose

The existing claim/invite identity system now authorizes individual channel
snapshots and all new chat/configuration mutations.

## Requirements

### Requirement: Gated reads and writes derive identity from the token

With `ADA_REQUIRE_MEMBERSHIP=1`, all non-public REST requests require a valid
token; `/ws` requires a person token and `/ws/runner` requires an agent token.
Person snapshots contain open channels plus private channels they actively
belong to and only the messages/threads/cards/attachments/membership reachable
through those channels. Agent tokens remain GET-only on REST and receive only
their assigned course context. All new mutations derive actor/creator from the
token and ignore or reject conflicting body identity fields. Ungated local dev
keeps the person picker and legacy author input while enforcing entity and
channel membership rules.

#### Scenario: Gated private data cannot be inferred

- GIVEN Sofia is a valid course member but not a member of Martin's private channel
- WHEN she fetches the snapshot, searches, guesses entity URLs, and opens an attachment URL
- THEN no response reveals the channel name, membership, message/card/thread content, attachment metadata, or bytes.

#### Scenario: Existing join flow enters the new shell

- GIVEN a fresh gated browser and a valid single-use invite
- WHEN Sofia joins
- THEN she enters Inbox in the Buzz-shaped shell, appears live in Martin's roster, and can open/post only in authorized channels.
