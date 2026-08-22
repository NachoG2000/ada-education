# Design brief — Ada (initial iteration, to be improved)

> Original founder document, written for Claude Design. Kept as a starting point:
> product truth lives in `PRODUCT.md`; the visual world is decided in `DESIGN.md`.
> Inspiration images are in `design/inspiration/`.

I want to design the UI for a web app (later packaged as desktop with Tauri, just like Buzz and Berd from Block, so design for web) for a learning community: a course where humans and AI agents coexist in channels, and where knowledge compiles itself into cards that grow as people talk. It's for a 24-hour hackathon: prioritize a strong visual direction and 6-7 well-resolved screens over full coverage.

**The main reference is Buzz (buzz.xyz, github.com/block/buzz), not Slack.** Study how Buzz treats agents as members with their own identity, how it handles communities and invitations, and how it combines stable channels with volatile rooms. For agent management, the reference is Berd (github.com/block/berd).

## What the product is, in one sentence

A course community where the professor creates agents and adds them to channels as if they were assistants, and where the course cards (notes, assignments, decisions, answers) get published in channels and maintain themselves.

## Theses the UI has to make evident

1. **Agents are members created by the community.** There's no "the bot." The professor (or whoever has permission) creates whatever agents they want, each with a name, its own identity, instructions, a model provider, and adds them to specific channels. An agent can be in `#questions` and not in `#teachers`. They're subtly distinguished from people, not with a giant "BOT" badge.
2. **Knowledge lives in cards published in channels.** Every channel has cards (like Buzz's canvases, or Claude's artifacts): a person or an agent publishes them, they have a version, sources, and a visibility chip. When an agent learns something, a card appears or changes, live.
3. **Agent answers cite cards.** And when a question has already been answered, the agent answers "from the file," and that's visible.
4. **Stable channels and work channels.** Just like Buzz has permanent channels and volatile per-feature-branch rooms, here there are permanent course channels (`#general`, `#questions`, one per module) and work channels that are born with a task, an assignment, or an exam, live with their cards and submissions, and get archived when they're done.

## People and agents (examples, not fixed roles)

- **Martin, professor.** Creates the community, the channels, and the agents. Publishes material, assignments, decisions.
- **Sofia, student.** Asks questions in channels, opens threads, uploads notes, has a private channel with an agent she configured herself.
- **Course agent** (in the original brief it was called "Ada"; since Ada is the product, the example agent carries a different name): created by Martin and added to `#general`, `#questions`, and the module channels. Its instructions: maintain the course cards.
- **"Sofia's tutor"**: an agent that Sofia created and added only to her private channel.

## Base layout

```
┌──────────┬────────────────────────┬──────────────────┐
│ Community│ Channel                │ Contextual panel │
│ Channels │ messages + cards       │ (thread, card,   │
│ Work     │                        │  or empty)       │
│ Private  │                        │                  │
│ Members  │                        │                  │
└──────────┴────────────────────────┴──────────────────┘
```

- **Left**: community selector at the top; channels grouped into *Course* (stable), *Work* (volatile, with status: active / submitted / archived), *Private* (DMs and personal channels). Members with people and agents mixed, sorted by presence.
- **Center**: the channel. At the top, a strip with the **channel's cards** (base documents + published cards), as tabs or small tiles. Below, the messages. A published card also appears as a message-card in the flow.
- **Right, contextual panel**: opens with a thread (primary use, same as Slack/Buzz) or with a card. Design it as a stack of panels so others can be added in the future (card tree, history). Today: *Thread* and *Card*.

## Cards (the artifacts-like mechanism)

A card is a markdown document published in a channel. It has: a title, a type (note · assignment · decision · answer · submission), an author (person or agent), a version, sources (links to the messages or files it came from), "replaces" when applicable, and a **visibility chip** (for now: *channel members* or *only me*; the full permissions model isn't defined, don't design a permissions screen).

Actions on a card: open in the right panel, edit (if you're the author), publish to another channel, view history. The agent publishes cards using the same mechanism as a person.

## Screens I need (in this order)

1. **Onboarding and invitation.** I arrive via an invitation link to a community. I create my local identity (name + avatar; the key is generated in the browser, no email signup). I enter the course's `#general`. Variant: create a community from scratch. Reference: how Buzz web does it.
2. **Channel `#questions` with an open thread.** Sofia asks a question, the agent answers in the thread citing two cards. At the end of the thread, a compact tile: "Published as answer · Why does the gradient explode?" The new card appears, highlighted, in the channel's card strip.
3. **The same question, twice.** Another student asks something similar in a new thread. The answer has a different marker: "From the file · 2 days ago." This is the key moment of the demo.
4. **Agent management (Berd-style).** List of the community's agents. Create one: name, avatar, instructions, provider (API key or subscription), channels it participates in. Agent detail: which channels it's in, which cards it published, recent activity. Design the difference between a community agent (created by Martin) and a personal one (created by Sofia for her private channel).
5. **Edit channel: base documents.** Settings for the module channel `#03-backprop`: name, description, members (people and agents), and a *Base documents* section where Martin uploads or selects the cards that define the channel. On save, the agent starts generating cards from them, with a discreet "compiling" state in the strip.
6. **Work channel: an assignment.** Martin creates "Assignment 2 · Backprop by Hand" from an assignment brief. The work channel is created with the assignment as the base document, a due date, and assigned agents. Students submit by publishing a card of type *submission* with restricted visibility. The channel shows its status (active / submitted / archived).
7. **A decision.** Martin writes in `#general` "I'm moving the midterm to 9/15, half the class hasn't reached backprop yet." The agent publishes a *decision* card with a rationale and "replaces: original-midterm-date." Design what a decision card looks like open in the right panel.

## Visual direction

- I **don't** want an "AI app" look: no purple gradients, sparkles, or generic rounded chat bubbles. No crypto look either.
- Tone references: Buzz for structure and agents as members; Linear for density and typography; Obsidian for how it makes a markdown document look beautiful.
- Feeling: a serious, warm study tool, with some asymmetry and character. Typography with personality (a serif for card titles, sans for UI), strong typographic hierarchy, few boxes and borders.
- Light theme by default; dark if it comes naturally.
- Cards have to look like documents; messages like conversation. Let the contrast between the two be part of the design.
- Agents: an avatar with a different shape (not a circle) or a typographic detail, not a badge. Presence: "online," "thinking," "publishing a card."
- **Added later (founder):** a colorful, playful design, in the style of `design/inspiration/01-dashboard-fleet-main.png` (main reference, extrapolated to our case). The rest of the images in `design/inspiration/` serve as inspiration for pastel colors and details (e.g. characters with eyes for the agents).

## States I need resolved

- Agent "compiling" (between when there are base documents and when cards appear).
- Card new · updated · superseded.
- Live answer vs. answer from a card.
- Work channel active · submitted · archived.
- Newly created channel with no cards.

## What I DON'T need

Permissions screen, general settings, notifications, global search, mobile, submission grading.

## Deliverables

1. Screen flow (navigation diagram) for the 7 screens.
2. High-fidelity mockups of 2, 3, 4, and 7 first; then 1, 5, 6.
3. Minimal system: typography, palette, message components (person / agent / agent from a card), card tile in the flow, channel card strip, agent card, presence and work-channel states.

Start by proposing two different visual directions on a single screen (screen 2) before expanding.
