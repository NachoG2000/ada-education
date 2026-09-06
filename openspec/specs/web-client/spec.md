# web-client Specification

## Purpose

Defines the routed, task-oriented interaction model for Ada's hosted community workspace while preserving its default shadcn visual language and tenant-scoped behavior.

## Requirements

### Requirement: Routed workspace navigation
The web client SHALL expose community channels, channel threads, new messages, Agents, agent details, and Settings at the history routes defined by the change design. Reload, browser back, and browser forward MUST restore the route's visible surface without losing the authenticated session.

#### Scenario: Restore a channel route
- **WHEN** an authenticated member loads `/c/:communityId/channels/:channelId`
- **THEN** the client selects that community and channel after validating access
- **AND** stores that channel as the last visited channel for the community

#### Scenario: Restore a thread route
- **WHEN** an authenticated member loads a channel route ending in `/threads/:threadId`
- **THEN** the channel renders with that thread open in the auxiliary surface

#### Scenario: Redirect an incomplete route
- **WHEN** an authenticated member loads `/` or `/c/:communityId`
- **THEN** the client redirects to the last valid channel for the applicable community, then the first joined channel, the community's empty Inbox when it has no joined channels, or onboarding when no community exists

#### Scenario: Navigate history
- **WHEN** the member uses the browser or top-chrome back and forward controls
- **THEN** the corresponding prior or next workspace route is restored

### Requirement: Three-ring responsive shell
The web client SHALL compose persistent navigation, a routed working surface, and at most one contextual auxiliary surface. It MUST preserve access to all in-scope actions across supported desktop and narrow-browser layouts.

#### Scenario: Render multiple-community navigation
- **WHEN** a member belongs to at least two communities on a viewport at least 768 pixels wide
- **THEN** the client shows the community rail and the sidebar community switcher

#### Scenario: Render one-community navigation
- **WHEN** a member belongs to only one community
- **THEN** the client hides the community rail and keeps community actions in the sidebar switcher

#### Scenario: Render narrow navigation
- **WHEN** the viewport is narrower than 768 pixels
- **THEN** the sidebar and community controls are available in a left overlay opened from top chrome

#### Scenario: Render an auxiliary surface
- **WHEN** a thread, channel settings, channel members, or profile surface opens
- **THEN** it replaces any existing auxiliary surface
- **AND** renders as a resizable split pane at 1024 pixels or wider and as a right overlay below that breakpoint

### Requirement: Capability-aware controls
The web client MUST hide actions the current membership is forbidden to perform and MUST disable temporarily blocked actions with an explanation. It SHALL never rely on client gating instead of server authorization.

#### Scenario: Student views teacher actions
- **WHEN** a student views navigation, dialogs, channel settings, Agents, or Settings
- **THEN** teacher-only creation and management triggers are absent

#### Scenario: Sole teacher views a blocked action
- **WHEN** the only teacher views Leave community or the action that would demote that teacher
- **THEN** the action is disabled with an explanation that another teacher is required

### Requirement: Recoverable account lifecycle
The first-run account flow SHALL show the new user token once and MUST require an explicit saved-token acknowledgement before continuing. Signing out MUST use a confirmation gated by acknowledgement that the token is available.

#### Scenario: Save a new user token
- **WHEN** account creation succeeds
- **THEN** the client shows the token with a copy action
- **AND** disables Continue until the member selects "I saved this token somewhere safe"

#### Scenario: Restore an account
- **WHEN** a visitor supplies a valid user token from the account gate
- **THEN** the client restores the global user and their community memberships without issuing a new token

#### Scenario: Sign out safely
- **WHEN** a member chooses Sign out from the footer or Settings Account section
- **THEN** an alert explains that the token is required to return
- **AND** the destructive action remains disabled until "I have my token" is selected

### Requirement: Community task containers and landings
The client SHALL use full-screen onboarding when the user has no community and a two-step dialog for subsequent create or join actions. Switching or successfully creating or joining a community MUST land on that community's last valid or first joined channel, or its empty Inbox when no joined channel exists.

#### Scenario: Add a community from an existing workspace
- **WHEN** a member chooses Add community from the rail or switcher
- **THEN** a dialog offers Create and Join choices with a back step

#### Scenario: Create a community
- **WHEN** a member submits a valid community name and Term
- **THEN** the dialog closes and the client navigates into the created community

#### Scenario: Redeem an already-consumed membership
- **WHEN** invite redemption reports that the current user was already a member
- **THEN** the client switches to that community and shows "You are already a member"

#### Scenario: Leave a community
- **WHEN** a member confirms leaving a community
- **THEN** the client lands on another membership's last valid channel or returns to onboarding

### Requirement: Channel discovery and creation dialogs
The client SHALL provide a channel browser dialog with All, Joined, and Archived tabs and client-side search. Teachers SHALL create channels in a dialog containing name, optional description, and Public or Private visibility, defaulting to Public.

#### Scenario: Open a joined channel from Browse
- **WHEN** a member selects a joined channel in the browser
- **THEN** the dialog closes and the client navigates to that channel

#### Scenario: Join a public channel from Browse
- **WHEN** a member selects a public non-joined channel in the browser
- **THEN** the client joins the channel and navigates to it

#### Scenario: Create from an unmatched search
- **WHEN** a teacher's browser search has no exact channel match
- **THEN** the browser offers "Create #query" and opens the prefilled create dialog

#### Scenario: Create a private channel
- **WHEN** a teacher submits the create dialog with Private visibility
- **THEN** the client creates the channel and navigates to it

### Requirement: Channel contextual management
The channel header and sidebar context menu SHALL expose navigation, copy-name, channel settings, leave, and archive actions according to membership capabilities. Channel settings MUST be an auxiliary surface with editable name and description, visibility, channel members and agents, and destructive actions.

#### Scenario: Edit channel metadata
- **WHEN** a teacher activates an editable channel name or description row and submits a valid value
- **THEN** the value is persisted inline and the panel remains open

#### Scenario: Manage a private channel roster
- **WHEN** a teacher uses Add people, Add agent, or a row removal control in private-channel settings
- **THEN** the selected channel membership is persisted without leaving the panel

#### Scenario: Archive the active channel
- **WHEN** a teacher confirms Archive from channel settings or a channel menu
- **THEN** the channel becomes read-only and the client navigates to another available channel when necessary

#### Scenario: View an archived channel
- **WHEN** a member opens an archived channel from the Archived browser tab
- **THEN** its history remains readable and the composer is replaced by an archived explanation

### Requirement: Channel members and identity profiles
The channel header SHALL open a searchable auxiliary member list that represents both people and agents. Activating a person's or agent's identity in messages or member lists SHALL open a profile popover with only context-appropriate actions.

#### Scenario: Open a person profile
- **WHEN** a member activates a person's name or avatar
- **THEN** a popover shows that person's name, role, and presence without moderation actions

#### Scenario: Open an agent profile
- **WHEN** a member activates an agent's name or avatar
- **THEN** a popover shows the agent's avatar, status, runtime and model with a Message action
- **AND** shows Manage only to teachers

### Requirement: Direct messages and education privacy
New message SHALL be a routed recipient-selection surface limited to agents. Teachers SHALL have a distinct collapsed Student conversations section for user-agent DMs belonging to students, and those conversations MUST be read-only to the teacher. A student's own agent DM MUST disclose teacher visibility.

#### Scenario: Start a new agent DM
- **WHEN** a member selects an agent in `/c/:communityId/messages/new`
- **THEN** the client opens or creates the unique user-agent DM and navigates to it

#### Scenario: Teacher reads a student conversation
- **WHEN** a teacher opens a `student · agent` row under Student conversations
- **THEN** the conversation history is shown without a composer
- **AND** a message explains that the teacher is viewing the student's private conversation

#### Scenario: Student reads a private conversation
- **WHEN** a student opens their user-agent DM
- **THEN** the header persistently states "Teachers can read this conversation"

#### Scenario: View a deleted agent conversation
- **WHEN** an agent has been deleted
- **THEN** its existing DM remains visible with an archived label and opens read-only with a deletion explanation

### Requirement: Agents management route and dialogs
The client SHALL provide a routed Agents list to every member and teacher-only create, edit, channel-assignment, and delete controls. Creation SHALL ask for name, rules, and optional channels with editable starter templates. Runtime, model, credentials, and runner enrollment MUST NOT be required or exposed in the mounted agent flow. Status MUST distinguish online, thinking, publishing, offline, and a 15-second Starting grace after creation.

#### Scenario: Create and enroll an agent
- **WHEN** a teacher submits valid name, rules, and channel assignments
- **THEN** the dialog closes, a confirmation appears, and the new agent detail opens
- **AND** the installation connects the agent automatically without an enrollment dialog

#### Scenario: Edit an agent
- **WHEN** a teacher saves a valid prefilled Edit agent dialog
- **THEN** the dialog closes, the list reflects the result, and a confirmation toast appears

#### Scenario: Add an agent to a channel
- **WHEN** a teacher opens Add to channel for an agent
- **THEN** active non-DM channels are selectable, existing memberships are disabled, and the first eligible channel is the default

#### Scenario: Disconnected installation
- **WHEN** an agent is offline after its Starting grace
- **THEN** its detail explains that the administrator can check the shared connection

#### Scenario: Delete an agent
- **WHEN** a teacher confirms agent deletion
- **THEN** the agent detail panel closes, the list updates, and its DMs become archived read-only history

#### Scenario: Rotate an enrollment token
- **WHEN** the installation replaces an invalid agent enrollment
- **THEN** the mounted agent flow requires no token copying or runner command
- **AND** the host reconnects the agent through the shared installation connection

### Requirement: Community member administration
Settings Members SHALL show teachers a member table with role, presence, and joined date. Per-row actions SHALL support role changes and confirmed removal while proactively preserving the last-teacher invariant.

#### Scenario: Change a membership role
- **WHEN** a teacher chooses Make teacher or Make student for an eligible member
- **THEN** the row updates optimistically, the server persists the role, and a toast confirms success or rolls the row back on failure

#### Scenario: Remove a member
- **WHEN** a teacher confirms removing an eligible member
- **THEN** the member loses community access and disappears from the active member table

### Requirement: Thread navigation and composition
Threads SHALL open from a message hover action or reply-count affordance, add their identifier to the channel URL, and close from the close control or Escape. Thread composition MUST support the same send and mention keyboard behavior as channel composition.

#### Scenario: Open a thread from a message
- **WHEN** a member activates Reply in thread or the reply-count affordance
- **THEN** the routed auxiliary panel shows the root message, replies, and thread composer

#### Scenario: Close a thread
- **WHEN** the member presses Escape while no higher-priority dialog or mention menu is open
- **THEN** the auxiliary panel closes and the URL returns to the channel route

### Requirement: Message interaction grammar
Message actions SHALL appear on row hover or focus and provide Reply in thread, author-only Edit, and a More menu with Copy text, Copy link, and authorized Delete. Edits MUST use a multiline inline editor and deletions MUST require confirmation.

#### Scenario: Edit a message
- **WHEN** the author selects Edit
- **THEN** the message becomes a multiline editor where Enter saves, Shift+Enter inserts a newline, and Escape cancels
- **AND** a saved edit renders an edited marker

#### Scenario: Copy a message link
- **WHEN** a member selects Copy link
- **THEN** the clipboard receives the routed channel or thread URL with that message's anchor

#### Scenario: Delete a message
- **WHEN** the author or a teacher confirms Delete
- **THEN** the row becomes a content-free deletion tombstone

### Requirement: Message composition and rendering
Channel and thread composers MUST send on Enter, insert a newline on Shift+Enter, retain in-memory drafts per channel, and provide a keyboard-operable mention popover. Agent mentions MUST only include agents assigned to the current channel. Text, fenced code, and citation blocks SHALL render without introducing a cards UI.

#### Scenario: Select a mention by keyboard
- **WHEN** a member types `@` and uses Arrow keys and Enter
- **THEN** the highlighted eligible identity is inserted as `@Name ` without sending the message

#### Scenario: Render structured message content
- **WHEN** a message contains text, code, or citation blocks
- **THEN** text renders as paragraphs, code renders as fenced code, and a citation renders as plain text using its available title or label

#### Scenario: Show an agent-ready empty channel
- **WHEN** a teacher views an empty channel containing an assigned agent
- **THEN** the empty state explains that mentioning the agent asks it to work

### Requirement: Command palette and keyboard shortcuts
The client SHALL expose a top-chrome command palette on Command-or-Control K with sections for Channels, Direct messages, People, Agents, and Actions. It MUST implement and visibly document the approved navigation and creation shortcuts.

#### Scenario: Execute a palette destination
- **WHEN** a member chooses a channel, DM, person, or agent result
- **THEN** the palette closes and the corresponding route or profile opens

#### Scenario: Execute a capability-aware action
- **WHEN** a student opens the palette
- **THEN** Create channel, Create agent, and Invite to community actions are absent

#### Scenario: Use a direct shortcut
- **WHEN** a member uses the approved Browse, Create channel, New message, Settings, Back, or Forward shortcut outside a text conflict
- **THEN** the corresponding capability-aware interaction runs

### Requirement: Routed settings
Settings SHALL be a full-bleed route with Profile, Keyboard shortcuts, and Account sections for every member plus Community, Members, and Invites for teachers. Switching sections MUST replace the settings history entry rather than push a new one.

#### Scenario: Update profile
- **WHEN** a member saves a valid display name in Profile
- **THEN** the global account identity updates and remains visible in the current session

#### Scenario: Update community details
- **WHEN** a teacher saves a valid community name or editable Term
- **THEN** the community switcher and Settings reflect the update and a toast confirms it

#### Scenario: Manage active invites
- **WHEN** a teacher opens Invites
- **THEN** active invite metadata shows role, uses, and expiration without raw codes
- **AND** the teacher can open Create invite or revoke an invite

### Requirement: Intentional role-bound invites
The Invite dialog SHALL default to Student, three days, and one use; SHALL offer the approved role, expiration, and use choices; and MUST mint a credential only after explicit submission. A new raw code MUST be shown only in its creation result.

#### Scenario: Create an invite
- **WHEN** a teacher submits valid invite settings
- **THEN** the dialog shows the one-time code with Copy and Create another actions

#### Scenario: Copy an invite
- **WHEN** the teacher copies the code
- **THEN** the copy control displays Copied for approximately two seconds

#### Scenario: Create another invite
- **WHEN** the teacher chooses Create another
- **THEN** the dialog returns to the default invite form without re-showing the previous code

### Requirement: Feedback and material states
The client SHALL use the mounted toaster for transient feedback only when the visible landing does not demonstrate success. Forms and destructive actions MUST expose pending labels, inline errors, disabled duplicate submission, and the loading, empty, reconnecting, archived, and permission states defined by the change design.

#### Scenario: Submit a dialog mutation
- **WHEN** a dialog submission is in flight
- **THEN** its submit control is disabled and uses an action-specific pending label

#### Scenario: Fail a dialog mutation
- **WHEN** a dialog mutation fails
- **THEN** the dialog stays open, shows an inline error, and preserves the entered values

#### Scenario: Lose the live connection
- **WHEN** the community socket disconnects after hydration
- **THEN** the header reports Reconnecting, composition remains available, and a failed send is surfaced by toast

### Requirement: Cards remain outside the mounted interface
The client MUST NOT render card publication events, a cards route, or a card-publication system line as part of this change.

#### Scenario: Receive a card publication event
- **WHEN** an agent publishes a card
- **THEN** the hosted conversation interface does not add a visible card or system-line element
