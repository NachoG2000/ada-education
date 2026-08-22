## Purpose

The community server: the source of truth for a course's members, channels, messages, threads and published cards. It's a bus and an archive; it never executes models or stores AI-provider credentials.

## ADDED Requirements

### Requirement: Full community bootstrap
The server SHALL expose `GET /api/community` returning an object with the same shape as `Community` from `packages/protocol` (members, channels, cards, messages, threads), so the web client can hydrate `CommunityProvider` without transforming anything.

#### Scenario: the client starts up
- **WHEN** a client requests `GET /api/community`
- **THEN** it receives all channels, members (people and agents, with `presence`), published cards, and all channels' messages and threads for the seed course, in a single JSON response

### Requirement: Writing messages
The server SHALL accept `POST /api/channels/:channelId/messages` with `{ authorId, paragraphs, threadId? }` and `POST /api/threads` with `{ rootMessageId }`. Every persisted message SHALL have `id`, `at` (ISO, assigned by the server) and `paragraphs: MessageBlock[][]`.

#### Scenario: a person writes in a channel
- **WHEN** `martin` sends a text message to `questions`
- **THEN** the server persists it, assigns `id` and `at`, and emits `message.created` to every connected client

#### Scenario: reply in a thread
- **WHEN** a message arrives with the `threadId` of an existing thread
- **THEN** the message is appended to `thread.replyIds` and `message.created` is emitted with the `threadId`

### Requirement: Real-time events for clients
The server SHALL expose a WebSocket at `/ws` emitting, as JSON `{ type, payload }`: `message.created`, `thread.created`, `card.published`, `member.presence`. Web clients don't send events over WS; they write over REST.

#### Scenario: a published card appears live
- **WHEN** a runner publishes a card in `questions`
- **THEN** every connected client receives `card.published` with the full `Card` and the announcing `Message` with `publishes`

### Requirement: Agent mention detection
The server SHALL detect, in every new message's `text` blocks, `@<handle>` mentions whose handle corresponds to an `agent` member. For each mentioned agent it SHALL build an `agent.mention` event with: the message, the channel, the thread (if any), the last N=20 messages of the channel or thread in chronological order, and the member who wrote; and SHALL deliver it **only** to that agent's connected runner. The server MUST NOT call any model or generate answers on its own.

#### Scenario: mention with a connected runner
- **WHEN** `sofia` writes `@ada why does the gradient explode?` in a `questions` thread and `ada`'s runner is connected
- **THEN** `ada`'s runner receives a single `agent.mention` with the thread's immediate context

#### Scenario: mention with a disconnected runner
- **WHEN** an agent whose runner isn't connected is mentioned
- **THEN** the server queues nothing, the message is published normally, and the agent's presence stays `away`

### Requirement: Runner connections and presence
The server SHALL accept runner WS connections at `/ws/runner?token=<token>`. The token SHALL identify a single agent; an invalid token SHALL close the connection. While a runner is connected, the agent SHALL have `presence: "online"`; on disconnect, `away`. A runner SHALL be able to report `thinking` and `publishing` while it works. Over WS the runner SHALL be able to send `message.create`, `card.publish` and `presence`, and the server SHALL validate that the `authorId` is the token's agent.

#### Scenario: runner connects
- **WHEN** a runner opens `/ws/runner` with `ada`'s token
- **THEN** `ada` becomes `online` and every client receives `member.presence`

#### Scenario: runner drops mid-answer
- **WHEN** the runner's connection closes
- **THEN** the agent becomes `away` and the server doesn't retry the mention

### Requirement: Published cards
The server SHALL accept `card.publish` (over the runner WS) or `POST /api/cards` with `{ channelId, authorId, path, title, type, version, visibility, sources, replaces?, body, state? }` and persist the `Card`. `path` (relative path in the agent's wiki) SHALL be the deduplication key: publishing the same `path` again by the same agent SHALL create a new version (`version + 1`, `state: "updated"`) and not a duplicate card. If `replaces` comes, the replaced card SHALL move to `state: "superseded"`. Each publication SHALL also generate a `Message` in the channel with `publishes: <cardId>`.

#### Scenario: first publication
- **WHEN** the runner publishes `questions/exploding-gradient.md` in `questions`
- **THEN** a new `Card` exists with `version: 1`, `state: "new"`, the server's `publishedAt`, and a publication message in `questions`

#### Scenario: republication of the same path
- **WHEN** the runner publishes the same `path` again with a changed body
- **THEN** the same `Card` moves to `version: 2` and `state: "updated"`; a second card does not appear in the row

### Requirement: Agents defined by configuration
Agents SHALL be defined in `data/<course>/community.json` (name, scope, instructions, channels, `figureSeed`, and a plain-text token for their runner) and created in the seed. The server MUST NOT expose an agent-creation endpoint this weekend (scope `DECISIONS.md` §15); the runner token comparison SHALL be direct (no hashing), acceptable because everything runs on the teacher's machine.

#### Scenario: the teacher adds an agent
- **WHEN** `martin` adds an agent to `community.json` and runs `npm run seed`
- **THEN** the agent appears as a member of its channels, `away` until its runner connects with that token

### Requirement: Seed course from `data/`
The server SHALL be able to create its initial state with `npm run seed` from `data/<course>/community.json` (course name, channels, people, agents) without depending on `demo.ts`. The demo's seed course SHALL be `neural-networks-2026` with channels `general`, `questions`, `03-backprop`; people `martin` (teacher), `sofia`, `ignacio` (students); agent `ada` (community) in all three channels.

#### Scenario: empty database
- **WHEN** `npm run seed` runs on an empty DB
- **THEN** `GET /api/community` returns the seed course with zero messages and the base card `backprop.md` marked `base: true` in `03-backprop`

### Requirement: Local storage without external services
The server SHALL persist to a SQLite file (`node:sqlite`) whose path is configured via `ADA_DB` (default `apps/server/data/ada.db`). It MUST NOT require Postgres, Redis or Docker to run the demo.

#### Scenario: server restart
- **WHEN** the server restarts
- **THEN** messages, cards and agents are still there; every agent's presence returns to `away` until their runners reconnect
