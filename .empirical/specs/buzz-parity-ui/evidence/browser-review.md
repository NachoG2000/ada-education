# Browser review — Buzz parity UI

Date: 2026-08-24  
Environment: Chrome through the in-app Browser connector, the complete local server + scripted runner + Vite stack at `http://localhost:5173`, and a throwaway SQLite course copy  
Reference viewport set: 1440×900 desktop and 375×812 narrow

Final screenshot artifacts: `final-connected-desktop.jpg` (1440×900) and
`final-connected-mobile.jpg` (375×812).

## Observed passes

| Surface | Desktop | Narrow | Interaction evidence |
| --- | --- | --- | --- |
| Shell/channel | Continuous dark system gradient, compact 36px chrome, 300px sidebar, rounded inset surface, open-row messages and bottom composer | No clipped content; top chrome remains usable and sidebar is absent until requested | Live status was connected. Sofia sent a message with Enter, edited it, added a 👍 reaction, opened its thread, and sent one reply. The server snapshot updated without a reload. |
| Mobile sidebar | n/a | 288px modal sheet over inert/blurred content; Course, Work and Private drawers; Inbox, Agents and profile footer | Open-sidebar control exposes a named `dialog "Course navigation"`; route selection closes the sheet |
| Thread | Resizable auxiliary column with root, reply count, divider, empty state, and bottom composer | Full inset overlay with an unobscured reply composer; screenshot visually inspected at 375×812 | A new root created a thread and the reply count advanced from 0 to 1. Close returned focus to the channel. |
| Channels | Course/Work/Private drawers and role-specific create controls | Dialog remains within the viewport | As Sofia, only `Create private channel` was present. A private channel was created with locked private visibility, appeared in Sofia's sidebar, navigated live, and remained absent from Martin's filtered snapshot. |
| Agents | Dense responsive catalog with agent identity/status/runtime/channel summary | Two-agent catalog fits 375px without horizontal scrolling | Sofia created a personal `Browser Guide` agent and received its one-time runner setup command. The agent appeared only in her snapshot; Ada was disabled for her. Martin could configure Ada but did not see Sofia's personal agent. |
| Settings | Two-column navigation and focused panel | Native compact section selector plus Back to Ada | Appearance changed to Light and back to System. Martin's Invites panel exposed `Create and copy link`; student-visible management controls were absent. |
| Command palette | Search/actions/channels/people/messages with keyboard-selected option | Fits narrow viewport as a modal | Cmd/Ctrl+K opened it; filtering worked after restoring the required Command root; Escape closed it; channel header search opened the scoped palette |

## Defects found and repaired during the pass

1. `CommandDialog` mounted `CommandInput`/`CommandList` without the required `Command` provider, causing `Cannot read properties of undefined (reading 'subscribe')`. Fixed in `components/ui/command.tsx` using the documented shadcn composition.
2. AI Elements tooltip composition wrapped an existing Button in another button, producing React invalid-nesting errors. Fixed with Base UI's supported `TooltipTrigger render={button}` composition.
3. The mobile top search label wrapped to two lines. The control now uses a shrink-safe/truncated label and hides the shortcut hint below `sm`.
4. Teacher-only channel, invite, runner-token and community-agent controls were visible to the student demo identity. Visible capabilities now match the server rules.
5. Channel-header search was a no-op. It now opens a channel-scoped message search.
6. Entering an unread channel repeatedly wrote the read marker because the effect did not stop after the local unread flag cleared. The effect now calls the API only while `channel.unread` is true; a second connected navigation produced no further console errors.
7. Global member search could open a community-agent editor for a student. Selection now checks the same teacher/personal-owner capability as the catalog; read-only agents navigate to a shared channel instead.
8. An invite URL opened after sign-out retained a mount-time `null` token and showed the owner claim form. Invite parsing now follows the hash subscription; the same-tab flow showed the named student join form and landed the new student in Inbox.
9. The seeded `#teachers` channel had restricted membership but inherited open visibility, exposing its name and activity to a new student. The seed now declares private visibility, the configured visibility is persisted by seed upsert, and a fresh gated student snapshot showed neither the channel button nor any `#teachers` message.
10. One old seeded announcement still instructed students to open the retired My study page. It now directs them to their private channel.

## Accessibility/runtime observations

- Landmark and dialog names were present in DOM snapshots: `Workspace controls`, `Course sidebar`, `<channel> channel`, `Messages`, `Thread`, `Search Ada`, `Course navigation`, `Course agents`.
- All sampled icon-only controls had accessible names.
- The sampled pages contained zero nested `button button` elements after repair.
- Theme controls reported pressed state, channel/search dialogs exposed combobox/listbox semantics, and disabled demo composer controls were announced as disabled.
- Final command evidence and independent reviews are recorded separately under this evidence directory.

## Connected authorization observations

- Sofia's shell had no Course or Work create buttons, no invite or runner-token controls, and no edit action for the community agent. Her private channel and personal agent were omitted from Martin's later viewer-filtered snapshot.
- Martin's shell exposed Course and Work creation, channel details, the community-agent editor, and the one-time student invite action.
- The browser console surfaced one read-marker update loop during the first pass. It was repaired, hot reloaded, and then retested by navigating to another connected channel; the server/Vite session produced no new browser-console output.
- The throwaway browser course was never the checked-in demo database.
- After independent-review repairs, a final connected pass sent a new message
  and observed one reconciled row, toggled the persisted conversation-spacing
  preference, returned from Settings to `#channel/questions`, and verified the
  named `5 channel members` control at 375×812. The dev session emitted no new
  console errors.

## Fresh gated-course flow

The second connected pass started a fresh throwaway gated course and exercised
the full user-facing gate:

1. An unauthenticated URL exposed only the public course name/subtitle and owner
   claim form—no workspace data.
2. The correct owner token entered Martin at Inbox with teacher controls.
3. Settings created a one-time invite URL.
4. Switch person removed the bearer session and returned to the membership
   door.
5. Opening the invite in the same tab showed the student-name form; `Privacy
   Student` joined and landed in Inbox.
6. The student's connected DOM contained no `teachers` channel control and no
   `#teachers` activity. The server check asserts the same boundary over the
   filtered snapshot.
