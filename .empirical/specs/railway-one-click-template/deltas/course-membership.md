## Purpose

A deployed course is claimable and joinable: the deployer's owner token binds
the teacher, the teacher mints single-use invite links, and when membership
gating is on, every read and write is authenticated with a person token.
Local development keeps the ungated person picker.

## ADDED Requirements

### Requirement: Owner claim binds the teacher

With `ADA_OWNER_TOKEN` set and `ADA_REQUIRE_MEMBERSHIP=1`, `POST /api/claim`
with the owner token returns the course teacher's person id and a person
token; wrong tokens get 401. Re-claiming returns a working token without
duplicating people. `GET /api/course` stays unauthenticated and returns only
`{name, subtitle}`.

#### Scenario: Deployer claims a fresh deploy

- GIVEN a gated server freshly seeded with the example course
- WHEN the deployer POSTs the owner token to `/api/claim`
- THEN they receive the teacher's person token, and `GET /api/community` with it returns the snapshot with their `meId`.

### Requirement: Single-use invites create students

A teacher-authenticated `POST /api/invites` returns a single-use invite token.
`POST /api/join` with that token and a display name creates a `student`
person, marks the invite used, and returns the new person's token. Reuse gets
410. Connected clients receive `member.joined` so the roster updates live.

#### Scenario: Student joins by link

- GIVEN an invite token minted by the teacher
- WHEN a student opens `#join?token=…`, enters their name and joins
- THEN they land in `#home` as themselves, and the teacher's open tab shows the new member without reload.

### Requirement: Gated reads and writes derive identity from the token

With `ADA_REQUIRE_MEMBERSHIP=1`, `GET /api/community` and every write endpoint
require `Authorization: Bearer <person token>`; the server derives the author
from the token and 403s a mismatched body `authorId`. `/ws` requires
`?token=<person token>` (else close 4401). With the flag off, current behavior
is unchanged.

#### Scenario: Impersonation is refused

- GIVEN a gated server and Sofia's person token
- WHEN a request posts a message with `authorId: "martin"` under Sofia's token
- THEN the server responds 403 and nothing is written.

#### Scenario: Local dev keeps the picker

- GIVEN `npm run dev` without `ADA_REQUIRE_MEMBERSHIP`
- WHEN the SPA loads
- THEN the person picker works exactly as before and writes need no header.
