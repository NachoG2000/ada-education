# Design — Buzz interaction parity for the hosted shell

Interaction spec, not a visual one. Written with the `impeccable` **shape** method (job → outcome → direction → scope → states → interaction → constraints). Mode: **Operate** (the visitor completes a task; scanability, consistency and native expectations outrank expression). Evidence for every "Buzz does X" claim: `research/2026-09-03-buzz-interaction-inventory.md` (Part A) and for every "Ada does Y today": same file, Part B.

Reading rule: **Buzz is the interaction default, never the visual default.** Where Ada has a use case Buzz has, we copy Buzz's entry point, container, steps, landing and confirmation. The rendered components stay visually simple and use default shadcn surfaces, borders, spacing, and states; Buzz-specific gradients, inset-window styling, decoration, and visual identity are explicitly excluded. Where Buzz is internally inconsistent or unsafe for Ada's token model, we deviate and say so in §9. Where Ada has a use case Buzz lacks, §8 defines the implementation baseline and GitHub issue #4 reviews it hands-on after it is built.

## 1. Job and audience

- **Teacher** (Martin): opens Ada a few times a day on a laptop, creates the community, channels and agents, invites students, watches conversations, occasionally moderates. Needs management surfaces that are findable without a manual.
- **Student** (Sofia): opens Ada on a laptop or phone, reads channels, asks in `#questions`, talks to an agent in private. Needs to never see a control she cannot use, and to get back to where she was after a reload.
- **Evaluator** (the demo viewer): has used Slack/Discord/Buzz. Should recognise every gesture: "+" opens a dialog, kebab opens settings, ⌘K jumps anywhere, right panel is context.

## 2. Outcome and proof

Success: a person who knows Buzz can perform every shared use case in Ada without discovering anything new, and the URL bar, back button and reload behave like a web app. Proof: the parity matrix in §7 has no row marked "differs" except those listed in §9.

## 3. Selected direction

- **Visual authority:** unchanged — default base-nova shadcn (`DECISIONS.md` §22). No token, radius or type changes.
- **Structural thesis:** Buzz's three rings. *Ring 1, navigation* is persistent (rail when ≥2 communities, sidebar with pinned nav + sections, top chrome with back/forward and search). *Ring 2, the working surface* is a route (channel, DM, Agents, Settings, New message, Home-less: Ada's `/` redirects to the last channel). *Ring 3, context* is an auxiliary panel on the right (thread, channel settings, members, profile) that is a split pane on wide screens and an overlay below. Creation and quick edits never leave Ring 2: they are **dialogs**; management that lists things lives in **routes** (Agents, Settings).
- **Sequence:** trigger → container opens with focus on the first field → submit shows a pending label → on success the container closes and the app **lands** where the new thing lives (a new channel is opened, a new DM is opened, a new agent is shown in the Agents list) → a toast confirms only when the landing itself does not.
- **Focal moment:** none. Operate mode; the reward is that nothing surprises.

## 4. Scope and boundaries

- **In:** every row of §7 and §8. Router, dialogs, auxiliary panels, Agents page, Settings route, hover toolbar, command palette, keyboard shortcuts, toaster, empty states, pending/error states, teacher/student visibility, responsive behaviour.
- **Untouched:** server tenancy and token model; runner CLI; protocol event shapes (only additive inputs); `components/ui/*` primitives (compose, do not fork); the paused Card File design system.
- **Anti-goals:** no bubbles, no badges saying "BOT", no Buzz gradient or inset-window chrome, no custom styling pass, no "improving" a component's look while moving it, no features Buzz has that Ada's protocol lacks (§ proposal Non-goals).

## 5. States and ranges

Realistic ranges the interactions must survive: 1–5 communities per user; 3–40 channels per community; 0–8 agents; 20–40 members; 0–200 messages loaded per channel; thread with 0–50 replies; a phone at 360px and a laptop at 1440px.

Material states every surface names explicitly:

| Surface | Empty | Loading | Error | Permission |
|---|---|---|---|---|
| Sidebar channels | "No channels yet" + Browse / Create (teacher) | skeleton rows | inline retry | student sees Browse only |
| Channel | "This is the beginning of #name" + description; teacher sees "Invite people" and "Add an agent" | skeleton | banner "Couldn't load messages" + Retry | archived: composer replaced by "This channel is archived" row |
| Thread panel | root message + "No replies yet" | skeleton | inline retry | — |
| Agents page | teacher: "No agents yet" + Create agent; student: "No agents in this community" | skeleton cards | banner | student sees list, no create/edit |
| Members panel | never empty (self) | skeleton | inline | teacher sees row menus |
| Settings › Invites | "No active invites" + Create invite | — | inline | teacher only; student never sees the section |
| Dialogs | — | submit button pending label ("Creating…") | inline error under the form, focus returned to first invalid field | forbidden dialogs are unreachable (trigger hidden) |
| Socket | — | header "Connecting…" | header "Reconnecting…" + composer still enabled, sends queue-fail with toast | — |

## 6. Interaction and layout

### 6.1 Navigation model (Buzz `routes.ts:1-19`, `AppShell.tsx:171-323`)

Routes (history API; the server already serves `index.html` for non-`/api` paths):

```
/                                   → redirect to last community's last/first joined channel, empty Inbox if it has none, else onboarding
/c/:communityId                     → redirect to last visited channel in that community, else first joined, else empty Inbox
/c/:communityId/channels/:channelId
/c/:communityId/channels/:channelId/threads/:threadId
/c/:communityId/messages/new        → new-message screen (Ada: pick an agent)
/c/:communityId/agents
/c/:communityId/agents/:agentId     → Agents page with the agent's panel open
/settings                           → ?section=profile|community|members|invites|shortcuts|account
```

- Last visited channel per community persists in `localStorage` (Buzz `communityNavigationStorage.ts`); active community persists as today.
- Settings replaces the working surface and hides sidebar + rail (Buzz `AppShell.tsx:778-816`); back returns to the previous route; switching section rewrites the history entry rather than pushing (Buzz `:641-648`).
- Top chrome: back / forward buttons, sidebar toggle, search trigger (⌘K). Hidden on `/settings`.
- TanStack Router owns these routes and history transitions (§10).

### 6.2 Shell (Buzz `AppShell.tsx:753-982`, `AppSidebar.tsx:72-137`)

- **Rail** (56px) only when the user belongs to ≥2 communities; "+" at the bottom opens the Add community dialog; right-click on a community icon opens a context menu: Invite to community (teacher), Community settings (teacher), Leave community.
- **Sidebar** header = **community switcher**: community name + chevron; dropdown lists the user's communities, then "Add a community", then (teacher) "Invite to community", "Community settings", then "Leave community". Below the header: pinned nav **Agents** (with count of agents online), then sections **Channels** (header "+" for teachers, "Browse" for everyone), **Direct messages** (header pencil = New message), and — teacher only — **Student conversations** (§8.4). Footer: user avatar + name → menu: Settings, Sign out.
- **Working surface**: channel header (name, description, member avatar stack → Members panel, kebab → Channel settings / Copy channel name / Leave / Archive), message list, composer.
- **Auxiliary panel** (right): thread, channel settings, members, profile. ≥1024px: split pane, resizable 300–560px. <1024px: overlay `Sheet` from the right. Only one auxiliary panel open at a time; opening another replaces it.
- **Responsive**: <768px the sidebar is a left `Sheet` opened from the top chrome; the rail folds into the sidebar sheet's top row.

### 6.3 Account (Buzz `MachineOnboardingFlow.tsx`, `SignOutSection.tsx`)

- **First run** stays a full-screen flow (Buzz does the same): Create account → **Save your token** step → community step (Create / Join). The token step gains Buzz's backup gate: the Continue button is disabled until the user ticks "I saved this token somewhere safe" (Buzz `SignOutSection.tsx:183-205` uses the same gate at sign-out). Copy button: idle → "Copied" for 2s.
- **Restore with token** stays a full-screen step reachable from the first screen.
- **Sign out** moves to Settings › Account and to the footer menu; both open the same `AlertDialog`: "Sign out of Ada on this device? You will need your user token to sign back in." + checkbox "I have my token" gating the destructive button; pending label "Signing out…". Deviation from Buzz's two gates (typed phrase) — one gate is enough because Ada wipes nothing but the token.
- **Profile**: Settings › Profile — display name inline form backed by `PATCH /api/users/me` (§10).

### 6.4 Communities (Buzz `AddCommunityDialog.tsx:96-190`, `EditCommunityDialog.tsx:124-238`, `CommunitySwitcher.tsx:297-355`)

| Use case | Entry | Container | Steps | Lands |
|---|---|---|---|---|
| Add community (≥1 already) | rail "+" · switcher "Add a community" | `Dialog`, two-step: choose → Create / Join, back arrow | Create: name, term. Join: code | Switches to the new/joined community's last/first joined channel, or its empty Inbox when none exists; dialog closes; no toast |
| Create/join with zero communities | automatic | full-screen onboarding (as today) | same fields | same |
| Switch | rail icon · switcher item | none | — | last visited channel of that community |
| Community settings | switcher · rail context menu · Settings › Community | Settings section (route) — Buzz uses a dialog; Ada uses the Settings route because it also hosts Members and Invites, keeping one management place | name, term; Save; pending "Saving…" | stays; toast "Community updated" |
| Invite | switcher · rail context menu · Settings › Members "Invite" · channel empty state | `Dialog` (§8.2) | — | dialog stays open showing the code |
| Leave | switcher menu · rail context menu | `AlertDialog` (kept — Buzz has none) "Leave {name}? You will need a new invite to return." | — | next community's last channel, or onboarding |

Join-code redemption returns whether a code was consumed; an idempotent redemption shows toast "You are already a member" and switches anyway.

### 6.5 Channels (Buzz `ChannelBrowserDialog.tsx`, `CreateChannelFormFields.tsx:67-227`, `ChannelManagementSheet.tsx:87-134`, `ChannelContextMenu.tsx`, `ChannelSectionDialogs.tsx:280-341`)

| Use case | Entry | Container | Steps | Lands / confirm |
|---|---|---|---|---|
| Browse | sidebar "Browse" · ⇧⌘O · ⌘K action | `Dialog`: tabs **All / Joined / Archived**, search, list rows (name, description, member count, Joined tag). Row click on a non-joined channel joins and navigates; on a joined one navigates. When the search has no exact match and the user is a teacher, last row is "Create #query" | — | navigates into the channel; dialog closes |
| Create | Channels header "+" (teacher) · ⇧⌘N · browser "Create #query" · ⌘K action | `Dialog` "Create a channel": **name** (required, lowercase-kebab hint), **description** (optional), **visibility** Public / Private radio (default Public; private explains "Only people you add can see it") | pending "Creating…" | navigates into the new channel; dialog closes |
| Channel settings | header kebab "Channel settings" · sidebar row context menu | auxiliary panel: name and description as inline editable rows (click → input, Enter saves, Esc cancels), visibility row, **Members** list with "Add people" and "Add agent" (teacher; opens the pickers of §6.7) and remove ✕ per row, then Archive (teacher) and Leave (member) at the bottom | inline saves; toast only on error | stays open |
| Archive | settings panel · context menu (teacher) | `AlertDialog` "Archive #name? It becomes read-only and leaves the channel list." | — | navigates to the next channel if it was active |
| Leave | context menu · settings panel · header kebab (non-teacher members) | `AlertDialog` (Buzz confirms too) | — | next channel |
| Join public | browser row | direct | — | navigates |
| Context menu (right-click sidebar row) | — | `ContextMenu`: Open, Copy channel name, Channel settings, Leave, Archive (teacher) | — | — |

Unread badges, mute and star are out (no protocol support). Archived channels appear only in the browser's Archived tab and stay readable there.

### 6.6 Direct messages (Buzz `NewMessageScreen.tsx`, `AppShell.tsx:866-872`)

- **New message**: DM section pencil · ⇧⌘K · ⌘K action → route `/messages/new`: header replaced by a "To:" field with a popover list of agents in the community (Ada DMs are user↔agent only, §8.4); picking one opens or creates the DM (idempotent) and navigates into it. No composer before a recipient is chosen (Ada has no group DMs; Buzz's chip list collapses to a single pick).
- **From an agent**: agent profile popover/panel "Message" button; Agents page row "Message".
- **List**: DM section rows show the agent avatar (not `#`), name, presence dot.
- **Archived DM** (agent deleted): row stays with a muted "archived" tag; opening shows a banner "This agent was deleted; the conversation is read-only."

### 6.7 Agents (Buzz `AgentsView.tsx`, `AgentDialog.tsx:30-90`, `AddAgentToChannelDialog.tsx:33-142`, `AgentStatusBadge.tsx:8-46`, `UserProfilePopover.tsx`)

- **Agents page** `/agents` (pinned nav): header "Agents" + (teacher) "Create agent" button. List rows: avatar, name, runtime · model, channels count, **status badge** online / thinking / publishing / offline with Buzz's 15-second "Starting…" grace after enrollment. Row click opens the **agent panel** (auxiliary): tabs **About** (instructions read-only, channels), **Setup** (teacher: runtime, model, "Rotate setup token", enrollment block after create/rotate), **Danger** (teacher: Delete). Row menu (teacher): Edit, Add to channel…, Message, Delete.
- **Create agent**: `Dialog` (Buzz uses dialogs for the whole family), single form: name, avatar URL, instructions, runtime (claude/codex), model, channels (checkbox list). Submit "Creating…" → dialog **switches to step 2 "Connect a runner"** (§8.3) showing the setup command and token with copy buttons and a "Done" button → lands on `/agents/:id` with the panel open.
- **Edit**: same dialog pre-filled from row menu / panel "Edit"; Save; toast "Agent updated".
- **Add to channel** (from agent): `Dialog` pick a channel (default: first non-DM active channel), already-member rows disabled with "Already in channel" (Buzz `:80-88`). From a channel: settings panel "Add agent" → same dialog with the channel fixed and the agent to pick.
- **Delete**: `AlertDialog` "Delete {name}? Its private conversations become read-only." → toast; if the panel was open it closes and the list updates.
- **Rotate token**: `AlertDialog` → the Setup tab shows the new enrollment block.
- **Profile popover**: clicking an agent's name/avatar in a message, member list or mention opens a `Popover` (Buzz `UserProfilePopover.tsx`): avatar with status, name, runtime · model, "working for 12s" when thinking, buttons Message and (teacher) Manage → Agents page.
- **Sidebar**: the Agents *section* is removed; agents are reached through the pinned nav, DMs and profiles.

### 6.8 Members (Buzz `MembersSidebar.tsx`, `CommunityMembersSettingsCard.tsx:104-243`, `UserProfilePopover.tsx`)

- **Channel members panel**: header avatar stack → auxiliary panel listing people and agents in the channel with presence, search, (teacher) "Add people"/"Add agent", per-row ✕ for private channels.
- **Community members**: Settings › Members (teacher): table of members with role icon (teacher / student), presence, joined date; per-row `DropdownMenu` "Make teacher" / "Make student" / "Remove from community". Remove keeps Ada's `AlertDialog` (Buzz removes without confirm). Role change is optimistic with toast and persists through `PATCH membership` (§10). The last-teacher rule disables the demoting/removing item with a tooltip "A community needs at least one teacher" instead of failing after the click (§8.6).
- **Profile popover** for people: avatar, name, role, presence; teacher additionally sees "Remove" only inside Settings › Members, not in the popover (keep moderation in one place).
- The sidebar **Members tab** is removed (its content lives in the two places above).

### 6.9 Threads (Buzz `MessageThreadPanel.tsx`, `FocusThreadDrawer.tsx:59-168`)

- **Open**: hover toolbar "Reply in thread" or the "N replies · last reply 3m ago" affordance under a message with replies. URL gains `/threads/:id`.
- **Panel**: auxiliary panel with root message, replies grouped by author within a time window, its own composer (Enter sends, Shift+Enter newline, same mention popover). ≥1024px split pane; below, overlay `Sheet` with scrim. **Escape** closes; close button closes; navigating to another channel closes.
- Follow/unfollow and view-mode toggle are out (no notification model).

### 6.10 Messages (Buzz `MessageActionBar.tsx:89-304`, `MessageComposer.tsx:676-970`)

- **Hover toolbar** (appears on hover/focus-within, right-aligned on the row): Reply in thread · Edit (author) · More ▾. More menu: Copy text, Copy link (route + message id anchor), Delete (author or teacher; red). No reactions (out).
- **Edit**: inline; the row becomes a multi-line textarea with Save / Cancel, Enter saves, Escape cancels, "(edited)" suffix after.
- **Delete**: `AlertDialog` (both products confirm) → tombstone "This message was deleted".
- **Composer**: Enter sends, Shift+Enter newline; `@` opens a mention popover listing members then agents, navigable with ↑ ↓ Enter Esc, inserting `@Name `; mention keys take priority over send (Buzz `:676-681`). Disabled with an explanatory row when archived. Draft persists per channel in memory.
- **Rendering**: paragraphs and fenced `code` blocks render as such; `cite` blocks render as plain text with the card title until a cards UI exists (issue #4 asks about this).
- **Mentions matter**: an agent only works when `@Name` appears and it is a channel member (`apps/server/src/index.ts:205-212`); the composer therefore shows agents in the mention list only when they are in this channel, and the channel empty state for teachers says "Mention @agent to ask it".

### 6.11 Search / command palette (Buzz `TopbarSearch.tsx:22-100`, `keyboard-shortcuts.ts`)

- ⌘K / top-chrome search → `Dialog` command palette. Sections in fixed order: **Channels, Direct messages, People, Agents, Actions**. Actions: Browse channels, Create channel (teacher), New message, Create agent (teacher), Invite to community (teacher), Settings. Client-side over the snapshot; no message search (no server index — out).
- Shortcuts: ⌘K search · ⇧⌘O browse channels · ⇧⌘N create channel · ⇧⌘K new message · ⌘, settings · ⌘[ / ⌘] back / forward · Esc closes the auxiliary panel or dialog. Listed in Settings › Keyboard shortcuts.

### 6.12 Settings (Buzz `SettingsPanels.tsx`, `AppShell.tsx:171-179, 641-648, 778-816`)

Route `/settings?section=…`, full-bleed, left section list, right panel. Sections: **Profile** (display name), **Community** (teacher: name, editable Term), **Members** (teacher), **Invites** (teacher: active invites table role · uses · expires · Revoke; "Create invite" opens the invite dialog), **Keyboard shortcuts**, **Account** (user id, "Sign out"). Students see Profile, Keyboard shortcuts, Account only.

### 6.13 Feedback

- Replace the bespoke notice div with the mounted shadcn toaster. Rule: toast **only** when the landing does not already show the result (role changed, invite copied, agent updated, errors). Creating a channel/DM/agent navigates instead of toasting.
- Every submit button has a pending label; every dialog shows its error inline above the footer; destructive dialogs disable their button while pending.

## 7. Parity matrix (shared use cases)

| Use case | Buzz | Ada today | Ada target | Status |
|---|---|---|---|---|
| URL per community/channel/thread | routes | component state | routes §6.1 | change |
| Community switcher | sidebar header dropdown + rail | rail only | dropdown + rail (≥2) | change |
| Add community | dialog choose→create/join | full-screen onboarding always | dialog when ≥1; onboarding at zero | change |
| Community settings | dialog | none | Settings › Community | change (route instead of dialog, §9) |
| Leave community | menu item, no confirm | roster button, confirm | menu item, confirm | change (keep confirm, §9) |
| Invite | dialog, auto-mint, TTL/uses, copy states | sheet, role/mode | dialog §8.2 | change |
| Members management | Settings › Members, row menu | sidebar tab, trash icon | Settings › Members, row menu + channel members panel | change |
| Browse channels | dialog, tabs, search | inline panel | dialog | change |
| Create channel | dialog, name/desc/visibility, lands in channel | inline input, name only | dialog, lands in channel | change |
| Channel settings | auxiliary panel | header pencil/trash | auxiliary panel | change |
| Archive channel | confirm | confirm | confirm | same |
| Leave channel | confirm | confirm | confirm | same |
| Channel context menu | yes | none | yes | change |
| New message | route `/messages/new` with To: | agent row icon | route with To: (agents) | change |
| Agents list | `/agents` page | sidebar section | `/agents` page | change |
| Create/edit agent | dialog family | sheet | dialog + panel | change |
| Add agent to channel | dialog | checkbox list in sheet | dialog both directions | change |
| Agent status | badge with 4 states + grace | dot on/off | badge with 4 states + grace | change |
| Profile popover | popover | none | popover | change |
| Open thread | hover action + reply count; split/overlay; Esc | always-visible button; aside/sheet | hover action + reply count; split/overlay; Esc | change |
| Message actions | hover toolbar + more menu | three ghost buttons | hover toolbar + more menu | change |
| Edit message | inline multi-line | inline single-line input | inline multi-line | change |
| Delete message | confirm | confirm | confirm | same |
| Search | ⌘K dialog with sections + actions | none | ⌘K dialog (no messages) | change |
| Settings | route with sections | none | route with sections | change |
| Sign out | Settings, confirm with gates | icon, no confirm | Settings + footer, confirm with one gate | change |
| Feedback | toasts + pending labels | notice div | toasts + pending labels | change |
| Sidebar sheet <768px | yes | yes | yes | same |
| Auxiliary overlay below breakpoint | yes | thread only | all auxiliary panels | change |

## 8. Ada-only use cases (implementation baseline; post-implementation QA in GitHub issue #4)

8.1 **Teacher/student gating.** Follow Buzz's capability pattern: forbidden triggers are *hidden*, not disabled (Buzz `canManageChannel` / `canInviteToActiveCommunity`), except when the action exists but is temporarily blocked (last teacher, archived channel), which is *disabled with a tooltip*.

8.2 **Role-bound invites.** Invite dialog fields: **Role** (Student default / Teacher), **Expires after** (1 · 3 · 7 · 30 days, default 3), **Uses** (1 · 3 · 5 · 10 · 25 · No limit, default 1 — Ada's invites are one-per-student by default). Buzz auto-mints on open and re-mints on every setting change; Ada mints on an explicit **"Create invite"** click because each code is a stored credential and credential creation remains intentional even though active invites can be revoked (deviation §9). After minting: code in monospace with Copy (idle → Copied 2s), "Create another" resets the form. The code is shown once; Settings › Invites lists metadata only.

8.3 **Runner enrollment.** Step 2 of the Create agent dialog: title "Connect a runner", one paragraph ("Run this on the machine that has your Claude or Codex subscription. Ada never sees your provider credentials."), the setup command in a copyable block, the raw token in a second block behind a "Show token" toggle, a live status line that flips from "Waiting for the runner…" to "Runner online" when presence arrives, and "Done". The same block appears in the agent panel's Setup tab after Rotate. Never re-shown otherwise.

8.4 **Teacher-visible student DMs.** Teacher sidebar gets a collapsed section **Student conversations** listing `student · agent` rows, read-only for the teacher (composer replaced by "You are viewing a student's private conversation"). The student's own DM header carries a small persistent note "Teachers can read this conversation" (matches the report rule in `PRODUCT.md`: the student always sees what is shared).

8.5 **One-time tokens.** Account creation: backup gate (§6.3). Agent creation: "Show token" toggle (8.3). No re-display paths anywhere; Settings › Account says "Your token was shown once when you created the account. If you lose it, create a new account."

8.6 **Last-teacher invariant.** Pre-emptive: the only teacher sees "Leave community" and "Make student" (on self) disabled with tooltip "Invite another teacher first". Server still enforces.

8.7 **Cards published by agents.** Stay unrendered (`DECISIONS.md` §22), with no system line in the channel.

8.8 **Community `term`.** Labelled **Term**, shown next to the community name in the switcher and editable by teachers in Settings › Community; not elsewhere.

8.9 **Agent deletion archiving DMs.** §6.6 archived DM state.

## 9. Deviations from Buzz (deliberate)

1. Leave community and remove member **confirm** (Buzz does not) — irreversible for a student who needs a new invite.
2. Community settings live in the **Settings route**, not a dialog — Ada's community management (settings, members, invites) is three related sections; Buzz already puts members there.
3. Invite codes are minted on **explicit click**, not on dialog open — each code is a stored credential and its creation must be intentional.
4. Sign-out confirmation has **one gate**, not two — Ada wipes only the token.
5. New message picks **one agent**, no chips — DMs are user↔agent only.
6. No reactions, attachments, unread, mute, star, message search, thread follow, view-mode toggle — protocol has none of it.

## 10. Constraints and resolved implementation baseline

- **Router library**: TanStack Router, matching Buzz. Behaviour remains fixed by §6.1.
- **Server routes**: implement `PATCH /api/communities/:id/members/:userId {role}`, `GET`/`DELETE /api/communities/:id/invites[/:inviteId]`, and `PATCH /api/users/me {displayName}`.
- **Term**: keep the label **Term** and allow teachers to edit it after creation.
- **Cards system line**: none; `card.published` remains outside the mounted UI.
- **Example agent name** remains a separate open question (`AGENTS.md`) and is not changed by this work.
- Accessibility floor: every icon-only control has a name; dialogs trap focus and return it; auxiliary panels are `aside` with a heading; toasts are polite live regions; all shortcuts have a visible listing.
- Localisation: English only.
