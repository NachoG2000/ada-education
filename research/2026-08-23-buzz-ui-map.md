# Buzz UI map for Ada

Date: 2026-08-23  
Reference: `https://github.com/block/buzz`  
Local checkout: `/Users/ignaciogarcia/Desktop/Personal/buzz`  
Reference commit: `0720f5380ce8a6c050afac159f8462c06cd51ab5` (`origin/main`)  
Method: source inspection of the desktop React/TanStack Router app. The
desktop app is the relevant full chat UI; `web/` is a separate public
repository browser and `mobile/` is a separate Flutter client.

This is an inventory of what exists in Buzz at the reference commit, not a
decision to copy every surface into Ada. Paths below are relative to the Buzz
checkout unless stated otherwise.

## 1. Shell, routes, and navigation

The application shell is composed in `desktop/src/app/AppShell.tsx` and
`desktop/src/app/App.tsx`. It mounts a fixed-height, non-document-scrolling
surface with:

- native-window/top chrome (`desktop/src/app/AppTopChrome.tsx`): sidebar toggle,
  back and forward controls, Tauri drag region, and traffic-light clearance;
- optional multi-community rail (`desktop/src/features/sidebar/ui/CommunityRail.tsx`);
- the resizable sidebar (`desktop/src/features/sidebar/ui/AppSidebar.tsx`);
- a rounded content surface (`desktop/src/app/BuzzThemeSurfaces.tsx`);
- global overlays: agent management, create channel, channel browser,
  feedback, settings, profile panels, workflows, huddles, relay connection
  state, toasts and terminal (`AppShellOverlays.tsx`,
  `AppHuddleShell.tsx`, `RelayConnectionOverlay.tsx`).

The authoritative route list is `desktop/src/app/routes.ts`:

| Route | Main screen | Source |
| --- | --- | --- |
| `/` | Inbox/home feed with activity, notes, personal inbox and project inbox | `desktop/src/app/routes/index.tsx`, `desktop/src/features/home/ui/HomeScreen.tsx`, `HomeView.tsx` |
| `/channels/$channelId` | stream, forum, or DM conversation | `desktop/src/app/routes/channels.$channelId.tsx`, `ChannelRouteScreen.tsx`, `desktop/src/features/channels/ui/ChannelScreen.tsx` |
| `/channels/$channelId/posts/$postId` | forum post/thread deep link | `desktop/src/app/routes/channels.$channelId.posts.$postId.tsx` |
| `/messages/new` | new DM recipient picker/composer | `desktop/src/app/routes/messages.new.tsx`, `desktop/src/features/messages/ui/NewMessageScreen.tsx` |
| `/agents` | managed agents/personas/teams catalog | `desktop/src/app/routes/agents.tsx`, `desktop/src/features/agents/ui/AgentsScreen.tsx`, `AgentsView.tsx` |
| `/pulse` | activity feed and publishable notes | `desktop/src/app/routes/pulse.tsx`, `desktop/src/features/pulse/ui/PulseScreen.tsx`, `PulseView.tsx` |
| `/settings` | settings with `section` search state | `desktop/src/app/routes/settings.tsx`, `desktop/src/features/settings/ui/SettingsScreen.tsx`, `SettingsView.tsx`, `SettingsPanels.tsx` |
| `/workflows` | workflow list/editor | `desktop/src/app/routes/workflows.tsx`, `WorkflowsRouteScreen.tsx`, `desktop/src/features/workflows/ui/WorkflowsScreen.tsx` |
| `/workflows/$workflowId` | workflow detail/editor deep link | `desktop/src/app/routes/workflows.$workflowId.tsx` |
| `/projects` | projects overview | `desktop/src/app/routes/projects.tsx`, `desktop/src/features/projects/ui/ProjectsScreen.tsx` |
| `/projects/$projectId` | project workspace, activity, Git/repo/issue/PR panels | `desktop/src/app/routes/projects.$projectId.tsx`, `desktop/src/features/projects/ui/ProjectDetailScreen.tsx` |
| `/reminders` | redirects to `/` (legacy route) | `desktop/src/app/routes/reminders.tsx` |

Sidebar primary navigation is implemented by
`desktop/src/features/sidebar/ui/AppSidebarPinnedHeader.tsx`: Inbox (badge),
feature-gated Pulse, Projects, Agents, and Workflows. The rest of the sidebar
is grouped into Starred, Channels, Forums, Direct messages, and user-created
sections (`CustomChannelSection.tsx`, `SidebarSection.tsx`). Rows support
unread/mention badges, activity previews, mute/star/read actions, drag/drop
reordering, and channel context menus (`ChannelContextMenu.tsx`). Sections can
collapse; section menus can mark all read, browse, create, create DM, rename,
move, delete, and choose Recent/A–Z sorting.

Top search is `desktop/src/features/search/ui/TopbarSearch.tsx` with scoped
search controls (`SearchScopeControls.tsx`), result rows
(`SearchResultItem.tsx`), keyboard selection, channel/user/message results,
quick create-channel/create-agent actions, and a browse-channels affordance.
The community switcher and profile menu are
`desktop/src/features/communities/ui/CommunitySwitcher.tsx` and
`desktop/src/features/profile/ui/ProfilePopover.tsx`.

## 2. Chat and message behavior

### Conversation surface

`desktop/src/features/channels/ui/ChannelScreen.tsx` is the orchestration
surface. It combines `ChannelScreenHeader.tsx`, `ChannelPane.tsx`,
`TimelineMessageList.tsx`, `TimelineMessageRow.tsx`, `MessageRow.tsx`,
`MessageThreadPanel.tsx`, `AgentSessionThreadPanel.tsx`, `MembersSidebar.tsx`,
`QuickBotBar.tsx`, `BotActivityBar.tsx`, and `MessageComposer.tsx`.

Header actions include channel name/description, channel type and ephemeral
badges, find-in-channel, huddle start/join, members, channel settings, and
overflow actions. A stream is a chronological timeline with day dividers,
unread divider, read markers, virtualized history loading, typing/activity
indicators, presence, author/profile links, reactions, reply/thread counts,
message links, media/link previews, code and markdown, edits/deletions, and
system messages. A forum uses `ForumChannelContent.tsx`, `ForumView.tsx`,
`ForumPostCard.tsx`, `ForumComposer.tsx`, and `ForumThreadPanel.tsx` instead of
the stream timeline. A DM gets a direct-message intro/avatar treatment.

Message-level actions are in `MessageActionBar.tsx`: reply, edit/delete own
message, reactions, copy/link, mark unread, remind later, pin/agent actions,
and moderation/report actions where allowed. Thread behavior is deliberately
rich: open a thread in a focus drawer or right split pane, expand nested
replies, follow/unfollow/mute notifications, jump to latest, preserve route
history, and close with Escape (`MessageThreadPanel.tsx`,
`ThreadViewModeToggle.tsx`, `FocusThreadDrawer.tsx`). Agent session threads
show live transcript/tool activity (`AgentSessionThreadPanel.tsx`,
`AgentSessionTranscriptList.tsx`, `AgentSessionToolItem.tsx`).

### Composer

The source of truth is `desktop/src/features/messages/ui/MessageComposer.tsx`.
It is a Tiptap editor (`useRichTextEditor.ts`) with persisted per-channel
drafts (`useDrafts.ts`, `useDraftPersistSnapshot.ts`), edit/reply banners,
typing broadcasts, deferred/background media upload, drag/drop and paste,
link previews, custom emoji, agent/channel/user mentions, and automatic
addressing options. The toolbar (`MessageComposerToolbar.tsx`,
`ComposerDockToolbar.tsx`) exposes:

- agent mention/address picker (`ComposerAddressControls.tsx`,
  `MentionAutocomplete.tsx`), with “always address” and “keep mentioned agents
  pinned” settings;
- file attachments, image editor/lightbox, upload progress and spoiler toggles
  (`ComposerAttachments.tsx`, `ComposerImageEditor.tsx`);
- emoji picker/custom emoji (`ComposerEmojiPicker.tsx`, `EmojiAutocomplete.tsx`);
- formatting toggle and selection formatting tray
  (`FormattingToolbar.tsx`, `SelectionFormattingTray.tsx`): bold, italic,
  strikethrough, inline code, code block, blockquote, ordered/unordered lists,
  link and text spoiler;
- send button, addressed-agent chips, activity accessory and optional channel
  actions.

Enter sends; Shift+Enter inserts a line break. Autocomplete captures Arrow
Up/Down and Enter; Escape closes edit/autocomplete/lightbox surfaces. Cmd/Ctrl+K
is link editing in the composer. A reply composer displays “Reply to … in
`#channel`”; edit mode displays “Edit your message” and supports cancel/restore.
Sending/uploading/agent activity disables or changes controls with explicit
pending/error states.

## 3. Channel discovery, creation, and configuration

### Discovery and creation

`desktop/src/features/channels/ui/ChannelBrowserDialog.tsx` provides the
“Browse channels” / “Add a forum” modal. It has All, Joined, and Archived tabs,
deferred search by name/description, keyboard-highlighted rows, join buttons,
empty/no-results states, and an inline “Create …” row when there is no exact
match. Inline creation reuses `CreateChannelFormFields.tsx` and
`CreateChannelFormFooter`.

`desktop/src/features/sidebar/ui/CreateChannelDialog.tsx` is the standalone
create modal. The form (`CreateChannelFormFields.tsx`,
`useCreateChannelForm.ts`) has:

- channel/forum kind (stream = real-time conversation; forum = threaded topic);
- required name and optional description;
- ongoing or temporary/ephemeral type with TTL choices 30 minutes, 1 hour,
  6/12 hours, 1/3/7/14/30 days (`ChannelTypeSettings.tsx`);
- public/open or private visibility (`ChannelPermissionsSettings.tsx`);
- optional channel template, template summary, and a nested “Create new channel
  template…” dialog.

### Channel management

`desktop/src/features/channels/ui/ChannelManagementSheet.tsx` is a responsive
right auxiliary panel/overlay. The summary view (`ChannelManagementSheetRows.tsx`)
shows icon/name/description, channel type, visibility, member count/avatar
stack, copyable channel ID, join/leave, archive/unarchive, delete and member
management. It can edit name/description/type/visibility through a modal and
manage permissions (`ChannelPermissionsSettings.tsx`). It also contains
optional Canvas and Workflows ingress views (`ChannelCanvas.tsx`,
`ChannelWorkflowsSection.tsx`) and moderation actions
(`ChannelManagementModerationActions.tsx`). Those are document/automation
surfaces, not required for Ada’s chat-only boundary.

Members are shown inline (`ChannelMembersBar.tsx`) or in
`MembersSidebar.tsx`; member rows expose profile, presence, remove/role or
agent controls. `AddMemberDialog.tsx`,
`ChannelMemberInviteCard.tsx`, and `AddMemberSearchResultRow.tsx` cover adding
people. `AddChannelBotDialog.tsx` lets a channel owner choose existing agents,
personas, or teams, or create a new agent; it is composed from
`AddChannelBotGenericSection.tsx`, `AddChannelBotPersonasSection.tsx`, and
`AddChannelBotTeamsSection.tsx`.

## 4. Agents, personas, teams, and agent configuration

The route-level agent catalog is `desktop/src/features/agents/ui/AgentsView.tsx`
and `AgentsScreen.tsx`. It uses a page header with “Agent defaults” (or “Set
agent defaults”), bulk “Stop running agents”, responsive overflow actions, and
sections for unified managed agents/personas and teams
(`UnifiedAgentsSection.tsx`, `TeamsSection.tsx`). Loading, error, pending,
running, restart, stopped, and runtime-error states are visible in rows and
status badges.

Creation/editing is intentionally a family of dialogs rather than one form:

- `AgentDialog.tsx` routes create/edit; `AgentDefinitionDialog.tsx` is the
  persona/definition wizard with preview (`AgentCreationPreview.tsx`), name,
  description/instructions, avatar/identity, runtime/harness, provider/API key,
  model, where-to-run, environment variables, MCP servers, response behavior,
  owner-only access, and advanced fields (`AgentDefinitionMetadata.tsx`,
  `AgentDefinitionDialogShell.tsx`, `AgentConfigFields.tsx`,
  `ProviderConfigFields.tsx`, `McpServersSection.tsx`, `EnvVarsEditor.tsx`,
  `WhereToRunSection.tsx`, `RespondToField.tsx`, `PersonaAdvancedFields.tsx`).
- `AgentInstanceEditDialog.tsx` edits a running/managed instance: name,
  runtime/command, provider, API key, model, effort, env vars, MCP, access,
  location and runtime controls. `AgentConfigPanel.tsx` exposes read/copy/edit
  config sections “Model settings”, “MCP servers”, and “Advanced”.
- `PersonaCatalogDialog.tsx` is a searchable/library gallery with create,
  import/export snapshot, share, duplicate, delete and “added by” metadata.
  `PersonaShareDialog.tsx`, `PersonaDeleteDialog.tsx`,
  `AgentSnapshotImportDialog.tsx`, and `AgentSnapshotExportDialog.tsx` are
  supporting confirmation/preview/result modals.
- `TeamDialog.tsx` creates/edits a team with name, description, shared
  instructions, selected agents and deployment details. Team share/delete and
  snapshot import/export have their own dialogs.
- `AgentDefaultsDialog.tsx` / `AgentDefaultsEditor.tsx` configure inherited
  runtime/provider/model/env defaults. `AddCustomHarnessDialog.tsx` registers a
  custom runtime harness.
- `ManagedAgentSessionPanel.tsx`, `ManagedAgentLogPanel.tsx`,
  `AgentSessionTranscriptList.tsx`, `FileContentBlock.tsx`, and
  `FileEditDiffView.tsx` expose live agent turns, tool calls, transcripts,
  files/diffs, error/restart controls and raw-event inspection.

Agent profiles are reused from chat/member clicks via
`desktop/src/features/profile/ui/UserProfilePanel.tsx`. Profile panel tabs/views
include summary/info, channels, agent info, instructions, configuration,
diagnostics, memory, and live runtime/session details
(`UserProfilePanelSections.tsx`, `UserProfilePanelFocusedViews.tsx`,
`UserProfilePanelAgentDetails.tsx`, `agent-memory/ui/MemorySection.tsx`).
This is the useful source for Ada’s “agent in a channel” inspection/edit panel;
the provider/runtime credential controls need adaptation to Ada’s local runner
model.

## 5. Identity, profile, communities, and onboarding

The profile footer/menu is `SidebarProfileCard.tsx` plus
`ProfilePopover.tsx`. It includes avatar/display name, online/away/offline
presence selector, custom status text + emoji (`SetStatusDialog.tsx`), active
community actions, Settings, feedback, and sign-out. Profile panels and edits
are `UserProfilePanel.tsx`, `ProfileSettingsCard.tsx`,
`ProfileAvatarEditor.tsx`, `ProfileAvatarModeTabs.tsx`, `AvatarUpload.tsx`,
and `UserProfileEditAgentDialog.tsx`.

Community management is `CommunityRail.tsx`, `CommunitySwitcher.tsx`,
`AddCommunityDialog.tsx`, `EditCommunityDialog.tsx`,
`HostedCommunityCreateFlow.tsx`, `HostedCommunityOnboarding.tsx`,
`CommunityChangeOverlay.tsx`, and `WelcomeSetup.tsx`. It supports multiple
relay communities, switch/add/edit/remove, relay URL/token, icon, invite and
connection-state warnings.

First-run onboarding is split into machine identity and community setup:

- `MachineOnboardingFlow.tsx`: identity/key generation or import, encrypted
  backup/password/test/download/recovery pairing, runtime setup and default
  agent config;
- `OnboardingFlow.tsx`: profile display name, avatar, gated-relay membership
  check, key import/recovery and completion;
- `CommunityOnboardingFlow.tsx`: connect/join community, profile/avatar,
  starter team/personas, starter channel, invite claim and membership-denied /
  unreachable / retry branches;
- supporting recovery/lock/error screens:
  `IdentityRecoveryPairing.tsx`, `RecoveryScreen.tsx`,
  `KeyringLockedScreen.tsx`, `MembershipDenied.tsx`, `PendingInviteGate.tsx`,
  `RelaunchRequiredScreen.tsx`, `ResetFailedScreen.tsx`,
  `IdentityKeyHelpDialog.tsx`.

The onboarding look is intentionally distinct: chartreuse/yellow landing
surface, bee/wordmark animation (`LandingBees.tsx`, `FlappingBee.tsx`), dark
security/backup subviews, large circular avatar controls and slide/fade motion
(`OnboardingChrome.tsx`, `OnboardingSlideTransition.tsx`).

## 6. Settings and global configuration

`desktop/src/features/settings/ui/SettingsPanels.tsx` defines these sections:

`Appearance`, `Profile`, `Notifications`, `Voice`, `Experiments`, `Agents`,
`Channel templates`, `Compute`, `Shortcuts`, `Hosted communities`, `Invites`,
`Moderation`, `Custom emoji`, `Local archive`, `Mobile`, and `Updates`.

Important UI sources are `AppearanceSettingsControls.tsx` (theme, accent,
gradient/glass, type size, conversation density, thread layout, link previews),
`NotificationSettingsCard.tsx` and `SoundPicker.tsx`,
`KeyboardShortcutsCard.tsx`, `AgentDefaultsSettingsCard.tsx` /
`AgentsSettingsPanel.tsx`, `ChannelTemplatesSettingsCard.tsx`,
`CommunityMembersSettingsCard.tsx` / `InviteLinkSection.tsx`,
`CustomEmojiSettingsCard.tsx`, `ModerationQueueCard.tsx`,
`LocalArchiveSettingsCard.tsx`, `MeshComputeSettingsCard.tsx`,
`MobilePairingCard.tsx`, `HostedCommunitiesSettingsCard.tsx`, and
`ProfileSettingsCard.tsx`.

Settings is a route, not a separate browser page: `AppShell.tsx` keeps the
current destination in history so Back returns to the prior surface. Each
section has loading/permission/error/empty and save/pending feedback as
appropriate.

## 7. Dialogs, sheets, popovers, and transient surfaces

The recurring primitives are Radix-based Dialog, AlertDialog, DropdownMenu,
Popover, ContextMenu, Tooltip, Sheet-like auxiliary panels, and Sonner toasts
under `desktop/src/shared/ui/`. Product surfaces include:

- channel browser/create/manage/edit/delete/member/invite/agent dialogs;
- thread, agent-session, profile, project-context and workflow right panels;
- search/new-DM dialogs, emoji/mention/channel autocompletes, message link and
  attachment/image lightboxes;
- community add/edit/invite/leave menus and relay connection overlay;
- agent definition/instance/defaults/team/persona/snapshot/share/delete/log
  dialogs;
- status, feedback, reminder/snooze, moderation/report and settings dialogs;
- huddle drawer/companion windows and in-channel huddle controls.

Panels preserve URL/search state where possible (`useChannelPanelHistoryState.ts`,
route search validators), so opening a thread/profile/session can be deep-linked
and Back/Forward navigates panel state. Escape closes the active overlay/panel;
clicking backdrop closes floating panels. Wide layouts support a draggable
right panel; double-clicking the handle resets width.

## 8. Responsive and state behavior

`desktop/src/shared/hooks/use-mobile.tsx` defines the mobile breakpoint as
768px. Auxiliary panels use a two-column threshold of 600px (two minimum 300px
panes), from `auxiliaryPanelLayout.ts`. At narrow widths, sidebar becomes a
mobile Sheet, the channel remains single-column, and thread/profile/settings/
channel-management surfaces become full-screen or floating overlays. At wide
widths, channel + right panel are split; panel width defaults to 380px, clamps
to 300–720px (or viewport-minus-main-pane), and persists where the feature
supports it. The sidebar defaults to 300px and clamps 220–420px, persisted in
`localStorage` (`shared/ui/sidebar.tsx`).

Observed first-class states and sources:

- shell startup/identity/keyring locked, onboarding curtain, relay connecting/
  reconnecting/disconnected/degraded (`App.tsx`, `RelayConnectionOverlay.tsx`);
- sidebar skeleton/error/empty and unread-overflow controls
  (`sidebarLoadingSkeleton.tsx`, `SidebarRelayConnectionCard.tsx`);
- home loading/error/empty and refresh (`HomeLoadingState.tsx`, `HomeView.tsx`);
- channel loading/empty/non-member/join/error (`ChannelScreenLoadingFallback.tsx`,
  `ChannelScreenEmptyState.tsx`, `ChannelManagementSheet.tsx`);
- timeline skeleton, older-history pagination, unread/read, typing, upload and
  agent-working states (`TimelineSkeleton.tsx`, `useLoadOlderOnScroll.ts`,
  `TypingIndicatorRow.tsx`, `ComposerUploadProgressOverlay.tsx`,
  `TurnLivenessIndicator.tsx`);
- search no-results, channel-browser no-results, create pending/error;
- agent catalog loading/error/empty, runtime unavailable/install/sign-in,
  running/restarting/stopped/failure states;
- profile/community missing, membership denied, invite invalid/expired,
  connection unavailable/retry and sign-out/reset failures;
- project/repository unavailable and workflow unavailable states.

## 9. Keyboard and command behavior

The canonical registry is `desktop/src/shared/lib/keyboard-shortcuts.ts` and
the settings presentation is `KeyboardShortcutsCard.tsx`.

Navigation: Cmd/Ctrl+K quick search; Shift+Cmd/Ctrl+O browse channels;
Shift+Cmd/Ctrl+K new DM; Shift+Cmd/Ctrl+N new channel; Cmd/Ctrl+, settings;
Cmd+[ / Cmd+] (Alt+Arrow on Windows) back/forward; Cmd/Ctrl+F find in channel;
Shift+Cmd/Ctrl+A home; Cmd/Ctrl+S sidebar; Escape mark current read; Shift+Escape
mark all read. Zoom: Cmd/Ctrl+Plus, Minus, 0. Messages: Enter send,
Shift+Enter newline, Shift+Cmd/Ctrl+Enter agent picker/address toggle,
Cmd/Ctrl+Enter publish Pulse note, Escape close. Huddle: Ctrl+Shift+Space
toggle huddle, Ctrl+Space push-to-talk. Formatting: Cmd/Ctrl+B/I/Shift+X/E/K.

Autocomplete menus use Arrow Up/Down + Enter, scroll the selected row into
view, and Escape/click-outside to dismiss. The app also supports drag/drop
sidebar reordering, panel resizing, keyboard-accessible Radix menus, tooltips,
and reduced-motion CSS/`motion` branches.

## 10. Visual system and assets

The base imports are in `desktop/src/shared/styles/globals.css`; the key token
files are `globals/theme.css`, `globals/typography.css`, `globals/components.css`,
`globals/composer.css`, `globals/markdown.css`, `globals/motion.css`,
`globals/animations.css`, `globals/skeleton.css`, `globals/scrollbars.css`,
`globals/utilities.css`, and `globals/avatar-framing.css`.

- Base palette is Catppuccin Latte (light) / Macchiato (dark), with mauve
  primary; semantic HSL tokens cover background/card/popover/primary/secondary/
  muted/accent/destructive/border/sidebar/chart colors.
- Buzz theme paints a continuous chartreuse-to-blue gradient across the sidebar,
  rail, top chrome and inset shell (`theme.css`, `ThemeProvider.tsx`,
  `BuzzThemeSurfaces.tsx`). The exact tokens are `--buzz-gradient-light-top:
  #e6e6b6`, `--buzz-gradient-light-bottom: #c4d0da`,
  `--buzz-gradient-dark-top: #4a4616`, and `--buzz-gradient-dark-bottom:
  #0a1423`.
- Typography is Inter Variable for UI, JetBrains Mono for code/keys and a
  rem-based virtual type scale; font-size preference and Cmd/Ctrl zoom are
  independent. Conversation density has compact/default/spacious tokens.
- Surfaces use rounded panels, subtle borders, shadows, gradient/glass options,
  skeletons and Motion transitions. The document itself never scrolls; inner
  panes do. Reduced-motion is respected.
- Assets include `desktop/public/buzz.svg`, app icons, landing wordmark,
  onboarding bee/avatars, runtime/harness logos, `desktop/src/features/agents/
  assets/agent-outline.svg`, card texture files under
  `desktop/src/shared/ui/assets/`, custom sounds (`public/sounds`), and huddle/
  media assets. Runtime icons include Claude and harness logos.

## 11. Ada boundary: copy vs omit

For Ada’s requested “fully chat and config, agents and channel creation” shape,
the highest-value Buzz patterns are the shell/sidebar/navigation, stream + DM +
thread conversation, rich composer/mentions, channel browser/create/manage,
member/profile panels, agent catalog/creation/edit/runtime state, community
switching, settings/profile/onboarding states, responsive auxiliary panels,
keyboard command registry, and loading/error/empty states.

Intentionally outside the current Ada boundary (do not turn these into Ada
pages while doing the first chat/config pass):

- Buzz’s Canvas (`ChannelCanvas.tsx`) and all shared document/notes surfaces;
- Pulse notes/activity publishing (`features/pulse`);
- Projects and repository/GitHub workspace (`features/projects`, `/projects`);
- Workflows/automation editor (`features/workflows`, `/workflows`);
- Buzz web’s public repository browser (`web/src/features/repos`, `web/src/app/
  routes/repos*`), which is not the desktop chat shell;
- huddles/voice/video and dedicated companion windows (`features/huddle`,
  `AppHuddleShell.tsx`) unless Ada later explicitly adopts realtime voice;
- Nostr key/relay-specific identity backup, hosted-community and mesh-compute
  administration where Ada’s local token/course model differs.

The exclusions are source-backed observations, not claims that those Buzz
features are unimportant; they are simply not part of the requested first Ada
surface.
