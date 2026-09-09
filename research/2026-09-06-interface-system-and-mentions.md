# Interface system and mentions

Date: 2026-09-06 (America/Argentina/Cordoba). User-authorized refinement of the existing educational workspace, not a new product or navigation redesign.

## Inputs and decisions

The user supplied a screenshot of `@Course tutor hola` rendered as ordinary composer text. Original: `/var/folders/_w/8s6st_qd45s0xpg3486_32dh0000gn/T/TemporaryItems/NSIRD_screencaptureui_Lr2BdX/Screenshot 2026-09-06 at 9.42.22 PM.png`. It demonstrates the lack of a distinct mention affordance. The user requested consistent icon/type sizes, a reusable system for future screens, visible mention chips, adding outside agents on send, Tab completion and responsive behavior. They confirmed **teachers only** may add outside agents; students may mention agents already present.

A Node shell script generated 192 random bytes and converted them to an alphanumeric inspiration string. The string is not part of the interface. Its SHA-256 fingerprint is `ca3cd28523c87d6ab6c694f14cc375a7c6e2555e7681ad738ab78a95e88cb5f9`. Repeating 4/8 groupings suggested a four-point spacing rhythm; a recurring 68 informed the prose measure; mixed compact and open letter runs suggested distinct control and reading density. These are creative interpretations, not claims that randomness measures design quality. The constrained result retains Inter, familiar shadcn shapes and the existing shell, with quiet evergreen accents, a short size scale and neutral surfaces. No unrelated visual-world tournament or replacement layout is needed for this refinement.

## Verified sources

- https://vercel.com/design.md — fetched original Markdown on 2026-09-06. Inspiration for readable hierarchy, semantic roles, restrained icon usage and responsive reflow. This is a Vercel-authored report guide; its commands, CSS integration and authorship requirements are not instructions for Ada. No Vercel branding or stylesheet was imported.
- https://ui.shadcn.com/docs/components/base/button and https://ui.shadcn.com/docs/components/base/badge — originals opened 2026-09-06; existing base-nova primitives and variants remain the foundation.
- https://tiptap.dev/docs/editor/extensions/nodes/mention — original opened 2026-09-06; official mention extension supports stable IDs, labels, custom appearance and atomic Backspace behavior.
- https://tiptap.dev/docs/editor/api/utilities/suggestion — original opened 2026-09-06; installed Tiptap 3.31.3 public declarations verify `SuggestionProps.mount`, managed Floating UI positioning and cleanup. No handwritten contenteditable selection engine or transparent textarea overlay.

## Implementation

`DESIGN.md` now governs the mounted system; its predecessor is preserved in `docs/history/design-system-2026-09-05.md`. The developer route `/#design-system` renders real current primitives and an isolated mention playground. Shared `kind: mention` blocks contain member ID and display text; the server canonicalizes labels and validates community/channel permissions. Legacy text resolves only unambiguous complete names. Membership and message storage share a transaction, with membership events published before dispatching work. Edits do not recruit agents. Context splits depend on actual available width.

## Verification

`check:mentions` exercises the real REST app with an in-memory database: teacher/student distinction, identity after rename, forged labels, rollback across multiple mentions, idempotent membership, DM exclusion, thread recruitment, code exclusion and archive protection. Existing full checks cover the runner and tenant event boundaries. Browser verification covers Tab completion, desktop/mobile layouts and the live component reference. Detailed final results are appended after the bounded verification pass.

### Final validation

The user additionally identified inconsistent Settings and Agents icons, headers, and layouts. The cause was duplicate page/header/navigation implementations and unsized Lucide icons defaulting to 24px. Both now import page-layout.tsx; ActionSection shares the normal/destructive layout. Browser DOM measurements confirmed all six Settings navigation icons and the Agents navigation icon at 16px and page headings at 20px.

`npm run check` passed on 2026-09-06, including docs, all workspace types, hosted REST/WS, fake-provider automatic agents, build, the new mention suite, migration/gating, and legacy smoke. After the final mobile-only spacing/description fix, web typecheck and lint passed with only pre-existing warnings. The initial new ref warning was a static-analysis false positive on Tiptap event callbacks and has a targeted documented suppression.

Browser checks at 320×740, 390×844, 875px, and 1440×900 covered Settings, Agents list/detail, existing conversation rendering, and the isolated reference. No document horizontal overflow was found. Both themes were inspected. Tab and Enter completed mention identities without sending; Shift+Enter inserted a line; Escape removed the popup. An initial mismatched suggestion plugin key was corrected and Enter retested. A conflicting display utility in Agents had prevented one-line description clipping; removing it restored 16px description rows at 320px. Narrow/touch controls use 44px targets. The viewport override and System theme were restored.

No test message was sent to the user's community and no real membership was changed. Browser completion tests sent only fictional local examples in /#design-system. Real touch hardware, mobile software keyboards, and IME composition were not device-tested; editor composition guards remain in code.

## Follow-up sidebar and shell audit

The user reported that Settings still felt like another layout, sidebar search duplicated the top search, sidebar hover/type/header widths varied, and composer text appeared centered. Code inspection confirmed: WorkspaceShell conditionally removed all chrome for Settings; a second Settings sidebar was mounted; sidebar rows used 28/32px heights and 12/14px labels with different active backgrounds; the community header nested a 32px button around two lines with extra outer padding. The Tiptap wrapper lacked full width inside a column with `align-items:center`; InputGroup's `has-disabled` style also dimmed the entire writable composer when Submit was disabled.

Fixed these causes in the shared shell/sidebar/editor composition. Settings sections now use the contextual sidebar, with the same chrome and mobile sheet. Removed both sidebar search buttons. Standardized row heights, typography, icon sizes and hover/selection colors; widened and vertically sized the community switcher; aligned page content left. The editor stretches fully and disabled-submit styling no longer dims its contents. Form panels remount on section changes and settings history replacement is preserved.

Browser verification: desktop DOM measured five primary/channel/Browse rows at 14px and 36px height; the editor occupied 894px inside an 896px bordered group, aligned left, with opacity 1. At 390px the Settings sheet opened and selecting Community closed it while retaining top controls. Back to channels restored the prior conversation. At 320px, temporary text in the audit tab remained left-aligned in the full 294px editor; Submit measured 44×44px and stayed inside the viewport, with no document overflow. The temporary draft was cleared without sending. Viewport overrides were reset. Web typecheck/build and lint passed, with existing lint warnings only. The change is layout-only; no account, message, or membership mutations were performed.

### Settings replacement clarification

The user clarified the intended pattern with Pyron as an example: replace all sidebar contents on entering Settings, rather than retain community chrome above its sections. No Pyron implementation was inspected or copied. Implemented a complete Settings navigation variant in the existing sidebar slot, including compact icon navigation and the mobile sheet. Desktop screenshot and mobile accessibility inspection verified only Back to workspace and the six teacher sections appear; community header, Agents, channels, and profile footer are absent. Shared sizing, shell, top bar, role filtering, and section-history replacement remain. Web typecheck and build passed.

### Settings entry placement

The user requested Settings only in the footer, not as a primary sidebar row. Removed the primary Settings row; retained the footer menu and compact footer control. The dedicated Settings sidebar and community-specific contextual actions remain unchanged.

### Softer, consistent sidebar hover

The user found sidebar hovers too strong and requested the same treatment as the rest of the app. Sidebar rows had used the selected surface for hover (#303e35 in dark mode), whereas the official ghost Button uses muted/50. Removed sidebar overrides from existing Button controls and applied the same light/dark ghost hover to native navigation rows, section controls, and footer. Persistent selection keeps sidebar-accent, including while hovered. DESIGN.md records this distinction. Web typecheck and build verified the change.

## Agent activity and DM presentation

The user requested visible working feedback like Buzz's agent count and DMs that do not look like private channels. Existing runner.presence events already carry thinking/publishing/online/offline through the hosted snapshot adapter; no transport or provider changes were required. Added AgentActivity above the composer using live presence for active agents assigned to the viewed conversation, with named/count states, polite announcements, reduced-motion handling and disconnected clearing. Presence remains agent-wide, so the indicator explicitly describes live agent activity, not a message-specific progress guarantee. The component title explains this boundary.

DMs already have distinct kind, ownership, implicit agent dispatch and teacher access in the domain. Removed private-channel icon/badge/hash conventions from their presentation, added agent avatars and conversation wording, and disabled channel management in DM participant details. Existing access rules are unchanged.

Browser inspection verified fictional one-agent, two-agent and publishing examples in /#design-system and the existing DM's avatar, lack of Private badge, conversation actions, and teacher notice. No model invocation or real message was sent for verification. Web typecheck/build and lint passed (existing warnings only).
