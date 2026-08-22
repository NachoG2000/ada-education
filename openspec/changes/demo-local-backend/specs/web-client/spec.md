## Purpose

The web client stops being a mockup: it connects to the community server, receives live events, writes messages, and shows agent presence. It keeps the serverless demo mode. (Agent creation from the UI was left out of the weekend: `DECISIONS.md` §15.)

## ADDED Requirements

### Requirement: Switchable data source
If `VITE_ADA_SERVER` exists, the client SHALL hydrate `CommunityProvider` with `GET /api/community` and keep it current with the `/ws` events. If it doesn't, it SHALL keep using `demo.ts`'s synthetic community exactly as today. `components/ada` components and the screens MUST NOT know which of the two sources is active.

#### Scenario: connected mode
- **WHEN** `VITE_ADA_SERVER=http://localhost:8787` and the server is up
- **THEN** the screen shows the seed course and a new message appears without reloading

#### Scenario: demo mode
- **WHEN** there's no `VITE_ADA_SERVER`
- **THEN** the app runs with `demo.ts` and the frozen `NOW` date, same as before this change

### Requirement: Local identity
In connected mode the client SHALL ask once "who are you?" among the course's people and store the choice in `localStorage["ada:me"]`. That person SHALL be `meId` and the `authorId` of whatever gets written. There MUST NOT be email sign-up or passwords this weekend.

#### Scenario: first visit
- **WHEN** the connected app opens without `ada:me`
- **THEN** a picker appears with `martin`, `sofia`, `ignacio`; on choosing, you enter the initial channel as that person

### Requirement: A composer that really writes
The `Composer` SHALL send the text to `POST /api/channels/:id/messages` (with `threadId` when in a thread) and clear the field on confirmation. On typing `@` it SHALL offer autocomplete with the channel's members, agents first. Your own message SHALL appear when `message.created` arrives (no local optimism this weekend).

#### Scenario: mentioning an agent
- **WHEN** `sofia` types `@ada`, picks the agent, completes the question and sends
- **THEN** the message appears in the thread with the mention highlighted and, if `ada` is online, her status moves to `thinking`

### Requirement: Agent presence and status
The member list and the thread header SHALL reflect `presence` live: `away` as "disconnected" (no animation), `thinking` and `publishing` with the indicator that already exists in the design. When mentioning an `away` agent, the composer SHALL show an inline notice "`ada` is disconnected: its runner isn't running" without blocking the send.

#### Scenario: runner shut down
- **WHEN** `ada`'s runner closes
- **THEN** within 2 s the UI shows `ada` as disconnected

### Requirement: Live cards
On receiving `card.published` the client SHALL add or update the `Card` in state (by `id`), show it in the channel's row with its `state` (`new` with the sun, `updated`, `superseded`), and render the publication message. On receiving a message with `fromCard` it SHALL show the "already on file · N ago" seal.

#### Scenario: sealing
- **WHEN** a message from `ada` arrives with `fromCard`
- **THEN** the seal animation plays (380 ms, respecting `prefers-reduced-motion`) and the pill opens the card in the panel

### Requirement: The agent's sheet
An agent's sheet panel SHALL show its scope, who created it, the runtime and model reported by its runner (or "no runner" if it never connected), the channels it's in, and the cards it published.

#### Scenario: viewing ada
- **WHEN** `ada`'s sheet opens with her runner connected
- **THEN** it reads "community agent · created by martin · claude · online" and the list of published cards
