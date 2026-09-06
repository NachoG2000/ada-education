# Buzz vs Ada — interaction-pattern inventory (2026-09-03)

Evidence file for `openspec/changes/archive/2026-09-05-buzz-interaction-parity/` and GitHub issues #3 and #4. It answers one question: **for every use case, how does Buzz present the interaction (entry point, container, steps, landing, confirmation, who sees it) and how does Ada present it today?** Visual style is out of scope; only the shape of the interaction is compared.

Method: two read-only code inventories produced by delegated agents on 2026-09-03, then spot-checked by the orchestrating agent (Ada `hosted.tsx:1345-1489`, `2454`, `2664`, `2764`; Buzz `desktop/src/app/AppShell.tsx:550-560`, `ChannelManagementSheet.tsx:90-115`, `CommunitySwitcher.tsx:163-332`). Every claim carries `path:line-range` and is **✓ primary** (read in the source) unless marked otherwise. Sources:

- Buzz: local clone at `/Users/ignaciogarcia/Desktop/Personal/buzz`, HEAD `0720f5380` (2026-08-23), the same commit pinned by `research/2026-08-23-buzz-ui-map.md` and `research/2026-09-01-buzz-fork-vs-own-frontend.md`. Upstream: <https://github.com/block/buzz>. **The chat client lives in `desktop/src`** (Tauri-wrapped React SPA); `web/src` is only the invite landing page and a public repo browser.
- Ada: this repo, working tree of 2026-09-03 after issue #1 closed. The mounted client is `apps/web/src/components/hosted.tsx` alone; everything under `apps/web/src/components/workspace/` and `components/ada/` is unmounted history.

Corrections applied to the delegated reports after verification:

- **Hosted agent dispatch is mention-driven.** `apps/server/src/index.ts:205-212` (`workAgentsForMessage`) selects, among the agents that are members of the channel, those whose `@Name` appears as a whole word in a `text` block. So typing `@agent` matters in the hosted flow, and an agent must be both a channel member and mentioned to receive work. The Ada inventory below marked this as unverified; treat this paragraph as the answer.
- Buzz's "leave community without confirmation" and "remove member without confirmation" are real (`CommunitySwitcher.tsx:163-191`, `CommunityMembersSettingsCard.tsx:178-243`). Ada already confirms both; the spec keeps Ada's confirmations (see `design.md`, "Deviations from Buzz").

What this file is not: a decision. Decisions live in `DECISIONS.md` §23 and in the spec under `openspec/changes/archive/2026-09-05-buzz-interaction-parity/`.

## Implementation and QA addendum (2026-09-04)

**User clarification, primary:** during implementation Ignacio clarified that Buzz is the functionality/interaction reference, not the styling reference: keep the same kinds of components and behavior, but keep their appearance simple. This is now explicit in `DECISIONS.md` §23 and `openspec/changes/archive/2026-09-05-buzz-interaction-parity/design.md` §1. The mounted implementation therefore uses neutral default-shadcn surfaces, borders, spacing, sheets, dialogs, menus, tables, and plain image/initial avatars. It does not mount Buzz's gradient, inset-window treatment, or decorative avatar language. The older Card File CSS/design remains retained but unmounted as required by the repo history rules.

**Implemented boundary, primary:** TanStack Router owns the route tree in `apps/web/src/routes/` and `routeTree.gen.ts`; `components/hosted.tsx` owns global account/session and zero-community states; `components/hosted-surface.tsx` owns tenant hydration and maps the hosted snapshot into the shared workspace context; `components/workspace/shell.tsx` owns the three-ring responsive composition. The mounted workspace now includes the task containers mapped below: community/channel creation dialogs, searchable channel browser, routed channels/threads/new-message/Agents/Settings, one auxiliary surface, identity popovers, message action menus, role-aware management, one-time runner enrollment, and the mounted toaster. `card.published` remains deliberately ignored by this surface.

**Runtime evidence, primary (in-app browser against the local API and then the production Vite bundle):**

| Area | Evidence observed |
|---|---|
| Account/community | New-account token was shown once; Continue stayed disabled until acknowledgement. Gated sign-out stayed disabled until “I have my token.” Zero-community create replaced a stale prior-account URL with the new community route. Two communities exposed the desktop rail and switching restored each community's last valid conversation. |
| Roles/privacy | A student saw no create-channel, create-agent, invite, community-management, or Student conversations controls. The student joined an open channel through Browse and opened a user-agent DM whose persistent header says teachers can read it. The same DM opened for the teacher in the collapsed Student conversations section with no composer and an explicit read-only explanation. |
| Channels/messages | Create navigated into the new channel. Settings opened in the right auxiliary surface; confirmed archive removed the channel from the active list while retaining it under Browse › Archived. Assigned-agent mention suggestions worked with keyboard selection. Message edit produced a multiline edited state; confirmed delete produced a tombstone. |
| Agents/settings | Teacher agent detail exposed About/Setup/Danger, Edit, Message, Add to channel, and confirmed token rotation; already-assigned channels were disabled. Student agent detail exposed the read-only variant. Settings sections were role-aware, section switches replaced history, and browser Back returned to the prior conversation. The last teacher's demote/remove actions were disabled and the management trigger supplied the safeguard tooltip. |
| Routing/responsive | A thread URL survived a full production reload. At 1440 and 1024 px the persistent rail/sidebar and auxiliary surface remained usable; at 767 and 360 px the rail/sidebar folded into the left overlay and the contextual surface used the right/mobile presentation. Captured 360 px and 1440 px browser renders were visually inspected: both showed the plain default-shadcn treatment with no decorative Buzz framing. The viewport was reset after QA. |

Material defects found by this QA and fixed before completion: transient session-restore 5xx responses no longer clear the saved user token; zero-community create/join now replaces any stale prior-account route; DM empty/composer copy no longer prefixes the agent with `#`; command-palette copy no longer implies unsupported global message search; and the retained workspace agent schema now persists the shared avatar URL through schema version 6. The final interaction review also found and closed two discoverability gaps: teachers can now archive from the channel-header menu, and context menus for inactive community icons carry that community into Settings, Invite, and Leave rather than requiring a preliminary switch. Production-browser checks verified the inactive-community Invite and Settings handoffs and the channel archive confirmation. Test credentials and invite codes were one-time values in a throwaway database and are not recorded here.

**Final verification, 2026-09-04:** all of the following passed after the fixes above: protocol strict TypeScript; hosted protocol contract; server TypeScript; issue #1 tenant REST/WS flow; runner TypeScript and Claude/Codex provider checks; workspace migration/reseed/access/CRUD/attachment/WS checks; membership-gated flow; module/card smoke flow; web TypeScript; and production Vite build. The final review fixes were followed by another web typecheck, lint, production build, and `git diff --check`, all successful. `npm run lint` exited 0 with only the pre-existing Fast Refresh export warnings plus the pre-existing `set-state-in-effect` warnings documented in the root `AGENTS.md`. The production build retained Vite's informational >500 kB chunk-size warning; code splitting is not part of issues #3/#4. `npx --yes @fission-ai/openspec@1.12.0 validate buzz-interaction-parity --strict` reported the change valid.

---

# Part A — Buzz inventory (delegated report, verified where noted above)

---

## 0. Correction to the task brief — `web/src` is not the chat client

The task described `web/src` (folders `app`, `features`, `shared`) as "the web SPA" containing the full interaction surface to inventory. That folder exists exactly as described structurally, but **it is not the chat client** — it is a small public-facing site with exactly two features:

- `invite` — the `/invite/$code` landing page (accept-invite-in-app / join-in-browser / legal policy notice).
- `repos` — a read-only public Git repository browser (`/`, `/repos`, `/repos/$repoId`, `/repos/$repoId/blob/$`).

Evidence:; `web/src/app/routes.ts:1-9` lists only `index`, `/invite/$code`, `/repos`, `/repos/$repoId`, `/repos/$repoId/blob/$`. `web/src/features/` contains only `invite/` and `repos/` (plus an empty `.gitkeep`) — confirmed by directory listing, no `channels`, `messages`, `agents`, `threads`, `settings`, `search`, etc. anywhere under `web/src`.

This matches and confirms `research/2026-08-23-buzz-ui-map.md` §"Method" note that "`web/` is a separate public repository browser" — that prior note was correct; the task brief's assumption was not.

**All of the actual chat/community/agent/message/thread/member/search/settings/notification/shortcut interaction patterns below live in `desktop/src`** (`desktop/src/app`, `desktop/src/features/*`), which is a Vite/React SPA wrapped by Tauri for desktop distribution — not a hosted web app, but the only place in the Buzz repo where these interaction patterns are implemented. Per the task's own scoping rule ("only look [at desktop/] if the web code delegates something to it"), this report documents `desktop/src` for every use case that `web/src` doesn't cover, since `web/src` delegates almost the entire product surface to the desktop app (see the "Download it now" / `buzz://join` deep-link CTAs in `web/src/features/invite/ui/InvitePage.tsx:230-264`, which hand off to the desktop app). No `mobile/`, `crates/`, or `admin-web/` code was read.

Because `desktop/` is a Tauri wrapper, a few surfaces are desktop-native (system tray, native window drag, OS notifications) and are flagged as such where relevant; they have no web equivalent and should be treated as out of scope for a pure web product like Ada.

---

## 1. App shell: layout, routes, navigation

**Entry point / container:** full page, not a dialog. `desktop/src/app/AppShell.tsx` is the single shell mounted for the whole app (`desktop/src/app/App.tsx` → router → `AppShell`).

**Structure**, evidence `desktop/src/app/AppShell.tsx`:
- Community rail (only if >1 community) — `AppShell.tsx:753-762`, delegating to `CommunityRail`.
- Resizable/collapsible sidebar (`AppSidebar`) — `AppShell.tsx:820-923`.
- Top chrome (back/forward, sidebar toggle) shown only when not in settings/huddle — `AppShell.tsx:769-776`, component `desktop/src/app/AppTopChrome.tsx:55-106`.
- Main content: either the full-bleed Settings screen (`AppShell.tsx:778-816`) or the routed channel/home/agents/etc. outlet inside `AppShellChannelSurface` (`AppShell.tsx:924-936`).
- Global overlays mounted alongside content: channel management sheet, channel browser, agent create/manage dialogs, send-feedback dialog, relay connection overlay (`AppShell.tsx:947-982`).

**Routes** — `desktop/src/app/routes.ts:1-19`: `/` (home/inbox), `/agents`, `/pulse`, `/reminders` (redirects to `/`), `/settings`, `/workflows`, `/workflows/$workflowId`, `/projects`, `/projects/$projectId`, `/messages/new`, `/channels/$channelId`, `/channels/$channelId/posts/$postId`.

**Navigation model:** Settings is a normal route (`/settings`), not a modal — `AppShell.tsx:171-172` comment: "Settings lives in history so back returns to the previous app entry." Switching settings section rewrites (not stacks) the history entry — `AppShell.tsx:641-648`. Community switch/community-scoped last-visited-channel restoration is persisted per-community in `localStorage` and replayed on the next mount of that community — `AppShell.tsx:275-323`, `desktop/src/features/communities/communityNavigationStorage.ts`.

**Sidebar sections**: pinned primary nav (Home/Inbox with badge, Agents, Pulse, Workflows, Projects — feature-gated) plus grouped channel sections (Starred, custom sections, Direct messages) — component `desktop/src/features/sidebar/ui/AppSidebarPinnedHeader.tsx` and `desktop/src/features/sidebar/ui/AppSidebar.tsx` (props list confirms this composition, `AppSidebar.tsx:72-137`).

**Responsive:** mobile breakpoint is `768px` (`desktop/src/shared/hooks/use-mobile.tsx:5,85-87`); below it the sidebar becomes an overlay Sheet (`useIsMobile()` consumed at `AppSidebar.tsx:141-142`, `openMobile` from `useSidebar()`). Thread/auxiliary-panel single-column breakpoint is a separate constant, `AUXILIARY_PANEL_SINGLE_COLUMN_BREAKPOINT_PX`, consumed via `useIsAuxiliaryPanelOverlay()`/`useIsThreadPanelOverlay()` — `use-mobile.tsx:88-95`.

---

## 2. Sign in / identity creation / restore account / sign out

There is no username/password "sign in." Identity is a locally generated or imported Nostr keypair (nsec/npub). Container: **full-screen onboarding flow**, not a dialog — `desktop/src/features/onboarding/ui/MachineOnboardingFlow.tsx` and `OnboardingFlow.tsx`, mounted before the router (outside `AppShell`).

**Identity creation** — `MachineOnboardingFlow.tsx` pages: `"identity" → "key-import" → "backup" → "setup" → "config"` (`MachineOnboardingFlow.tsx:48-53,88-90`). Steps:
1. Landing/"identity" page generates or offers to import a key (`LandingBees.tsx` decorative; `SetupStep.tsx`, `DownloadKeyStep.tsx`).
2. Backup step: encrypted password-protected backup creation + test-restore flow (`BackupStep.tsx`, `EncryptedBackupCreator.tsx`, `BackupTestFlow.tsx`, `BackupPasswordTimeline.tsx`).
3. Setup step: runtime/agent defaults (`SetupStep.tsx`, `DefaultConfigStep.tsx`).

**Restore account** — `NostrKeyImportForm.tsx` (paste/import nsec), reachable from `key-import` page or forced when `identityLost` is true (`MachineOnboardingFlow.tsx:88`, `OnboardingFlow.tsx` imports `importIdentity` at line 13). A masked nsec display component (`NsecMaskedDisplay.tsx`) is reused both during onboarding and in Settings' sign-out flow.

**Profile step** (name/avatar) — `desktop/src/features/onboarding/ui/ProfileStep.tsx` (`AvatarStep.tsx` for avatar upload), part of `OnboardingFlow.tsx`, run after identity exists and before entering a community — confirmed by import list `OnboardingFlow.tsx:9-40` (`AvatarStep`, `ProfileStep`, `MembershipDenied`, `CommunityChangeOverlay`).

**Membership-denied / relay-unreachable branches**: `OnboardingFlow.tsx:42-83` — `checkMembershipStatus()` returns `"denied" | "ok" | "unreachable" | "error"`; denied renders `MembershipDenied.tsx` (own screen with a retry/invite-redeem affordance), unreachable renders a distinct "relay unreachable" message rather than "denied."

**Sign out** — Settings page section, NOT a simple button: `desktop/src/features/settings/ui/SignOutSection.tsx`.
- Entry point: Settings → (bottom of a settings panel) "Sign out" card, destructive "Delete my data" button — `SignOutSection.tsx:122-149`.
- Container: `AlertDialog` (destructive confirmation), not a plain confirm — `SignOutSection.tsx:158-251`.
- Two-gate confirmation, both required before the destructive action enables (`canDelete` at `SignOutSection.tsx:60`):
  1. Checkbox "I have tested a key backup or saved this private key somewhere safe" next to a revealed masked nsec (`SignOutSection.tsx:183-205`).
  2. Type-to-confirm phrase `"wipe all my data"` in a text input (`SignOutSection.tsx:27,207-227`, constant `SIGNOUT_CONFIRM_PHRASE`).
- On confirm: calls `signOut()`, clears `localStorage`/`sessionStorage`, and (per the dialog copy) relaunches into first-run onboarding — `SignOutSection.tsx:100-121,163-167`. Failure shows a `toast.error` — `SignOutSection.tsx:115-120`.
- Feedback: `Spinner` + "Signing out…" pending label on the button while in flight — `SignOutSection.tsx:143-149,238-247`.

---

## 3. Create / switch / join / leave a community; community settings; roles; members

### Create / join
**Entry point:** "+" button at the bottom of the community rail (`desktop/src/features/sidebar/ui/CommunityRail.tsx:414-424`, `aria-label="Add community"`), or "Add a community" item inside the community switcher dropdown/profile menu (`desktop/src/features/communities/ui/CommunitySwitcher.tsx:344-355` profile-menu variant, `:434-437` sidebar-dropdown variant).

**Container:** `Dialog` — `AddCommunityDialog.tsx:96-190`, `data-testid="add-community-dialog"`.

**Steps (multi-step, "choose" → "create"/"join"):**
1. Choose screen: two big option rows — "Create a new community" / "Join an existing community" (`AddCommunityDialog.tsx:134-173`).
2. Create: hands off to `HostedCommunityCreateFlow.tsx`, described in-dialog as "Opens Builderlab in your browser" (`AddCommunityDialog.tsx:90`) — i.e. community creation happens on a separate hosted web flow, not fully in-app.
3. Join: `InviteRedeemForm` (`AddCommunityDialog.tsx:175-189`) — user pastes a community URL or invite link/code (`InviteRedeemForm.tsx:399-427`); a join policy (age attestation / ToS+Privacy checkboxes) is fetched and shown inline if the target relay requires it (`InviteRedeemForm.tsx:475-529`, `JoinPolicyNotice`); submit button copy changes contextually ("Join community" → "Accept and join") (`InviteRedeemForm.tsx:314-325`).
4. Back arrow returns to the choose screen (`AddCommunityDialog.tsx:108-122`).

**Validation/defaults:** submit disabled until `canSubmit` (a parseable relay URL or invite code) and until required policy checkboxes are checked (`InviteRedeemForm.tsx:140-149,293-305`).

**Feedback:** on success the dialog just closes (`handleClose`) and the app performs the actual relay connection via `communityOnboarding.start(...)` (`AddCommunityDialog.tsx:52-78`); failure (e.g. an onboarding flow already in progress) shows an inline error string above the form, not a toast (`AddCommunityDialog.tsx:70-76`).

### Switch
**Entry point:** click a community icon in the rail (`CommunityRail.tsx:131-146`) or pick from the `CommunitySwitcher` dropdown in the sidebar footer/profile menu (`CommunitySwitcher.tsx:404-414`).
**Container:** rail = plain button list (always visible, no dialog); switcher = `DropdownMenu` or `Popover` depending on `variant` (`CommunitySwitcher.tsx:362-441`).
**Feedback:** active community gets a left accent bar + filled background in the rail (`CommunityRail.tsx:136-142`); unread/mention state shown as a numeric badge or a plain dot, computed by `communityRailIndicators()` (`CommunityRail.tsx:66-86`), only when relay state is `"ready"` (never guesses during `unknown`/`loading`/`error`).
**Lands on:** the community's last-visited channel is restored via `communityNavigationStorage`, or Home if none/unavailable (`AppShell.tsx:296-323`).

### Leave
**Entry point:** "Leave community" in the `CommunitySwitcher`'s profile-menu popover (`CommunitySwitcher.tsx:322-333`) — visible for any role, not owner-gated in the UI. There is **no separate "delete community" action** found anywhere in `desktop/src` — only leave (owner leaving is presumably still just a membership leave-request; no destroy-the-community control exists in the code searched).
**Container:** inline in the popover, not a separate confirm dialog — clicking directly calls `handleLeaveCommunity()` (`CommunitySwitcher.tsx:163-191`). **No confirmation step** before leaving (contrast with channel-leave, which does confirm — see §5).
**Feedback:** button label flips to "Leaving…" while pending (`CommunitySwitcher.tsx:330`); on success closes the popover; if the server reports the user was "already-absent," a `toast()` informs them the local device removed the community anyway (`CommunitySwitcher.tsx:176-181`); on error, an inline red error line appears inside the popover and the popover is forced back open (`CommunitySwitcher.tsx:181-189`).

### Community settings (name / relay URL / token / icon / repos dir)
**Entry point:** "Community settings" in the rail's right-click context menu (`CommunityRail.tsx:281-284`) or in the `CommunitySwitcher` dropdown item's small pencil/`MoreHorizontal` button (`CommunitySwitcher.tsx:415-431`) or profile-menu popover item (`CommunitySwitcher.tsx:312-322`).
**Container:** `Dialog`, `EditCommunityDialog.tsx:124-238`.
**Fields:** Name, Relay URL, API Token (password-masked, optional), Repos Directory (optional, local filesystem path with async validation) — `EditCommunityDialog.tsx:148-226`. Icon editor (`CommunityIconSettingsCard`) is embedded conditionally, only for the active community and only if the viewer's role allows it (`EditCommunityDialog.tsx:47-52,138-147`).
**Validation:** Repos Directory is tilde-expanded and validated against the Tauri backend before save; a bad path shows an inline destructive-colored error and blocks save (`EditCommunityDialog.tsx:96-110,217-220`). Submit disabled until name and relay URL are non-empty (`EditCommunityDialog.tsx:227-232`).
**Feedback:** no toast — dialog just closes on save (`EditCommunityDialog.tsx:113-116`).

### Roles and member management
**Roles:** `owner`, `admin`, `member` (`RelayMemberRole` type used throughout `CommunityMembersSettingsCard.tsx`).
**Entry point / container:** Settings → "Community members" section → `CommunityMembersSettingsCard.tsx` (full settings panel, not a dialog), which also launches `CommunityInviteDialog.tsx` for invites.
**Visibility gating:** the members list itself is only fetched/shown for `owner`/`admin` (`useRelayMembersQuery(canManageRelay)`, `CommunityMembersSettingsCard.tsx:252-256`) — for a plain member, this whole management surface is effectively empty/unavailable rather than showing a disabled list (need to re-check the exact fallback render for non-admins; the query itself is gated off).
**Per-row role display:** crown icon for owner, shield icon for admin, plain role text otherwise (`CommunityMembersSettingsCard.tsx:150-157,162`).
**Actions menu:** `DropdownMenu` per row ("Actions for {name}"), shown only if `hasActions` is true (`CommunityMembersSettingsCard.tsx:110,178-243`):
  - "Make admin" — only if I am owner and target is member (`canPromote`, line 108).
  - "Make member" — only if I am owner and target is admin (`canDemote`, line 109).
  - "Remove from community" (destructive red text) — only if not myself, target isn't owner, and (I'm owner OR target is a plain member) (`canRemove`, lines 104-107).
**Feedback:** every mutation wraps in `mutateWithToast` — success/error toast per action (`CommunityMembersSettingsCard.tsx:113-127,196-238`). No separate "ban" action distinct from remove was found (`ConfirmRemoveDialog.tsx` exists — likely a confirmation step for removal from a channel context; not opened for the community-level remove action shown above, which removes immediately on click without a second confirm).

---

## 4. Invitations

**Entry points:** community rail context menu → "Invite to community" (owner/admin only, gated by `canInviteToActiveCommunity` — `CommunityRail.tsx:320-324,275-280`); `CommunitySwitcher` profile-menu popover → "Invite to community" (`CommunitySwitcher.tsx:297-311`, same gating passed in as `canInvite` prop); Settings → Community members → an "Invite" button opening the same dialog (`CommunityMembersSettingsCard.tsx` imports `CommunityInviteDialog`).

**Container:** `Dialog`, `CommunityInviteDialog.tsx:33-70`.

**Two invite mechanisms in one dialog:**
1. **Direct add** by pubkey/handle — `DirectAddMemberForm` embedded at the top (`CommunityInviteDialog.tsx:47-52`), full form defined in `desktop/src/features/community-members/ui/AddMemberDialog.tsx` (not fully read in this session — file exists per directory listing).
2. **Shareable invite link** — `InviteLinkSection.tsx`, below a "Or, copy a link" divider (`CommunityInviteDialog.tsx:54-67`).

**Invite-link behavior** (`InviteLinkSection.tsx`):
- A link is minted automatically the moment the section mounts (and re-minted whenever TTL/max-uses change) — no explicit "Generate" button; `generateInviteLink()` runs in a `useEffect` (`InviteLinkSection.tsx:127-133`).
- Fields: **Expires after** (1/3/7/30 days, default 3 days — `TTL_OPTIONS`, `DEFAULT_INVITE_TTL_SECS` at lines 19-36) and **Limit number of uses** (No limit / 1 / 3 / 5 / 10 / 25 — `MAX_USE_OPTIONS`, lines 26-33), both `DropdownMenu` radio groups (lines 208-282).
- The URL itself is rendered read-only, visually masked (transparent text + a fake overlay span) so it can't be selected/edited directly, only copied — lines 155-176.
- Copy button: `Button` with `data-testid="copy-invite-link"`; three visual states — generating (spinner), idle ("Copy link"), copied (checkmark + "Copied", auto-reverts after 2000ms) — lines 76-90,196-204,90-94. Failure shows `toast.error` (line 148); success shows `toast.success("Invite link copied")` (line 146).
- Regenerating on setting change reuses an in-flight request keyed by `${ttl}:${maxUses}` to avoid duplicate mints under React StrictMode replay (lines 60-65,102-107).

**Not found in code:** an explicit **revoke** action for an already-minted invite link, and a **list of pending/outstanding invites**. The dialog only ever shows "the current link for the current settings," generated on the fly; there is no separate invites-management table. (Searched `desktop/src` broadly for "revoke"/"pending invite" — no matching UI file found; only `PendingInviteGate.tsx` in onboarding, which gates onboarding on an invite already being redeemed, not a list of invites to manage.)

---

## 5. Channels

### Browse / discover
**Entry point:** "Browse channels" affordance in the sidebar (channel-section quick action) or global keyboard shortcut ⇧⌘O (`KEYBOARD_SHORTCUTS` id `browse-channels`, `desktop/src/shared/lib/keyboard-shortcuts.ts:35-41`); also from the topbar search's "browse channels" quick action (`TopbarSearch.tsx` prop `onBrowseChannels`).
**Container:** `Dialog`, `ChannelBrowserDialog.tsx:102-224+` (`data-testid="channel-browser-dialog"` region not fully quoted but title/testids confirm dialog chrome).
**Structure:** Tabs **All / Joined / Archived** (`BrowserTab` type, `ChannelBrowserDialog.tsx:66,113`), search input with deferred fuzzy match + relevance scoring (`ChannelBrowserDialog.tsx:132-186`), sort dropdown (Alphabetical / Recent / Most members — `CHANNEL_SORT_OPTIONS`, lines 58-62), keyboard-highlighted rows, and — when `onCreateChannel` is provided — an inline **"Create …"** affordance so an exact-no-match query offers to create that channel directly from the browser (Are.na-style single entry point per the file's own doc comment, lines 91-99).
**Empty/loading states:** `BrowseState` helper renders icon+title+description for e.g. "no channels" (lines 64-83); a joined-vs-archived-vs-all filter interacts with this.

### Create
**Entry point:** standalone "+" affordance in a sidebar section header, or ⇧⌘N keyboard shortcut ("new-channel", `keyboard-shortcuts.ts:51-56`), or the inline "Create …" row inside the channel browser.
**Container:** `Dialog` — either the standalone `CreateChannelDialog.tsx:49-79` or the browser dialog's `mode === "create"` view (`ChannelBrowserDialog.tsx:157-163`); both share the same field component `CreateChannelFormFields.tsx`.
**Fields** (`CreateChannelFormFields.tsx:67-227`):
  - **Name** (required) — placeholder differs by kind ("release-notes" for streams, "design-discussions" for forums).
  - **Description** (optional, textarea).
  - **Type**: ongoing vs. temporary/ephemeral, with a TTL picker if temporary — options 30 min / 1 hr / 6 hr / 12 hr / 1 / 3 / 7 (default) / 14 / 30 days (`ChannelTypeSettings.tsx:18-28`, default `DEFAULT_EPHEMERAL_TTL_SECONDS` = 7 days per line 27 vs. the ephemeral module).
  - **Visibility**: public/open vs. private (`ChannelPermissionsSettings.tsx`, referenced at `CreateChannelFormFields.tsx:141-146`; component body not fully read this session).
  - **Template** (optional) — a dropdown of saved channel templates, plus a nested "Create new channel template…" item that opens `TemplateFormDialog` (`CreateChannelFormFields.tsx:157-212`); selecting a template shows a computed summary line (visibility + canvas/agent counts, lines 51-65,222-226).
**Two kinds:** "stream" (real-time channel) vs "forum" (threaded topic) — both created through the same fields/dialog, differentiated by `channelKind` (`CreateChannelDialog.tsx:16,45-46`, `AppShell.tsx` has separate `handleCreateChannel`/`handleCreateForum` mutations, lines 531-591).
**Feedback / lands on:** on success, navigates directly into the new channel (`await goChannel(createdChannel.id)`, `AppShell.tsx:556-557`); a template's Canvas/agents are applied asynchronously after navigation (`applyCanvas`/`applyAgents`, lines 555-558, 585-587). Submit button shows "Creating..." while pending (`CreateChannelFormFooter`, `CreateChannelFormFields.tsx:245-251`).

### Join / leave
**Join:** clicking a row in the channel browser calls `onJoinChannel` directly — no confirmation (`ChannelBrowserDialog.tsx` prop `onJoinChannel`, wired at `AppShell.tsx:523-529` to `joinChannel(channelId)` then invalidates the channel list query).
**Leave:** sidebar/channel context menu → "Leave channel" (destructive red text) — `ChannelContextMenu.tsx:325-335`. **Does** show a confirmation `AlertDialog` first (unlike leaving a community): `LeaveChannelAlertDialog` / `useLeaveChannelDialog()`, `ChannelSectionDialogs.tsx:280-341` — copy: `Leave "{name}"? You'll stop receiving its messages and can rejoin later.` (line 299), destructive-styled "Leave" confirm button (lines 304-309).

### Settings (rename / topic / archive / delete / members)
**Entry point:** channel header (kebab/settings icon, per prior notes) or channel/sidebar context menu items ("Archive channel", "Delete channel" when permitted).
**Container:** responsive auxiliary panel — `ChannelManagementSheet.tsx` — rendered either as a right-side **split** pane or a full **overlay**, chosen by the `layout` prop (`"overlay" | "split"`, `ChannelManagementSheet.tsx:87-98,115-119`), reusing the shared `AuxiliaryPanel` primitive.
**Contents:** name/description (editable inline rows), channel type + TTL editor (`ChannelTypeSettings`), visibility editor (`ChannelPermissionsSettings`), archive/unarchive, delete, join/leave, member list with avatar stack, optional Canvas and Workflows sections (feature-gated) — confirmed by the hook/mutation list at `ChannelManagementSheet.tsx:16-23,122-134` (`useArchiveChannelMutation`, `useUnarchiveChannelMutation`, `useDeleteChannelMutation`, `useJoinChannelMutation`, `useLeaveChannelMutation`, `useUpdateChannelMutation`, `useChannelWorkflowsQuery`).
**Permissions:** archive/manage and delete are separately capability-gated via `useChannelModerationCapabilities()` (`canManageChannel`, `canDeleteChannel` — surfaced identically in `ChannelContextMenu.tsx:203-224,352-374` and presumably reused inside the sheet). Archive is offered to managers; delete requires the stronger `canDeleteChannel` capability and opens `ChannelDeleteConfirmationDialog` (imported at `ChannelManagementSheet.tsx:81-83`; also directly available from the context menu, `ChannelContextMenu.tsx:364-374`, gated the same way).
**Copy affordances:** "Copy channel name" / "Copy channel ID" submenu (`ChannelContextMenu.tsx:110-137`).

### Members, pin, mute, mark read, unread badges
**Members:** inline bar (`ChannelMembersBar.tsx`) and a dedicated `MembersSidebar.tsx` panel with search/add (`AddMemberSearchResultRow.tsx`), agent controls, and per-member moderation actions (`useMembersSidebarModeration.ts`) — see also §Members below.
**Pin messages:** **not found in code.** No `pinMessage`/`isPinned`/pinned-message UI was found anywhere under `desktop/src` (only channel-level "star," which is a sidebar-organization feature, not message pinning — see below). Treat "pin a message" as absent from Buzz's current interaction model.
**Mute / unmute channel:** context-menu toggle, `ChannelContextMenu.tsx:276-301` (Bell/BellOff icons, label flips "Mute channel"/"Unmute channel").
**Star / unstar channel** (sidebar organization, not "pin"): same context menu, `ChannelContextMenu.tsx:302-324`.
**Mark read / unread:** context-menu toggle that flips label+icon based on projected unread state, `ChannelContextMenu.tsx:249-276`; a global "mark all as read" also exists per-community from the rail's context menu (`CommunityRail.tsx:262-266,360-372`) and via keyboard shortcut (Escape = mark current read, Shift+Escape = mark all read, per prior-notes keyboard registry — not independently re-verified line-by-line this session beyond the shortcuts file excerpt read).
**Unread badges:** numeric mention-count badge vs. plain unread dot, computed the same way at the community level (`communityRailIndicators`, `CommunityRail.tsx:66-86`) — the equivalent per-channel indicator logic lives in `useUnreadChannels` (wired at `AppShell.tsx:362-405`), not independently re-opened this session.

---

## 6. Direct messages

**Entry point:** "New message" affordance in the sidebar (wired to `onNewMessage`/`goNewMessage`, `AppShell.tsx:846-847,663-680`) or ⇧⌘K keyboard shortcut (`keyboard-shortcuts.ts:42-49`, id `browse-dms`, despite the id name this opens "the new message composer" per its own `description` field).
**Container:** **full route**, not a dialog — `/messages/new` (`routes.ts:13`), screen `desktop/src/features/messages/ui/NewMessageScreen.tsx`.
**Steps:** the normal chat header is replaced by an inline "To:" recipient field; typing opens an attached `Popover` recipient-search list (`NewMessageScreen.tsx:15,45-71`, `useNewMessageRecipients`). Recipients are chips (`SelectedRecipientChip`) so **multiple recipients can be added before the first message is sent** — i.e. Buzz supports group DMs through the same flow, capped by a recipient limit (`hasReachedRecipientLimit`, `useNewMessageRecipients.ts:80-81`, constant `NEW_MESSAGE_RECIPIENT_LIMIT` referenced but not independently opened this session to read its exact number).
**Composer:** the same `MessageComposer` used in channels is reused here (`NewMessageScreen.tsx:18,491+` region).
**Lands on:** sending the first message opens/creates the DM channel via `useOpenDmMutation` and navigates into it with `goChannel` (pattern mirrors the sidebar's own `onOpenDm` handler at `AppShell.tsx:866-872`, which does exactly this: `openDmMutation.mutateAsync({ pubkeys }) → goChannel(directMessage.id)`).
**DM list location:** a "Direct messages" section in the sidebar, alongside Starred/Channels/Forums/custom sections (per `research/2026-08-23-buzz-ui-map.md` §1 and confirmed structurally by `AppSidebar.tsx` importing `CustomChannelSection`/`SidebarSection` and the DM-specific sort helper `dmSidebarSort` at `AppSidebar.tsx:15-16`).
**Hide a DM:** `onHideDm` handler removes it from the sidebar and, if it was the active channel, navigates home (`AppShell.tsx:614-628`) — this is Buzz's closest equivalent to "leave/close a DM."

---

## 7. Agents

Buzz agents are richer than a simple "bot member" — they are full local-or-remote AI coding agents with their own runtime/provider/model configuration, distinct from Ada's separate-runner model. Key structural difference to flag for Ada: **Buzz has no external "runner setup command"/token-display step** — agent runtime credentials (provider, API key, model, MCP servers, env vars) are configured directly inside the agent-creation dialogs in-app; a search for "setup command"/"runner setup"/"one-time" token-display patterns across `desktop/src` returned no matches. If Ada's runner model (separate CLI process, one-time setup command, token shown once) is meant to mirror something in Buzz, **it is not present in Buzz's code** — Ada's runner UX is not modeled on any equivalent Buzz screen.

**Where agents are listed:** dedicated route `/agents` (`routes.ts:6`), screen `AgentsScreen.tsx` → `AgentsView.tsx`. Sections: a unified "Managed agents" list plus "Teams" (`UnifiedAgentsSection.tsx`, `TeamsSection.tsx`, imported at `AgentsView.tsx:22`). Page header shows a bulk "Stop running agents" affordance implicitly via `runningAgentCount` (`AgentsView.tsx:90-91`) and an "Agent defaults"/"Set agent defaults" button whose label depends on whether defaults are already saved (`AgentsView.tsx:140-151,93-100`).

**Create/edit is a family of dialogs, not one form** (confirmed via imports at `AgentsView.tsx:8-21` and file listing of `desktop/src/features/agents/ui/`):
- `AgentDialog.tsx` — routes to one of three modes: `"definition"` (create a new persona/agent type), `"instance-edit"` (edit a running/managed instance), `"definition-edit"` (edit the underlying persona) — `AgentDialog.tsx:30-90`.
- `AgentDefinitionDialog.tsx` — the actual creation wizard (name, description/instructions, avatar, runtime/harness, provider/API key, model, where-to-run, env vars, MCP servers, owner-only access toggle).
- `PersonaCatalogDialog.tsx` — a searchable gallery of saved agent "personas" with create/import/export/share/duplicate/delete.
- `TeamDialog.tsx` — group multiple agents into a "team" with shared instructions.
- `AgentDefaultsDialog.tsx` — global inherited defaults (runtime/provider/model/env) applied to new agents.

**Add an agent to a channel:** entry point is presumably a channel-header/members action (not directly traced this session) that opens `AddAgentToChannelDialog.tsx`. Container: `Dialog` (`AddAgentToChannelDialog.tsx:33-142`). Fields: pick target channel (defaults to the first non-DM, non-archived channel — lines 68-72) and pick a channel role (`bot` by default, excluding `"owner"` from the selectable set — line 39). Feedback: `isAlreadyMember` check disables re-adding an agent already in that channel (lines 80-88); has an `attachAgentMutation` with its own pending/error state.

**Agent status/presence:** `AgentStatusBadge.tsx` — badge label/variant driven by `status` (`running`/`deployed`/etc.), a live `isWorking` pulse-animated state, and a 15-second "Starting…" grace window before flagging a `running`-but-no-presence agent as stuck (`AgentStatusBadge.tsx:8,26-46`).

**DM an agent / agent memory / instructions:** exposed through the shared `UserProfilePanel` (agent profiles reuse the same profile-panel component as human members — confirmed by `AgentsView.tsx:26` importing `useProfilePanel` and calling `openPersonaProfilePanel`/`openProfilePanel`), which per the prior research notes (`2026-08-23-buzz-ui-map.md` §4) includes tabs for instructions, configuration, diagnostics, and memory. Not independently re-opened line-by-line this session.

---

## 8. Threads

**Entry point:** click a message's reply-count / "N replies" affordance, or the reply hover-action on any message (see §9).
**Container — two modes, user-togglable:** a right **split pane** (`MessageThreadPanel.tsx`, laid out via `ThreadPanelLayoutProps`/`AuxiliaryPanel`) or a **focus drawer** overlaying the channel (`FocusThreadDrawer.tsx`). The toggle between them is `ThreadViewModeToggle.tsx` (file exists at `desktop/src/features/channels/ui/ThreadViewModeToggle.tsx`, wired from `ChannelPane.tsx`; not opened line-by-line this session beyond confirming its existence and grep hits).
**Drawer behavior:** right-anchored overlay with its own scrim, deliberately outlasting the drawer's exit animation "so the channel dimmed [state] leaves nothing on top of it" (design-intent code comment, `FocusThreadDrawer.tsx:59-61`); dismissible by **Escape** (capture-phase `keydown` listener, `FocusThreadDrawer.tsx:150-159`) or by clicking the scrim; autofocuses the drawer on open (`:168`).
**Panel contents:** thread head, reply list grouped by author/time window (`hasSameMessageAuthor`, `isWithinGroupingWindow` imports at `MessageThreadPanel.tsx:11-13`), its own composer instance (`MessageComposer` reused, line 47 import), typing indicator row, unread divider, and follow/unfollow controls (`isFollowingThread`/`onFollowThread`/`onUnfollowThread` props, lines 117-119).
**Close:** `onClose` prop (Escape-bound per the drawer variant above; the split-pane variant likely closes via an explicit close button — not independently confirmed this session).
**Responsive:** whether the thread renders as a drawer-overlay vs. a split pane also depends on `useIsThreadPanelOverlay()`/the auxiliary-panel breakpoint (`use-mobile.tsx:92-95`), i.e. narrow viewports force the drawer/overlay mode regardless of the user's toggle preference (inferred from the shared breakpoint hook; not independently confirmed against `ThreadViewModeToggle.tsx`'s own logic this session).

---

## 9. Messages

**Send:** composer at the bottom of the channel (`MessageComposer.tsx`) or thread panel — Enter sends, and mention-autocomplete has its own key handling that takes priority (`handleMentionKeyDown` intercepts before the editor's own send/newline handling, `MessageComposer.tsx:676-681,708-713`; the composer's `onKeyDown={handleEditorKeyDown}` is bound at line 970).
**Edit:** hover/more-actions menu → "Edit message" (`MessageActionBar.tsx:143-153`) — a ref (`editJustSelectedRef`) is set so the dropdown's auto-focus-return doesn't steal focus back from the composer's editor (comment at lines 91-99, used at 137-141,147).
**Delete:** hover/more-actions menu → "Delete message" (`MessageActionBar.tsx:277-286`, guarded by `onDelete` prop) — **does** show a confirmation dialog first: `DeleteMessageConfirmDialog`, opened via local `isDeleteDialogOpen` state rather than deleting immediately (lines 89,299-304).
**Reactions:** a small "quick reaction" row of up to 4 recent/frequent emoji directly in the hover toolbar (`QuickReactionButton`, `useQuickReactionEmojis(4, ...)`, `MessageActionBar.tsx:319-419`), plus a fuller reaction picker (`isReactionPickerOpen` state, line 405) for anything else. Selecting a reaction that doesn't already exist is distinguished from removing one (`wouldAddReaction`, line 435).
**Mentions:** `@user` and `@agent` autocomplete inside the composer (`useMentions.ts`, `mentionHighlightExtension.ts`, `MessageComposer.tsx` mention handling cited above). **A broadcast `@channel`/`@everyone`-style mention was not found** — grep for "@channel"/"everyoneMention" across `features/messages` returned no matches; mentions in Buzz appear to be exclusively targeted at individual users/agents.
**Attachments/uploads:** `ComposerAttachments.tsx`, `ComposerImageEditor.tsx` (per file listing and prior notes), with drag/drop and paste support (`useMediaUpload.ts`) and upload-progress overlay (`ComposerUploadProgressOverlay.tsx`, per prior notes — not re-opened this session).
**Link previews / code blocks / markdown:** rendered via the shared markdown pipeline (`imetaMediaMarkdown.ts`, `MESSAGE_MARKDOWN_CLASS` imported at `TopbarSearch.tsx:26-27` for search-result previews too) — dedicated files exist per the directory listing (`FormattingToolbar.tsx`, `SelectionFormattingTray.tsx` per prior notes).
**Hover toolbar / context menu:** `MessageActionBar.tsx` is the hover toolbar; its "More actions" `DropdownMenu` (`EllipsisVertical` trigger, lines 113-131) is the message-level context/overflow menu, containing: Edit, Mark read/unread toggle (lines 156-173), Follow/unfollow thread (line 176+, not fully re-quoted), Copy actions, Report (gated by `canReport`, requires a delivered non-pending, non-system message with a known author — lines 102-110), and Delete (lines 277-286).
**Mark read/unread (message-level):** same "More actions" menu, icon+label flip between `MailCheck`/"Mark read" and `MailOpen`/"Mark unread" depending on `isUnread` (lines 156-173).

---

## 10. Members

**List location:** `ChannelMembersBar.tsx` (compact inline bar, likely in the channel header) and `MembersSidebar.tsx` (fuller right-side panel with add-member search, agent controls, and moderation actions) — both under `desktop/src/features/channels/ui/`.
**Profile popover:** hovering/clicking a member's avatar or name opens `UserProfilePopover.tsx` — a `Popover` (not a full page) anchored to the trigger, with a configurable hover-open delay (`DEFAULT_POPOVER_HOVER_OPEN_DELAY_MS`, import at `UserProfilePopover.tsx:33`) and a close delay (`HOVER_CLOSE_DELAY_MS = 200`, line 59). Shows avatar-with-status, display name, presence, user-status emoji/text, and (for agents) model label and elapsed-working time (`resolveModelLabel`, `formatElapsed` imports, lines 20,41).
**Full profile page/panel:** clicking further (or a dedicated "view profile" action) opens the larger `UserProfilePanel` (referenced via `useProfilePanel()`/`openProfilePanel` throughout — e.g. `AgentsView.tsx:26,44`, `CommunityMembersSettingsCard.tsx` avatar trigger at lines 136-144); per prior notes this panel has tabs for summary, channels, agent info/instructions/config/diagnostics/memory.
**Presence indicators:** `ProfileAvatarWithStatus` component (imported at `UserProfilePopover.tsx:25`) renders presence directly on the avatar; presence data comes from `usePresenceQuery`.

---

## 11. Search / command palette

**Entry point:** ⌘K global keyboard shortcut (`keyboard-shortcuts.ts:24-33`, id `quick-search`) or a topbar search affordance (icon or bar variant, `TopbarSearchProps.variant: "bar" | "icon"`, `TopbarSearch.tsx:36`).
**Container:** `Dialog` (`TopbarSearch.tsx:22`, `Dialog`/`DialogContent`/`DialogTitle` imports), i.e. a command-palette-style modal, not a dropdown.
**Result sections, in fixed order** (`SEARCH_RESULT_SECTION_ORDER`, `TopbarSearch.tsx:53-60`): `channels`, `direct-messages`, `people`, `agents`, `messages`, `actions`.
**Quick actions surfaced inline:** "browse channels," "create agent," "create channel" (props `onBrowseChannels`, `onCreateAgent`, `onCreateChannel`, lines 41-44) — i.e. the palette doubles as a launcher for other creation flows, not just a jump-to search.
**Scoped search:** a separate "current channel" search action/shortcut exists (`CurrentChannelSearchAction`, `getChannelScopeLabel`, imports at lines 14-16; also ⌘F "Find in channel" in the shortcut registry, `keyboard-shortcuts.ts:82-88`).
**Result rendering:** relative-time formatting for message hits ("just now"/"Xm ago"/"Xh ago", `TopbarSearch.tsx:87-100`), truncated message snippets (`truncateResultText`, max 96 chars, lines 84-90).

---

## 12. User settings / profile

**Container:** full route `/settings` (`routes.ts:7`), rendered by replacing the main content area (sidebar hidden, top chrome hidden) rather than as a dialog — `AppShell.tsx:171-172,778-816`. Section selection is a `search` param on the route (`settingsSection`, `AppShell.tsx:174-179`) so each section is deep-linkable and back/forward-navigable, but switching sections **rewrites** the current history entry rather than pushing a new one (`AppShell.tsx:641-648`).
**Sections** (icon imports at `SettingsPanels.tsx:6-25` and component imports at lines 26-80): Appearance, Profile, Notifications, Agents, Channel templates, Compute (mesh), Keyboard shortcuts, Hosted communities, Community members/Invites, Moderation, Custom emoji, Local archive, Mobile (pairing), Experiments, Updates. (Voice/Huddle settings mentioned in the prior research note were not independently re-confirmed in this pass but are plausible given `MeshComputeSettingsCard` and other imports.)
**Sub-components confirmed present this session:** `NotificationSettingsCard`, `KeyboardShortcutsCard`, `AgentsSettingsPanel`, `HostedCommunitiesSettingsCard`, `ProfileSettingsCard`, `ChannelTemplatesSettingsCard`, `ModerationQueueCard`, `LocalArchiveSettingsCard`, `MobilePairingCard`, `CustomEmojiSettingsCard`, `ExperimentalFeaturesCard`, `CommunityMembersSettingsCard` (`SettingsPanels.tsx:31,32,67-79`).
**Sign-out lives here too** (§2) — `SignOutSection.tsx`, presumably rendered inside Profile or a dedicated account section (not independently confirmed which section mounts it this session, but it is a `SettingsOptionGroup`-shaped card matching the others).

---

## 13. Notifications / inbox / mentions view

**Home/"inbox" screen:** the `/` route (`routes.ts:5`) — `HomeScreen.tsx` → `HomeView.tsx`. It aggregates a `homeFeedQuery` (server-provided activity feed) with locally-tracked thread-activity items (`threadActivityFeedItems` from `useAppShell()`), merged client-side (`HomeScreen.tsx:30-46`). This is Buzz's closest equivalent to an "inbox"/mentions view — there is no separate `/inbox` or `/mentions` route; it's folded into Home.
**Home badge:** a numeric badge on the sidebar's Home entry, computed by `useHomeFeedNotificationState` from feed data, read-state, mute state, and thread activity (`AppShell.tsx:447-467`), plus due-reminder count added on top (`AppShell.tsx:468-471,828`).
**Desktop notifications:** native OS notifications for channel messages, DMs, and thread replies, dispatched via `useAppShellDesktopNotifications` (`AppShell.tsx:346-360`) — Tauri/desktop-native, no web equivalent; settings for this live in the Settings → Notifications section (`NotificationSettingsCard`, sound picker, desktop-notification permission state surfaced in props passed to `LazySettingsScreen`, `AppShell.tsx:781-812`).
**Mark all read:** available both per-community (rail context menu, §3) and globally (`markAllChannelsRead`, exposed through `AppShellContext`, `AppShell.tsx:704-707`; consumed by the Escape/Shift+Escape shortcuts per the keyboard registry).

---

## 14. Keyboard shortcuts

**Source of truth:** `desktop/src/shared/lib/keyboard-shortcuts.ts` — a typed array `KEYBOARD_SHORTCUTS` with `id`, `label`, `description`, `keys` (Mac glyphs), `keysWindows`, and `category` (`"Navigation" | "Messages" | "Formatting" | "Zoom"`, lines 8-13,25).
**Confirmed entries (Navigation category, lines 25-100+):**
| Shortcut | Mac | Windows | Does |
|---|---|---|---|
| quick-search | ⌘K | Ctrl+K | Open search dialog |
| browse-channels | ⇧⌘O | Shift+Ctrl+O | Open channel browser |
| browse-dms | ⇧⌘K | Shift+Ctrl+K | Open new-message composer |
| new-channel | ⇧⌘N | Shift+Ctrl+N | Open create-channel dialog |
| open-settings | ⌘, | Ctrl+, | Toggle settings |
| go-back | ⌘[ | Alt+← | Previous page |
| go-forward | ⌘] | Alt+→ | Next page |
| find-in-channel | ⌘F | Ctrl+F | Search current channel |
| go-home | ⇧⌘A | Shift+Ctrl+A | Home feed |
| toggle-sidebar | (truncated in this read — presumably ⌘S) | — | Toggle sidebar |

Presented to the user in Settings → Keyboard shortcuts (`KeyboardShortcutsCard.tsx`, per `SettingsPanels.tsx:68`). The remaining Messages/Formatting/Zoom categories (Enter/Shift+Enter, Cmd+B/I/etc., Cmd+/-/0) were not re-opened line-by-line this session but are corroborated by direct composer-code evidence in §9 (mention-key interception) and by the prior research note.

---

## 15. Responsive / mobile variation (web-client-relevant only)

- Sidebar becomes a slide-over `Sheet` below **768px** (`use-mobile.tsx:5`, `useIsMobile()` consumed at `AppSidebar.tsx:141-142`).
- Thread/auxiliary panels (thread panel, channel management sheet, profile panel) switch from a split pane to a full overlay below a separate `AUXILIARY_PANEL_SINGLE_COLUMN_BREAKPOINT_PX` breakpoint (`use-mobile.tsx:3,88-95`) — i.e. **two independent breakpoints**, not one, govern "is this compact" for sidebar vs. auxiliary content.
- `ChannelManagementSheet` explicitly supports both `layout: "overlay" | "split"` as a prop (`ChannelManagementSheet.tsx:87-98`), and `FocusThreadDrawer` is an always-overlay pattern used specifically at the narrow/focus end of that spectrum.
- Everything under `web/src` (the actual web SPA) has its own, much simpler, independent responsive treatment — e.g. `ReposPage.tsx` hides the org sidebar below `lg:` and shows an inline "Connect" button on mobile instead (`web/src/features/repos/ui/ReposPage.tsx:152-155,193-196`). This is unrelated to the desktop chat responsive system above.

---

## Pattern table

| Use case | Entry point | Container | Lands on after success | Confirm? | Who |
|---|---|---|---|---|---|
| Sign in / create identity | First-run only (no login screen after) | Full-screen onboarding flow (`MachineOnboardingFlow`) | Community-join step, then app shell | No | Anyone (device-local) |
| Restore account (import key) | Onboarding "key-import" page, or forced on identity-lost | Full-screen onboarding step (`NostrKeyImportForm`) | Continues onboarding with recovered identity | No | Anyone |
| Sign out | Settings → Sign out card | `AlertDialog`, two-gate (backup checkbox + typed phrase) | Wipes local data, relaunches to onboarding | Yes (two gates) | Anyone (own account only) |
| Create community | Rail "+" or switcher "Add a community" | `Dialog` → hands off to hosted "Builderlab" web flow | New community added, switched to it | No | Anyone |
| Join community | Same dialog, "join" mode | `Dialog` (`InviteRedeemForm`) | Community added; membership/join-policy accept in background | Policy checkboxes only, no confirm dialog | Anyone with a link/code |
| Switch community | Rail icon click / switcher dropdown item | Plain button list / `DropdownMenu` | Community's last-visited channel or Home | No | Any member |
| Leave community | Switcher profile-menu popover item | Inline in popover (no separate dialog) | Popover closes; community removed from device | **No** | Any member (not owner-gated in UI) |
| Community settings | Rail context menu / switcher item | `Dialog` (`EditCommunityDialog`) | Dialog closes, no toast | No | Icon edit gated to owner/admin; other fields not visibly role-gated |
| Invite to community | Rail/switcher menu; Settings members | `Dialog` (`CommunityInviteDialog`) — direct-add form + auto-minted link | Dialog stays open; copy/added feedback via toast | No (link mint), n/a (direct add not traced) | Owner/admin only (`canInviteToActiveCommunity`) |
| Manage member roles / remove | Settings → Community members row menu | `DropdownMenu` per row | Toast, list updates | **No** (removal has no second confirm) | Owner (promote/demote); owner or admin (remove, not on owners/self) |
| Browse channels | Sidebar quick action / ⇧⌘O / search palette | `Dialog` (`ChannelBrowserDialog`), tabs All/Joined/Archived | Selecting a channel navigates into it | No | Any member |
| Create channel | Sidebar "+" / ⇧⌘N / inline in browser | `Dialog` (`CreateChannelDialog` or browser's create mode) | Navigates into the new channel | No | Any member (no owner-gate found on creation itself) |
| Join channel | Row click in channel browser | n/a (direct action in dialog) | Row updates to joined state | No | Any member |
| Leave channel | Sidebar/context menu "Leave channel" | `AlertDialog` | Returns to Home if it was active | **Yes** | Any member |
| Archive / delete channel | Context menu or Channel Management sheet | Context-menu item / `ChannelDeleteConfirmationDialog` | Sheet closes; if active channel, navigates Home | Delete: yes; Archive: not confirmed | Manage-capable (archive) / delete-capable (delete), both capability-checked |
| Channel settings (rename/topic/type/visibility) | Channel header / context menu | Responsive auxiliary panel (`ChannelManagementSheet`), split or overlay | Stays open; inline save | No | Manage-capable members |
| Start a DM | Sidebar "New message" / ⇧⌘K | Full route `/messages/new` (not a dialog) | Navigates into the created DM channel on first send | No | Any member |
| Add agent to a channel | (agent action, entry not traced) | `Dialog` (`AddAgentToChannelDialog`) | Dialog stays open with pending/error state | No | Not independently confirmed |
| Create/edit agent | `/agents` page buttons | Family of `Dialog`s (`AgentDialog` routing to definition/instance/definition-edit modes) | Agent appears in `/agents` list | No | Not independently confirmed (owner-only "access" toggle exists per prior notes) |
| Open a thread | Reply-count / reply hover action | Split pane or `FocusThreadDrawer` overlay (user-toggle + responsive) | Thread panel open alongside/over channel | No | Any member |
| Close a thread | Escape / backdrop click / close control | n/a | Returns to plain channel view | No | Any member |
| Edit a message | Hover toolbar → "More actions" → Edit | Inline composer edit mode | Composer shows edit banner; save updates message | No | Message author (assumed; not independently re-verified this session) |
| Delete a message | Hover toolbar → "More actions" → Delete | `DeleteMessageConfirmDialog` | Message removed/tombstoned | **Yes** | Message author / moderators (assumed) |
| React to a message | Hover toolbar quick-reaction row or picker | Inline buttons / reaction picker popover | Reaction badge updates immediately (optimistic) | No | Any member |
| Global search | ⌘K / topbar search | `Dialog` command palette | Navigates to the selected channel/message/user or launches a quick action | No | Any member |
| User settings | Settings route sections | Full route `/settings` (not a dialog) | Stays on settings; section switch rewrites history | No (except Sign out) | Self only for profile; role-gated sections for community/moderation |
| Keyboard shortcuts reference | Settings → Keyboard shortcuts | Full settings section (`KeyboardShortcutsCard`) | n/a (reference view) | No | Anyone |

---

## Open uncertainties / not fully traced this session

- Exact fallback UI for a plain `member` opening the Settings → Community members section (query is gated off entirely for non-admins; whether the section hides itself or shows an empty/locked state was not confirmed).
- `AddMemberDialog.tsx` / `DirectAddMemberForm` fields and validation (referenced, not opened).
- `ChannelPermissionsSettings.tsx` and `ChannelTypePicker.tsx` internals (visibility toggle UI itself; only its call sites were confirmed).
- Whether "edit message" is restricted to the author only, or also available to channel moderators (assumed author-only by convention, not confirmed in code this session).
- The exact numeric `NEW_MESSAGE_RECIPIENT_LIMIT` value for group DMs.
- `ThreadViewModeToggle.tsx` internal logic (confirmed to exist and be wired from `ChannelPane.tsx`; not opened).
- Whether channel creation itself is role-gated (no gate found in the traced code, but the full permission check for "who can create a channel" was not exhaustively searched).
- Full list of Messages/Formatting/Zoom keyboard shortcuts (only the Navigation category was read past line 100 of `keyboard-shortcuts.ts`; Enter/Shift+Enter and formatting combos are corroborated only via the prior research note and composer code, not the registry file directly).


---

# Part B — Ada inventory (delegated report, verified where noted above)


## Part 0 — What is actually mounted

- `apps/web/src/App.tsx:1-44` mounts `HostedApp` (from `hosted.tsx`) for every
  URL except the developer-only `#figures` hash. There is **no router**: the
  only hash-based branch in the whole mounted app is `#figures` vs everything
  else (`App.tsx:41-43`).
- `hosted.tsx:1-87` imports only `components/ui/*` (shadcn/Base UI primitives),
  `lib/hosted-api.ts`, `lib/auth.ts`, `@ada/protocol`, and `lucide-react`
  icons. **It does not import anything from `apps/web/src/components/workspace/*`**
  (confirmed by grep: zero references anywhere in the repo to
  `workspace/shell`, `workspace/sidebar`, `workspace/channel`,
  `workspace/pages`, `workspace/channel-dialog`, `workspace/agent-dialog`,
  `workspace/command-palette`, `workspace/destructive-confirmation`). All
  ~2,650 lines of `apps/web/src/components/workspace/*.tsx` are **unmounted
  legacy** — a different, presumably older UI generation, not the current
  Buzz-shaped shell. All of Part 1 below is drawn from `hosted.tsx` alone
  (2,780 lines), which is the single file implementing the entire mounted
  product surface.
- `apps/web/AGENTS.md` (repo rule, confirmed by reading) independently states
  the same: "Dedicated Modules, My study, Inbox, standalone Agents/Settings
  and Card File pages are not mounted," and workspace/* is not named as part
  of the mounted surface either.
- `components/ada/*` (the older card-file UI) is likewise unmounted; not
  explored further per the task's stop condition.

## Part 1 — Current UI use-case inventory

### App shell layout

- **Structure**: three-pane desktop layout — a 56px community icon rail
  (`CommunityRail`), a 256px fixed sidebar (channel/member list + composer
  footer), and the main channel column, with an optional 320px thread column
  on wide screens. `hosted.tsx:843-925` (rail + sidebar), `hosted.tsx:927-956`
  (main column).
- **No thread column by default** — it only appears when a thread is open
  (`hosted.tsx:1980-1992`), and only on screens ≥1024px
  (`threadOverlayQuery = "(max-width: 1023px)"`, `hosted.tsx:126-133`); below
  that it's a `Sheet` overlay instead (`hosted.tsx:1993-2016`).
- **Selection is pure component state, not URL**: `activeId`
  (`hosted.tsx:445-456`) is the only piece of navigation state persisted
  outside React — to `localStorage["ada:community"]` (`hosted.tsx:487-490`,
  read back at `hosted.tsx:446-454`). Channel selection (`selected`,
  `hosted.tsx:754`) and thread selection (`threadId`, `hosted.tsx:1708`) are
  plain `useState`, reset on remount, **never reflected in the URL/hash**.
  Switching community, channel, DM, or opening a thread leaves no
  back-button/bookmark/reload-safe trail except which *community* was last
  open.
- **Reload behavior**: reloading the page restores the last community (via
  localStorage) but always lands on the first active/joined channel
  (`hosted.tsx:817-822`), never the channel or thread you were last viewing.

### Account: create / onboarding / restore / sign out

- **Create account** (`AccountGate`, `hosted.tsx:296-361`): entry point is
  the unauthenticated startup screen shown whenever no stored token exists
  (`Phase === "account"`, `hosted.tsx:196-206`). Container: full-screen
  centered card (`Startup`, `hosted.tsx:274-293`) — not a dialog/sheet, a
  distinct top-level screen, no URL. Field: display name only (required,
  trimmed; empty → inline error `hosted.tsx:308-311`). Submit → `POST
  /api/users` (`createUser`, `hosted-api.ts:112-116`) → stores token in
  localStorage (`storeToken`, `hosted.tsx:175-176`) → **lands on** the
  one-time credential screen (`Phase = "credential"`).
- **One-time token display** (`CredentialStep`, `hosted.tsx:238-272`):
  full-screen card showing the raw bearer token in a `<code>` block, a "Copy
  token" button (toggles to "Copied", `hosted.tsx:246-249, 259-264`), and "I
  saved it" to continue. No countdown/expiry; nothing prevents skipping
  without copying. Matches protocol comment that the raw token is returned
  only once (`packages/protocol/src/hosted.ts:104-107`).
- **Restore with token** (`SignInGate`, `hosted.tsx:364-433`): entry point is
  "Restore with a user token" ghost button on the account gate
  (`hosted.tsx:356-358`). Container: separate full-screen phase
  (`Phase === "sign-in"`), not a modal. Field: token (type="password",
  min-length 20 client check, `hosted.tsx:376-379`). Submit → `GET
  /api/session` with the pasted bearer (`restoreSession`,
  `hosted-api.ts:106-110`) → lands directly in the workspace (skips the
  credential screen, since the token isn't newly minted).
- **Automatic session restore on load**: `HostedApp`'s `load()` effect
  (`hosted.tsx:140-172`) reads `localStorage` token and calls
  `restoreSession`; on failure it clears the token and shows an error on the
  account gate (`hosted.tsx:156-166`) — 5xx shows the raw server message,
  anything else shows a generic "session no longer valid" message.
- **Sign out**: three separate trigger locations, all calling the same
  `onSignOut` (clears token, resets phase to `account`, no confirmation
  dialog): desktop sidebar footer icon button (`hosted.tsx:917-923`),
  community rail bottom icon (`hosted.tsx:1244-1251`), and the "Sign out"
  ghost button inside the `Onboarding` screen (`hosted.tsx:658-661`).
- **Profile / display-name edit**: **no UI** anywhere in `hosted.tsx`. There
  is also **no hosted server route** for it — `PATCH /api/members/:memberId`
  (`apps/server/src/api.ts:951-960`) exists but is part of the legacy
  single-community API (`workspaceActor`/`profileUpdateInputSchema`), not the
  `/api/communities/:communityId/...` hosted surface. A hosted user's
  `displayName` is fixed at creation with no way to change it from the UI or
  even a matching hosted endpoint.

### Community: create / switch / join / leave / settings / delete

- **Create**: entry point is the "Create community" tab of the `Onboarding`
  screen (`hosted.tsx:667-691`), reached automatically when a user has zero
  communities (`hosted.tsx:566-587`) or via the rail's "+" button
  (`onAddCommunity`, `hosted.tsx:1234-1242`) or "Add another" flow
  (`onCancel` present once ≥1 community exists, `hosted.tsx:653-657`).
  Container: full-screen card with a 2-tab toggle (`create`/`join`), not a
  dialog. Fields: name + term/cohort (both required text; no validation
  beyond non-empty on the client — server enforces 1–120 chars,
  `packages/protocol/src/hosted.ts:121-124`). Submit → `POST /api/communities`
  → refreshes the community list → **activates** the new community and exits
  onboarding (`hosted.tsx:509-523`).
- **Join via invite code**: same `Onboarding` screen, "Join with code" tab
  (`hosted.tsx:693-700`). Single field: paste code. Submit → `POST
  /api/invites/redeem` (`redeemInvite`) → activates the joined community
  (`hosted.tsx:524-533`). Redeeming an already-active membership's code is
  idempotent server-side and returns `consumed: false`
  (`apps/server/src/tenant.ts:396-400`) — the UI does not surface this
  distinction to the user (no "already a member" message; it just succeeds
  silently).
- **Switch**: entry point is any icon in the `CommunityRail`
  (`hosted.tsx:1220-1233`) — `aria-current="page"` marks the active one, no
  URL change, snapshot refetched (`hosted.tsx:598-602`).
- **Leave**: entry point is "Leave community" at the bottom of the Members
  panel (`MemberSidebar`, `hosted.tsx:1649-1679`). Container: inline
  `ConfirmAction` (an `AlertDialog`) — **has a confirm step**
  ("Leave this community? You will need a new invite to return.").
  On success: `DELETE /api/communities/:communityId/membership`
  → **lands on**: the next remaining community, or back into `Onboarding` if
  none remain (`hosted.tsx:536-549`). Last-teacher-cannot-leave is enforced
  server-side (`apps/server/src/tenant.ts:441-446`) but the UI has no
  pre-emptive hint — the error only appears reactively via the `onNotice`
  toast if the call fails.
- **Settings (name/description)**: `PATCH /api/communities/:communityId`
  (teacher-only, `apps/server/src/api.ts:572-585`) exists server-side but
  **no UI trigger exists anywhere** in `hosted.tsx`; `hosted-api.ts` doesn't
  even export a client wrapper for it. Community `term` and `name` are set
  once at creation and are then unchangeable from the product.
- **Delete community**: **no UI, and no server route** — there is no
  `DELETE /api/communities/:communityId` at all in `apps/server/src/api.ts`
  or `apps/server/src/tenant.ts`.

### Invitations

- **Create**: entry point is the roster's "Create invite" icon button
  (`UserPlus`, teacher-only, `hosted.tsx:1606-1616`), opening `InviteSheet`
  (`hosted.tsx:2635-2734`). Container: right-side `Sheet`. Fields: role
  (`student`/`teacher` `Select`) and use mode (`single-use`/`reusable`
  `Select`) — **no `maxUses` or `expiresAt` field** even though the protocol
  input schema supports both (`packages/protocol/src/hosted.ts:150-158`).
  Submit → `POST /api/communities/:communityId/invites` → shows the raw code
  in a `<code>` block with a "Copy code" button (toast "Invite code copied.",
  `hosted.tsx:2710-2729`).
- **Display / copy**: only ever shown once, immediately after creation, in
  the same sheet — no way to re-view a previously generated code.
- **Revoke**: **no UI**, and no server route either (`tenant.ts` has no
  invite-revoke function; `inviteMetadataSchema.revokedAt` exists in the
  protocol as an optional field but nothing ever sets it,
  `packages/protocol/src/hosted.ts:143-148`).
- **List existing invites**: **no UI**; no `GET
  /api/communities/:communityId/invites` route exists at all.

### Members

- **List**: `MemberSidebar` roster (`hosted.tsx:1567-1682`), shown by
  toggling the sidebar's "Members" tab (`hosted.tsx:876-881`). Shows avatar
  initials, name, `role · presence` (`hosted.tsx:1620-1628`).
- **Remove**: teacher-only trash icon per row, hidden for self
  (`hosted.tsx:1629-1646`). **Has a confirm step** (`ConfirmAction`
  AlertDialog, "Remove member?"). On success: `DELETE
  /api/communities/:communityId/members/:userId`, toast "Member removed."
  Last-teacher invariant is enforced server-side
  (`apps/server/src/tenant.ts:424-429`).
- **Promote / demote (change role)**: **no UI** and no server route — a
  membership's role is fixed at invite-redemption time; there is no `PATCH`
  on a membership in `apps/server/src/api.ts`.
- **Member detail**: **no UI** — the member row has no `onClick`; nothing
  opens a profile/detail view for another member.
- **Presence indicator**: shown inline as text (`role · presence`,
  `hosted.tsx:1624-1627`), not as a colored dot like agents get; no
  documented use of the underlying `"away"` value versus the mapped
  `"offline"` shown by the server (`hostedCommunityMember`,
  `apps/server/src/api.ts:335-346`, always folds `away`→`offline` for
  display).

### Channels

- **List**: `ChannelSidebar` (`hosted.tsx:1256-1492`) splits joined items
  into "Channels" and "Private messages" sections
  (`hosted.tsx:1284-1298, 1387-1388`); each row is a plain `<button>`
  (`hosted.tsx:1366-1376`), highlighted when selected.
- **Create**: teacher-only "+" next to "Channels" (`hosted.tsx:1352-1361`)
  *and* the standalone "Browse" toggle button both flip the same `browse`
  boolean (`hosted.tsx:1347-1351, 1357-1360`) — clicking either opens one
  combined panel that has both the public-channel browse/join list *and* (for
  teachers) the create-channel input at the bottom (`hosted.tsx:1453-1489`).
  This is a slightly confusing double-entry-point-into-one-panel pattern.
  Field: name only (`newName`); channel is always created as
  `kind: "channel", visibility: "public"` (`hosted.tsx:1305-1314`) — **no
  description field, no private-visibility option** in the create UI even
  though `createCommunityChannelInputSchema` accepts both
  (`packages/protocol/src/hosted.ts:220-225`). Submit selects the new channel
  and refreshes (`hosted.tsx:1315-1317`).
- **Rename**: teacher-only pencil icon in the channel header
  (`hosted.tsx:1873-1880`) turns the title into an inline `Input` + "Save"
  button (`hosted.tsx:1843-1857`) — inline edit-in-place, no dialog.
- **Archive**: teacher-only trash icon in the channel header
  (`hosted.tsx:1882-1896`). **Has a confirm step** ("Archive this channel?
  The channel will become read-only and leave the active channel list.").
  `PATCH` sets `status: "archived"`. Archived channels reject new messages
  both client-side (composer disabled, `hosted.tsx:1966-1971`) and
  server-side (`apps/server/src/tenant.ts:471-476`).
- **Delete (hard)**: **no UI**, and hosted `tenant.ts` has no hard-delete
  channel function (only archive). A different, legacy
  `deleteEmptyChannel`/`DELETE /api/channels/:channelId`
  (`apps/server/src/api.ts:1051-1064`) exists but belongs to the old
  single-community API, not the hosted one.
- **Join** (public channels only): "Join" button per row in the Browse panel
  (`hosted.tsx:1461-1468`), `POST .../channels/:channelId/join`, then selects
  it. **Private channels have no join UI at all** — a student can't discover
  or request access to a private channel; membership is teacher-managed only
  via `updateChannel`'s `memberIds`/`agentIds`, which itself has **no UI**
  (only `updateTenantChannel` accepts `memberIds`/`agentIds`,
  `apps/server/src/tenant.ts:548-575`; `hosted-api.ts`'s `updateChannel`
  wrapper takes a raw `Record<string, unknown>` but `hosted.tsx` only ever
  passes `{ name }` or `{ status }`).
- **Leave**: non-teacher members of a joined channel see a "Leave" ghost
  button in place of rename/archive (`hosted.tsx:1897-1911`). **Has a
  confirm step** ("Leave this channel? You can browse and join this public
  channel again later.").
- **Membership management (add/remove specific members from a channel)**:
  **no UI** (see join/private-channel note above).
- **Unread indicators**: **no UI** — the hosted `communityChannelSchema` has
  no `unread` field at all (unlike the legacy `Channel` type, which does),
  and nothing in `hosted.tsx` tracks or renders unread state.

### DMs (user–agent private conversations)

- **Start**: two entry points, both in the Agents section of the channel
  sidebar — clicking the message-square icon next to any agent
  (`AgentRow`'s `onDm`, `hosted.tsx:1520-1528`), or clicking the agent's row
  itself **if the viewer is not a teacher** (`hosted.tsx:1424-1444`; for a
  teacher, clicking the row opens the agent-edit sheet instead,
  `hosted.tsx:1426-1429` — so a teacher's only way to open a DM with their
  own agent is the small message icon). `POST
  /api/communities/:communityId/dms {agentId}`; creating an existing DM is
  idempotent (unique per user+agent, `apps/server/src/tenant.ts:598-602`).
- **List**: DMs appear in the sidebar's "Private messages" section
  (`hosted.tsx:1290-1298`) alongside regular channels, with no distinct
  visual treatment (both use the `#` hash icon,
  `hosted.tsx:1372-1376`) beyond the section header.
- **Teacher visibility**: a teacher's "Private messages" list includes
  *every* student's DM with any agent in the community, not just their own —
  `channel.memberIds.includes(user.id) || snapshot.membership.role ===
  "teacher"` (`hosted.tsx:1293-1296`); confirmed server-side in
  `canReadRow` (`apps/server/src/tenant.ts:456-462`, a teacher can read any
  `dm`-kind channel in their community). This is a moderation/oversight
  capability with no dedicated "teacher inbox" UI — it's simply merged into
  the same sidebar list.

### Agents

- **List**: sidebar "Agents" section (`hosted.tsx:1389-1451`), each row shows
  avatar, name, and an online/offline presence dot (fill color only
  distinguishes `"online"` from everything else — `"thinking"` and
  `"publishing"` render identically to `"offline"`, `hosted.tsx:1512-1518`).
- **Create**: teacher-only "+" (`hosted.tsx:1394-1401`) opens `AgentSheet`
  (`hosted.tsx:2355-2632`) in `"new"` mode. Container: right `Sheet`. Fields:
  name, avatar URL (optional text input, no upload/picker), instructions
  (`Textarea`, 6 rows), runtime (`claude`/`codex` `Select`), model (free-text
  input, default `"default"`), and channel membership (a `Checkbox` list of
  every channel in the community, `hosted.tsx:2529-2549`). Submit → `POST
  /api/communities/:communityId/agents` → shows a one-time enrollment block
  in the same sheet (see below) and disables re-submission
  (`hosted.tsx:2553`).
- **Setup command / runner token display**: on create (or on explicit
  rotation) the sheet reveals a `runnerToken` (`<code>`, "Copy runner token"
  → toast, `hosted.tsx:2590-2609`) and a `setupCommand` shell one-liner
  (`<code>`, "Copy command," `hosted.tsx:2610-2626`) generated server-side as
  a ready-to-paste `npx tsx packages/runner/src/cli.ts …` invocation
  (`apps/server/src/tenant.ts:613-620`). Both are one-time — the server never
  re-exposes the raw token.
- **Edit**: clicking an agent row as teacher (`hosted.tsx:1426-1429`) opens
  the same `AgentSheet` pre-filled (`existing` branch). All the same fields
  are editable; submit is `PATCH .../agents/:agentId`, no confirm step.
- **Rotate setup token**: "Rotate setup token" button inside the edit sheet.
  **Has a confirm step** ("Rotate this setup token? The previous runner
  credential stops working immediately."). Re-reveals a fresh enrollment
  block in place.
- **Delete**: "Delete" button in the edit sheet. **Has a confirm step**
  ("Delete this agent? … its private conversations will be archived.").
  `DELETE .../agents/:agentId` soft-deletes (status `"deleted"`), which also
  archives its DM channels server-side (`apps/server/src/tenant.ts:689-691`).
- **Add/remove from a channel**: only via the Checkbox list inside the same
  create/edit sheet — no per-channel "add agent" affordance from the channel
  view itself.
- **Runner presence / online status**: reflected only via the small dot on
  the sidebar row (see List, above) and the `"Live"/"Reconnecting…"` text in
  the channel header refers to the *browser's* WS connection, not any
  particular agent's runner connection. There is no dedicated
  presence/status page or tooltip explaining `thinking`/`publishing`.
- **Agent status while working**: the protocol distinguishes `online` /
  `thinking` / `publishing` / `offline` (`hostedPresenceSchema`,
  `packages/protocol/src/hosted.ts:16`) and the server actively emits
  `thinking` when dispatching work and `publishing` when the agent posts
  (`apps/server/src/ws.ts:479-482, 509-511`), but the UI's `AgentRow` dot
  only distinguishes "online" vs not (`hosted.tsx:1512-1518`) — **primitive
  UI that ignores most of the state the server sends**.

### Threads

- **Open**: "Thread" ghost button under any non-deleted message
  (`hosted.tsx:2136-2144`); reuses an existing thread if the root message
  already has one (`hosted.tsx:1757-1762`), else `POST
  .../threads {channelId, rootMessageId}` (`hosted.tsx:1763-1770`).
- **Panel behavior**: desktop (≥1024px) shows a persistent right-hand
  `<aside>` column (`hosted.tsx:1980-1992`); narrower viewports show a
  `Sheet` overlay instead, detected live via `matchMedia`
  (`hosted.tsx:126-133, 1710-1715`). Both render the same `ThreadPanel`.
- **Reply**: `Textarea` + "Reply" button at the bottom of `ThreadPanel`
  (`hosted.tsx:2278-2300`), Enter-to-send (Shift+Enter for newline,
  `hosted.tsx:2282-2287`), with the same `@`-mention suggestion popover as
  the main composer (`hosted.tsx:2202-2224`).
  `POST /api/communities/:communityId/threads`-created thread,
  `createMessage` with `threadId` set.
  **Close**: "Close" button in the thread header just clears `threadId`
  state (`hosted.tsx:2247-2249`) — the thread itself is never deleted, only
  hidden; reopening it later reuses the same thread record.
- Switching channels remounts the whole `ChannelView` (keyed by
  `${active.id}:${channel.id}`, `hosted.tsx:941`), so an open thread panel
  always closes when you change channel — thread visibility is per-channel,
  ephemeral, in-memory.

### Messages

- **Send**: `Textarea` composer at the bottom of the channel
  (`hosted.tsx:1956-1976`); Enter sends, Shift+Enter newlines
  (`hosted.tsx:1959-1964`); disabled while sending or if the channel is
  archived. Body is always a single-paragraph, single "text" block
  (`hosted.tsx:1744-1747`) — **no rich formatting, no multi-block
  authoring** from the composer even though the protocol supports arrays of
  paragraphs and cite/code block kinds.
- **Edit**: pencil icon, own messages only, hover-revealed row actions
  (`hosted.tsx:2145-2155`); becomes an inline `Input` + "Save" (not a
  `Textarea`, so a multi-line edit collapses to one line,
  `hosted.tsx:2119-2132`). `PATCH /api/communities/:communityId/messages/:id`.
- **Delete**: trash icon, visible to the author *or* a teacher
  (`hosted.tsx:2156-2174`). **Has a confirm step** ("Delete this message? Its
  content will be replaced by a visible tombstone for everyone…"). Deleted
  messages render "This message was deleted." in place
  (`hosted.tsx:2059-2064`), never removed from the list.
- **Reactions**: **no UI**, and not part of the hosted protocol at all — see
  Part 2.
- **Mentions/autocomplete**: typing `@` plus a partial name shows up to 5
  matching members+agents in a small popover above the composer
  (`hosted.tsx:1726-1739, 1936-1955`); clicking a suggestion splices `@name `
  into the text (`hosted.tsx:1824-1831`). This is **client-side text
  substitution only** — there's no structured mention token in the sent
  message; the server's own `@mention` detection lives in the *legacy*
  fixture path (`mentions.ts`), and the hosted agent-work-dispatch path
  (`workAgentsForMessage`) is not driven by parsing `@name` out of hosted
  message text at all in what was read — hosted work dispatch is server-side
  and channel/DM-membership-driven, not literal-mention-driven (see Part 2).
- **Attachments**: **no UI**, and no attachment schema in the hosted
  protocol at all — see Part 2.
- **Markdown/code rendering**: **no UI distinction whatsoever.** Both
  `MessageRow` and `ThreadMessage` render a message body via
  `message.paragraphs.flat().map(block => block.text).join(" ")`
  (`hosted.tsx:2059-2064, 2323-2328`) — this **flattens every block kind**
  (`"text" | "cite" | "code"`, `packages/protocol/src/hosted.ts:337-341`)
  into plain joined text. A `cite` block's `cardId` is discarded entirely (no
  link/citation UI), and a `code` block's fenced content renders as an
  ordinary inline sentence, not a code block.
- **Hover actions**: Thread / Edit (own) / Delete (own or teacher) appear
  only on `group-hover`/`focus-within` (`hosted.tsx:2141`), consistent with a
  Slack/Buzz-like "open row" pattern (per repo convention, "Messages are open
  rows rather than bubbles").

### Search / command palette

- **No UI.** No search input, no `Cmd/Ctrl+K` listener, and no keyboard
  shortcut handling anywhere in `hosted.tsx`. A `command-palette.tsx`
  component exists under `apps/web/src/components/workspace/` but (per Part
  0) is entirely unmounted.

### Settings (of any kind)

- **No dedicated settings screen or menu exists.** The closest analogues are
  the inline channel-rename control and the (missing) community
  name/term edit noted above. There is no user-preferences, notification,
  or appearance settings surface.

### Notices / toasts

- A single `notice` string of application-wide scope
  (`hosted.tsx:759, 1035-1050`) renders as a fixed bottom-right
  toast-like `div` with a manual "Dismiss" link — **not** the shadcn
  `Toaster`/`sonner`-style toast system that `App.tsx` mounts globally
  (`App.tsx:35`, `components/ui/toast.tsx`); `hosted.tsx` never imports or
  calls that toaster. It's a bespoke one-notice-at-a-time banner that every
  mutation handler funnels error/success text into via `onNotice`.

### Responsive variation

- Sidebar (channels/members) collapses to a `Sheet` below `md` (768px):
  trigger is "Open workspace menu" button in a mobile-only header bar
  (`hosted.tsx:928-937`), content duplicated inside `SheetContent` at
  `hosted.tsx:957-1015` (same `ChannelSidebar`/`MemberSidebar` components,
  reused rather than reimplemented).
- Thread panel collapses to a `Sheet` below `1024px` independently of the
  `md` breakpoint used for the main sidebar (`hosted.tsx:126-133`) — two
  different breakpoints for two different panels.
- `AgentSheet` and `InviteSheet` are always sheets (`sm:max-w-md`/
  `sm:max-w-sm`), full-width below `sm`.

## Part 2 — Server/protocol capabilities with no UI, awkward UI, or ignored fields

| Capability | Evidence | Gap |
|---|---|---|
| Community rename/re-term (`PATCH /api/communities/:communityId`) | `apps/server/src/api.ts:572-585`; no client wrapper in `hosted-api.ts` | No UI at all |
| Invite `maxUses`/`expiresAt` | `createInviteInputSchema`, `packages/protocol/src/hosted.ts:150-158`; `InviteSheet`, `hosted.tsx:2648-2702` | UI collects only `role`+`mode`, drops both optional fields |
| Invite listing/revocation | none in `tenant.ts`/`api.ts` | No server route, so necessarily no UI |
| Channel `description` and `visibility` on create/update | `createCommunityChannelInputSchema`/`updateCommunityChannelInputSchema`, `packages/protocol/src/hosted.ts:220-232`; create call `hosted.tsx:1305-1314`, update calls `hosted.tsx:1784-1786, 1799-1802` | UI never sends `description`; create always hardcodes `visibility: "public"`; there's no way to make or later switch a channel private |
| Channel `memberIds`/`agentIds` replacement on update | `updateTenantChannel`, `apps/server/src/tenant.ts:548-575`; `updateChannel` client wrapper, `hosted-api.ts:185-208` (accepts arbitrary body) | `hosted.tsx` never calls it with those fields — no membership-editing UI for channels at all |
| Membership role change (promote/demote) | no route exists | No UI, no API |
| Message `threadId`/multi-paragraph/`cite`/`code` blocks | `scopedMessageSchema`, `createScopedMessageInputSchema`, `packages/protocol/src/hosted.ts:337-350, 407-412` | Composer always sends one paragraph, one `"text"` block; renderer flattens/ignores block kind entirely (see Part 1, Messages) |
| `runner.presence` states `thinking`/`publishing` | emitted by server, `apps/server/src/ws.ts:479-482, 509-511`; reduced into snapshot, `hosted.tsx:1182-1196` | State *is* stored client-side but the only rendering (`AgentRow`'s dot) collapses it to on/off |
| `card.published` event | in the scoped event union, `packages/protocol/src/hosted.ts:447`; server emits it on runner card publish, `apps/server/src/ws.ts:524-527` | `ReducibleHostedEvent` in `hosted.tsx:92-125` has no case for `"card.published"` — it silently falls through the `reduceHostedEvent` `default` branch (`hosted.tsx:1197-1199`) and is dropped. No card/wiki UI exists to show it even if handled. |
| `membership.left`/`membership.removed` events | protocol, `packages/protocol/src/hosted.ts:436-439`; server emits both, `apps/server/src/api.ts:628, 645` | Client never listens for these directly — it special-cases every `membership.*` event to trigger a full community-list refetch instead (`hosted.tsx:772-788`), rather than incrementally reducing the payload |
| `directory.updated` event (public channel/agent directory) | protocol + server emit, `apps/server/src/api.ts:676-678` etc. | Handled by forcing a full snapshot refetch (`hosted.tsx:772-789`) rather than being reduced — works, but heavier than necessary and the directory itself is only used for the "Browse public channels" list |
| Attachments (`POST/GET/DELETE /api/channels/:channelId/attachments`, `/api/attachments/:id`) | `apps/server/src/api.ts:1139-1192` | Entirely on the **legacy** single-community API; not part of `packages/protocol/src/hosted.ts` at all — no hosted attachment schema exists, so there's no way this could gain hosted UI without new protocol work |
| Reactions (`PUT/DELETE /api/messages/:id/reactions/:emoji`) | `apps/server/src/api.ts:1254-1279` | Same: legacy-only, no hosted protocol schema |
| Read markers (`PUT /api/channels/:id/read`) | `apps/server/src/api.ts:1281-1290` | Legacy-only |
| Typing indicators (`typing.set` WS message) | `apps/server/src/ws.ts:280-298` | Legacy-only (keyed off the old `Member`/`Channel` types, not tenant-scoped) |
| Modules/materials/assignments/feedback/reports/cards REST surface | `apps/server/src/api.ts:1195-1491` | All legacy single-course; no hosted equivalent, no UI |
| `agentDmSchema.status`/`archivedAt` (a DM going `archived` when its agent is deleted) | `packages/protocol/src/hosted.ts:243-251`; server sets it in `updateTenantAgent`, `apps/server/src/tenant.ts:690` | No UI ever surfaces "this DM's agent was deleted" distinctly — the DM just disappears/stops working with no explanation shown |

## Part 3 — Ada-specific concepts (things a generic chat app like Buzz would not have)

- **Teacher/student role per membership**, not per user. A `User` never
  carries a role globally — only `Membership.role`
  (`packages/protocol/src/hosted.ts:22, 33-42`). The same person can be
  teacher in one community and student in another. Gates: creating/renaming
  channels (`createTenantChannel`/`updateTenantChannel`,
  `apps/server/src/tenant.ts:531, 549`), creating/editing/deleting/rotating
  agents (`teacher()` guard throughout `tenant.ts`, e.g. `apps/server/src/tenant.ts:653, 674, 699`),
  creating invites (`apps/server/src/tenant.ts:371`), removing members
  (`apps/server/src/tenant.ts:424`), reading every private DM in the
  community (`apps/server/src/tenant.ts:456-462`), archiving channels. In the
  UI: `canManageAgents`/`canManageChannels` derived straight from
  `snapshot.membership.role === "teacher"` (`hosted.tsx:895-896`) hide the
  relevant "+"/edit affordances outright rather than disabling them.
- **Invites bound to a role.** An invite fixes the `role` the redeemer will
  get (`inviteMetadataSchema.role`, `packages/protocol/src/hosted.ts:140`);
  the teacher picks the role when generating the code
  (`InviteSheet`, `hosted.tsx:2673-2687`). Buzz-style invite links are
  typically role-agnostic (everyone joins as the same kind of member).
- **Agent setup command + subscription runners.** Creating/rotating an agent
  mints a one-time `runnerToken` and a ready-to-paste
  `npx tsx packages/runner/src/cli.ts --server … --community … --agent …
  --token …` shell command (`agentEnrollment`, `apps/server/src/tenant.ts:613-620`;
  displayed at `hosted.tsx:2610-2626`). The runner
  (`packages/runner/src/cli.ts`) is a separate local process that
  authenticates outbound with that token, runs the operator's own `claude
  -p`/`codex exec` subscription binary against scoped "work" the server
  pushes over WS, and never hands its credentials to Ada
  (`packages/runner/src/cli.ts:1-11, 391-400`). This whole
  setup-command-and-external-process model has no equivalent in a plain chat
  app.
- **Runner presence, distinct from human presence.** `hostedPresenceSchema`
  = `online|offline|thinking|publishing` (`packages/protocol/src/hosted.ts:16`)
  is agent-runner-specific state pushed over `/ws/runner` and rebroadcast to
  browsers as `runner.presence` events (`apps/server/src/ws.ts:444-451`) —
  conceptually different from a human's online/away.
- **User-agent DMs visible to teachers.** Any teacher in the community can
  read *every* student's private DM with *any* agent, by design
  (`canReadRow`, `apps/server/src/tenant.ts:456-462`; surfaced in the UI's
  sidebar filter, `hosted.tsx:1293-1296`). A generic chat app's DMs are
  private to their two participants; here a whole role class is a silent
  third party by construction.
- **Card/wiki publication from runners is backend-only.** Runner replies that
  change files in its `wiki/` folder are parsed as markdown cards (frontmatter
  `type`, `title`, `sources`, `supersedes`) and published via a
  `card.publish` WS frame (`runnerCardPublishSchema`,
  `packages/protocol/src/hosted.ts:568-583`; runner-side logic in
  `packages/runner/src/cli.ts:142-193, 456-493`). The server stores these
  (`publishTenantCard`, `apps/server/src/tenant.ts:820-841`) and emits
  `card.published`, but (per Part 2) there is **no rendering of any of
  this** in the mounted UI — cards are pure backend memory in this phase, a
  concept with no chat-app analogue at all.
- **One-time bearer token handling, everywhere.** Both the user token
  (`createUserResultSchema`, `packages/protocol/src/hosted.ts:104-107`) and
  the agent runner token (`agentEnrollmentResultSchema`,
  `packages/protocol/src/hosted.ts:322-332`) are returned exactly once, in
  the creation/rotation response only; the server persists only a SHA-256
  digest (`digest()`, `apps/server/src/tenant.ts:16`) and every ordinary
  projection/event omits raw token fields (enforced by `.strict()` Zod
  schemas throughout `hosted.ts`). Cross-tenant/cross-community leakage is
  additionally guarded by `superRefine` checks that reject an event whose
  nested resource claims a different `communityId`
  (`packages/protocol/src/hosted.ts:459-478`).
- **Community/term as first-class concepts**, i.e. a cohort-shaped community
  (`name` + `term`, `communityCreateInputSchema`,
  `packages/protocol/src/hosted.ts:121-124`), reflecting the target market
  (bootcamps/cohort courses) rather than a general-purpose Slack-like org.
- **Last-teacher invariant.** A community can never drop to zero teachers —
  enforced both on member removal (`apps/server/src/tenant.ts:424-429`) and
  on the teacher's own "leave" (`apps/server/src/tenant.ts:441-446`). No
  generic chat app enforces a minimum-admin-count business rule like this.

## Part 4 — Pattern table

| Use case | Entry point | Container | Lands on after success | Confirm? | Teacher/Student | Evidence |
|---|---|---|---|---|---|---|
| Create account | Account gate, "Create account" | Full-screen card (`Startup`) | One-time token screen | No | Both | `hosted.tsx:296-361` |
| Restore account with token | "Restore with a user token" ghost button | Full-screen card | Workspace | No | Both | `hosted.tsx:364-433` |
| Sign out | 3 icon buttons (sidebar footer, rail, onboarding) | n/a (immediate) | Account gate | No | Both | `hosted.tsx:917-923, 1244-1251, 658-661` |
| Create community | Onboarding "Create community" tab | Full-screen card, tabbed | New community, workspace | No | Both (creator becomes teacher) | `hosted.tsx:667-691` |
| Join community via code | Onboarding "Join with code" tab | Full-screen card, tabbed | Joined community, workspace | No | Both | `hosted.tsx:693-700` |
| Switch community | Rail icon | n/a (inline) | Selected community | No | Both | `hosted.tsx:1220-1233` |
| Leave community | "Leave community" (roster panel) | `AlertDialog` | Next community or onboarding | **Yes** | Both (blocked for last teacher server-side) | `hosted.tsx:1649-1679` |
| Create invite | "Create invite" icon (roster) | `Sheet` | Same sheet, code shown | No | Teacher only (button hidden) | `hosted.tsx:1606-1616, 2635-2734` |
| Redeem invite | Onboarding "Join with code" | Full-screen card | Joined community | No | Both | `hosted.tsx:693-700` |
| Remove member | Trash icon (roster row) | `AlertDialog` | Same roster, member gone | **Yes** | Teacher only | `hosted.tsx:1629-1646` |
| Create channel | "+" / "Browse" (channel sidebar) | Inline expandable panel | New channel selected | No | Teacher only | `hosted.tsx:1352-1361, 1470-1487` |
| Rename channel | Pencil icon (channel header) | Inline input | Same channel, new name | No | Teacher only | `hosted.tsx:1843-1857, 1873-1880` |
| Archive channel | Trash icon (channel header) | `AlertDialog` | Channel list without it | **Yes** | Teacher only | `hosted.tsx:1882-1896` |
| Join public channel | "Join" (browse panel) | Inline panel row | Channel selected | No | Both | `hosted.tsx:1461-1468` |
| Leave channel | "Leave" (channel header) | `AlertDialog` | Channel list without it | **Yes** | Non-teacher members | `hosted.tsx:1897-1911` |
| Start agent DM | Message icon on agent row (or row click for non-teachers) | n/a (inline) | DM channel selected | No | Both | `hosted.tsx:1409-1445, 1520-1528` |
| Create agent | "+" (agents section) | `Sheet` | Same sheet, enrollment shown | No | Teacher only | `hosted.tsx:1394-1401, 2355-2632` |
| Edit agent | Click agent row (teacher) | `Sheet` | Same sheet, saved | No | Teacher only | `hosted.tsx:1426-1429` |
| Rotate agent token | "Rotate setup token" (agent sheet) | `AlertDialog` inside `Sheet` | Same sheet, new token shown | **Yes** | Teacher only | `hosted.tsx:2566-2578` |
| Delete agent | "Delete" (agent sheet) | `AlertDialog` inside `Sheet` | Sheet closes, agent list refreshed | **Yes** | Teacher only | `hosted.tsx:2576-2587` |
| Send message | Composer (channel/thread) | Inline form | Message appended to list | No (pending state only) | Both | `hosted.tsx:1956-1976` |
| Edit message | Pencil icon (own message, hover) | Inline input | Message updated in place | No | Own message | `hosted.tsx:2145-2155, 2119-2132` |
| Delete message | Trash icon (own or teacher, hover) | `AlertDialog` | Tombstone in place | **Yes** | Own or teacher | `hosted.tsx:2156-2174` |
| Open thread | "Thread" (message hover) | Aside panel or `Sheet` (<1024px) | Thread panel opens | No | Both | `hosted.tsx:2136-2144, 1980-2016` |
| Reply in thread | Textarea (thread panel) | Inline form | Reply appended | No | Both | `hosted.tsx:2278-2300` |
| Close thread | "Close" (thread header) | n/a | Panel hidden, state cleared | No | Both | `hosted.tsx:2247-2249` |

## Uncertainties / things worth double-checking

- Whether hosted agent **work dispatch** (`workAgentsForMessage`,
  referenced in `apps/server/src/ws.ts:82-88, 455-457`) is driven by literal
  `@name` mention parsing or purely by channel/DM membership was not fully
  traceable from the files in scope (`workspace-members.ts`/wherever
  `workAgentsForMessage` is implemented was not read, per the task's stop
  condition on going beyond the listed files). This affects whether "type
  `@agent`" is meaningful in the hosted flow the way it is in the legacy
  `mentions.ts` path — flagged as unverified in Part 1's Mentions note.
- `research/2026-09-03-issue-1-implementation.md` and `DECISIONS.md` were
  only skimmed for the sections cited (§22, the AGENTS.md excerpts); the
  full 164-line research file was not read end to end.
- Server-side legacy vs. hosted route boundaries were inferred from path
  prefixes (`/api/communities/:communityId/...` vs. bare `/api/...`) and each
  route's use of `hostedMember`/`hostedUser` vs. `workspaceActor` — this
  distinction appears consistent everywhere it was checked, but the full
  `workspace-*.ts` service modules behind the legacy routes were not opened.
