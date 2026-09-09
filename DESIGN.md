---
name: Ada
description: A calm, consistent interface for course communities and their agents.
colors:
  surface: "#fcfdfb"
  surface-muted: "#f2f4f0"
  selected: "#e6ece5"
  ink: "#202923"
  muted-ink: "#5c6961"
  border: "#dce2db"
  input-border: "#b5c0b7"
  primary: "#285e50"
  on-primary: "#ffffff"
  mention: "#e0eee6"
  mention-ink: "#245742"
  destructive: "#b73535"
typography:
  page:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.4
  section:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.5
  message:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  ui:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4286
  caption:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.3333
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  unit: "4px"
  tight: "8px"
  group: "12px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
    height: "32px"
  mention:
    backgroundColor: "{colors.mention}"
    textColor: "{colors.mention-ink}"
    rounded: "{rounded.sm}"
    padding: "1px 4px"
---

# Ada interface system

## Overview

Current operating interface, 2026-09-06; see `DECISIONS.md` §26. Refine the existing Buzz interaction structure and shadcn/Base UI foundation. The signature is a quiet, readable conversation with recognizable inline mentions, not decorative chrome. Light and dark themes have equal hierarchy.

This file and the implemented semantic tokens in `apps/web/src/index.css` govern every mounted screen and future component. Live examples: `/#design-system` (developer reference, fictional content, no backend mutations). The previous Card File design and dated Buzz/default-shadcn contracts are preserved in `docs/history/design-system-2026-09-05.md`; their unmounted code remains history, not guidance for new operating screens.

## Colors

Use semantic Tailwind roles (`background`, `foreground`, `muted`, `muted-foreground`, `primary`, `border`, `input`, `ring`, `destructive`). Never import an external brand stylesheet. Warm green-gray neutrals separate navigation from content. The muted evergreen action color appears in meaningful actions, focus, selected content and mentions. No gradients, colored icon tiles or decorative washes.

Dark equivalents live alongside the light palette: surface `#1a201d`, muted surface `#222a25`, text `#edf2ec`, secondary text `#b0beb3`, action `#a3cfb9` on `#163d2e`, mention `#304c3d` with `#c0e4ca`. Use `success`, `warning`, `info` for presence and pair with text or an accessible name. Color alone never communicates permission or connection.

## Typography

Inter is the operating face; Geist Mono is reserved for code. The existing Literata face belongs to historical card content. Fixed rem sizes, no viewport-scaled app headings. Use `text-page` (20/28), `text-section` (16/24), `text-message` (15/24), `text-ui` (14/20), `text-caption` (12/16). Existing `text-sm`, `text-base`, `text-xs` are corresponding compatible roles, not invitations to invent sizes. Messages and names stay readable; caption size is for supporting information, never primary instructions.

Keep prose near 68 characters when space permits; the conversation column can grow to 56rem to accommodate avatars and actions. Names may truncate in menus, but retain their accessible full name; mention chips wrap when needed. Mobile inputs use at least 16px to avoid browser zoom. Headings use weight 600 and controls 500; ordinary prose uses 400. No uppercase tracked section labels.

## Layout

The system uses a 4px rhythm: 4/8px within controls, 12/16px within groups, 24/32px between sections. Page padding is 16px on narrow screens and 24px where space permits; vertical spacing grows from 24px to 32px. Conversation rows remain open, never bubbles.

Navigation becomes a left sheet below 768px. Contextual channel/thread content splits only when its own available container is at least 840px, leaving 500px for conversation and 320px for context. Below that it overlays; window width alone cannot decide this because the community rail and sidebar consume space. The viewport shell uses `dvh`. Suggestions portal to the document and are positioned by Tiptap/Floating UI, with viewport-constrained width and a scrollable list. The composer scrolls internally at 28dvh/12rem instead of pushing send controls off-screen.

Coarse-pointer buttons expose 44px hit targets while their icons stay compact. Toolbars wrap, main flex/grid children have `min-width: 0`, and overflow is confined to genuinely scrollable content. Never hide page overflow to conceal a broken component.

## Elevation & Depth

Content is flat; hairline separators establish hierarchy. Popovers use one restrained downward shadow (`0 6px 20px -8px rgb(0 0 0 / 0.24)` for mention suggestions). Do not add a shadow to every box. Focus uses the semantic action ring and remains visible in both themes. State transitions are 150–160ms; reduced-motion removes animation and smooth scrolling. No entrance choreography.

## Shapes

4px for inline mentions, 6px for compact items, 8px for controls, 12px for larger contained surfaces. People use initial avatars; agents use their image or the neutral bot icon. Shapes must not suggest a new action where none exists.

## Components

- **Page composition:** `page-layout.tsx` owns `PageScroller`, `PageHeader`, `NavigationItem`, and `ActionSection`. Settings and Agents must import these same components, not copy their markup. State changes active navigation, action availability, or destructive emphasis; it does not change typography, icon geometry, or page spacing. Navigation icons are explicitly 16px with a 2px stroke.
- **Buttons:** use `Button` variants; normal height 32px, compact icon button 28px, ordinary icon button 32px. Lucide icons are 16px by default, 14px for compact buttons and 20px only where navigation/context needs more emphasis. Use `data-icon` for labeled actions. Every icon-only button needs an accessible name, independent of its tooltip.
- **Forms:** use `FieldGroup`/`Field`, persistent labels, `Input`/`Textarea`/`Select`, pending and error states. Compose Base UI triggers with `render`, never nested buttons. Keep keyboard focus and submit behavior native.
- **Messages:** body 15/24; metadata 12/16; sender weight 600. Hover actions also appear on focus and remain reachable on touch. A deleted message remains a tombstone.
- **Mention chips:** shared `.mention-chip` appearance in editor and sent messages. Tiptap's Mention node owns identity, atomic editing and undo. Sent mentions open the existing profile popover; deleted/missing identities remain readable. Plain old messages can resolve unambiguous names without rewriting history.
- **Mention suggestions:** agents and people in the channel; teachers additionally see active community agents outside it. Search supports spaces. Arrows select, Tab/Enter completes, Escape dismisses; Shift+Tab and Tab without a match retain normal focus traversal. IME composition does not submit. Shift+Enter makes a line break. Completion leaves a trailing space.
- **Join on send:** outside agents are labeled “adds to channel on send”. A selected agent produces an inline explanation that it will gain conversation history. Only a teacher who can post can recruit; DMs, students, archived channels and foreign/deleted agents cannot expand access. The server adds membership and saves the message atomically. Selecting a suggestion, drafting and editing an old message do not add an agent.
- **Future screens:** compose the existing primitives, use these semantic tokens and type roles, cover light/dark, keyboard and narrow layout, and extend this document only when a genuinely new repeated pattern requires it. Do not build a second component library.

## Do's and Don'ts

Do keep the conversation central, maintain familiar controls, show permissions before submission, and verify long names and pending states at narrow widths. Use the live reference to compare peer components.

Do not use tiny icons to create density, hide actions behind hover alone, show model/setup details in an identity popover, color ordinary metadata as a badge, or apply the historical card art direction to operating screens. Mention chips are a specific interaction, not a blanket “BOT” badge beside every name.

### Persistent shell and sidebar

Settings retains the same top controls, community rail, and resizable sidebar as channels and Agents. Settings replaces the entire sidebar content with a return action, Settings heading, and role-aware sections; mobile uses the same navigation sheet. Do not mount a separate Settings sidebar or remove the top bar. Keep management content left-aligned within PageScroller, with optional width limits for forms.

Global search appears once, in the top bar. Sidebar navigation, channels, section headings, and Browse use 14px labels, 16px icons, aligned 8px row insets and 36px minimum rows (44px narrow/touch). Only role/term metadata uses 12px. Use the standard ghost-button hover (`hover:bg-muted`, `dark:hover:bg-muted/50`, foreground text) for sidebar interactions. Reserve sidebar-accent and medium weight for persistent selection; selected rows retain that surface on hover. Do not override Button ghost hovers in sidebar headers or actions. The community header shares the row width but has room for two lines (minimum 56px).

The Tiptap EditorContent wrapper must stretch to full width inside PromptInput's column. An unavailable submit action must not visually disable the editable composer; genuine read-only state remains explicit on the editor and its tools.

The workspace Settings entry belongs in the sidebar footer (including compact mode), never among primary navigation rows. Community-specific contextual actions may still open their corresponding settings section.

### Agent activity and direct messages

Show live thinking/publishing presence above the composer through AgentActivity: one agent by name, multiple agents as “N agents working…”, with small avatars and a reduced-motion-aware progress icon. Announce changes politely and clear feedback on idle, offline, or connection loss. Presence is agent-wide, not per-request progress; the title explains that work may span conversations. Do not invent percentages or elapsed-time estimates.

DMs use the agent avatar and conversation wording rather than a lock, hash prefix, or Private badge. Keep the teacher-visibility notice. Participant details do not offer channel settings, membership assignment, or archive controls.

## Educational artifacts and Inbox (§27)

Keep educational surfaces inside the shared shell. Artifacts + count precedes
member avatars in the channel header; small screens retain the icon and count.
The collection and detail replace each other in the single auxiliary panel.
A module guide preview sits above the conversation independently of message
chronology. Use ordinary bordered cards, 16px action icons, 14px controls,
20px artifact headings, and the shared text/link/muted tokens. Markdown content
uses `.artifact-prose` at 15px with comfortable line height and bounded tables
and code blocks. No independent theme or arbitrary HTML renderer.

Fixed templates combine objectives, Markdown, optional hints/questions and
personal answers. Unpublished drafts, saved private work, submitted snapshots
and historical versions are visibly distinct states. Authoring dialogs reuse
Dialog/Input/Textarea/Button primitives with an explicit submit button.

Inbox uses list/detail on desktop and a single surface with Back on mobile.
Context overlays make the underlying conversation inert. Ask privately opens
an editable DM draft; narrow screens prioritize the composer and expose the
source through Open material. See docs/educational-artifacts.md.

## Ada conversation surface (2026-09-07)

Mode: Operate. Ada extends the existing Inter and green-gray system. Its book
mark, primary sidebar entry, and softly tinted conversation ground distinguish
a personal consultation from a shared channel. The same ground and identity
appear in full-page DMs and the right auxiliary panel. Keep status and context
inside ordinary layout, retain a clear source preview and remove action, and
make the audience visible next to the agent identity. Never equate a padlock
with owner-only access while teachers can read the conversation. A narrow
viewport uses the existing auxiliary overlay with an explicit close control.

## Course memory (2026-09-08)

Course memory is a narrow extension of the established Ada Operate surface.
Keep the existing Inter type, green-gray semantic tokens, ordinary bordered
surfaces, and shared `PageHeader`; memory should feel like a governed course
workspace rather than a new visual world.

The page exposes five sections in one consistent frame: Knowledge, Course
activity, Learners/My learning, Sources, and teacher-only Review. The desktop
layout is a responsive list/detail split; on narrow screens the list and detail
replace each other and detail provides an explicit Back action. Section
selection, record selection, source selection, and source version are
discoverable controls. Source/version selection persists in the route so
reload, Back, and Forward restore the same context.

Memory detail makes provenance visible: evidence is quoted near the record,
each citation opens the exact source version, and connected knowledge remains
reachable as ordinary text links. Learner trajectories carry an explicit
privacy statement: teachers can inspect course learners while learners see
only their own trajectory. Use labels and scope text alongside the lock icon;
privacy must never rely on color alone.

The Course memory surface keeps the system's flat depth, 4px rhythm, semantic
focus ring, and ordinary Button/Input/Select primitives. Do not introduce a
card-file theme, decorative data visualization, or a second navigation frame.
