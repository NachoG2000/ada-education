# apps/web — the web client

## Current workspace (2026-09-04)

`App.tsx` mounts `HostedApp` inside the supported TanStack Router/Vite setup and keeps only the developer-only `#figures` hash outside the product routes. `components/hosted.tsx` owns account restoration, the one-time token gate, and zero-community onboarding. `components/hosted-surface.tsx` adapts the viewer-filtered hosted snapshot into `CommunityProvider`; `components/workspace/shell.tsx` composes the conditional community rail, course sidebar, routed working surface, and one thread/channel/agent auxiliary surface. `lib/hosted-api.ts` remains the Zod-validated REST/WS boundary.

Mounted routes are `/`, `/join`, `/c/:communityId`, channel and thread routes, `/messages/new`, `/agents[/agentId]`, and `/settings?section=…`. Root/incomplete community routes restore the last valid joined channel, fall back to the first joined channel, or show the empty Inbox when that community has none. Reload and back/forward preserve channel, thread, agent, and Settings state. Settings section changes replace the current history entry.

Buzz is the **interaction** reference only. Keep the presentation deliberately simple: official default-shadcn/Base UI primitives, neutral flat surfaces, normal borders/spacing, plain initial or image avatars, and ordinary responsive sheets. Do not add Buzz gradients, inset-window framing, decorative avatars, or other visual imitation. Creation and quick-edit flows use dialogs, management uses routes or one auxiliary panel, identities use popovers, and message actions use hover/focus controls. Use `render` when composing Base UI triggers so interactive elements are never nested.

The retained fixture/hash client is documented separately under `docs/history/`; this guide describes the mounted product.

**Today:** the SPA runs connected by default: `.env` sets `VITE_ADA_SERVER=/`, which rides the Vite proxy into `apps/server`. With no stored identity, the hosted shell asks for a display name; the browser stores the user token locally after explicit backup acknowledgement. REST mutations and authenticated first-frame WebSocket events keep the active community snapshot current. The mounted surface includes role-aware community switching, channel browse/create/settings, member and invite management, routed Agents and Settings, user-agent DMs with teacher-visible privacy, message edit/delete/thread/mention behavior, command search, one-time runner enrollment, and responsive split/overlay panels. Card publication events are intentionally ignored by the mounted UI. There is no synthetic `dev:demo` mode, message search, reaction/attachment UI, or mounted card UI. The former card-file, Modules, My study, and older hosted component implementations are retained as unmounted history.

**Local production:** after `npm run build`, `apps/server` serves `apps/web/dist` same-origin (`apps/server/src/static.ts`). `VITE_ADA_SERVER=/` also sends development requests through Vite's proxy; if the variable is absent, the mounted hosted client still defaults to the page origin.

## Retained implementation history

The fixture client, `lib/api.ts`, `lib/auth.ts`, `lib/demo.ts`, Modules
(`#modules`), My study (`#home`), and card-file components remain in the
source tree but are not mounted by the product router. Some shared
components/providers are used by both paths; do not classify whole folders
as retired without checking their imports. The old `ada:token` and
`components/ada/join.tsx` flow is documented in
[the historical web guide](../../docs/history/web-client-2026-08.md).

## Verification and growth

Run `npm run typecheck:web`, `npm run lint`, and `npm run build` while
iterating; `npm run check` is the complete repository gate. Route source
files belong under `src/routes/`; Vite generates `src/routeTree.gen.ts`.
Verify teacher/student capabilities, reload/history, and narrow-browser
behavior for interface changes. The automated suite does not exercise the
browser.

New memory surfaces require an explicit scope/design change. Agent creation,
invites, live presence, Agents, and Settings already exist. Product composition
belongs in `components/workspace/`; modify `components/ui/` only to install
or correct official primitives. Preserve the paused Card File implementation.

## Automatic agent experience (2026-09-06)

The mounted agent flow now asks for template, name, rules, and channels only.
Creation opens details without enrollment. Agent details have About and Danger
sections; runtime/model/setup controls are no longer mounted. The host connects
agents automatically. UI-created communities request tutor/curator starters.
Offline details explain the shared installation connection. Older enrollment
components remain unmounted history. See `DECISIONS.md` §25.

## Shared interface and mentions (§26)

`page-layout.tsx` owns PageScroller, PageHeader, NavigationItem, and ActionSection. Settings and Agents import these instead of copying markup. DESIGN.md and index.css semantic tokens supersede the earlier default-only visual restriction above. Use 16px navigation icons, 20px page headings, and shared state variants. `/#design-system` is a developer-only live reference, alongside #figures.

`mention-editor.tsx` uses Tiptap Mention with an explicit shared PluginKey for completion/dismissal and send-key arbitration. Drafts serialize structured mention IDs. Teachers see eligible outside-channel agents; students see channel members only. Completion is not submission or enrollment. Channel and agent context panels measure their own available width (840px threshold), not window width. Validate desktop/mobile layouts and keyboard completion in the isolated reference before touching real messages.

**Shell audit follow-up:** Settings no longer bypasses WorkspaceShell's top bar, rail, or sidebar. `settings-navigation.ts` defines role-aware sections for the complete Settings sidebar replacement. `HostedSettingsPage` renders only section content, keyed by section so form/error state does not leak between sections. Search belongs to the top bar only. Sidebar controls use 14px labels/16px icons/36px minimum rows, and PageScroller keeps a common left edge. MentionEditor must have a full-width stretched wrapper; PromptInput does not attenuate all content merely because Submit is disabled.

`agent-activity.tsx` renders live agent-wide thinking/publishing states for agents assigned to the viewed conversation, with count/name feedback above the composer. It clears on idle/offline/disconnection; it does not claim per-message progress. Reference examples cover single, multiple, and publishing states. DMs render agent avatars and conversation labels; channel-details disables management for DM records while preserving participant inspection and teacher-visibility copy.

## Education surfaces (§27)

The scope now includes `/c/:communityId/inbox` and channel artifact search state.
`artifacts.tsx` composes typed templates, personal work/submission/review flows,
and contextual DM handoff. Use `education-api.ts` for authenticated REST and
`use-education-data.ts` for visible-page/focus refresh; no provider secrets or
memory card APIs belong here. `artifact-markdown.tsx` uses react-markdown with
raw HTML disabled. `inbox-activity.ts` excludes other students' DMs and unrelated
threads. Session drafts are user/community/object scoped. Keep the single
auxiliary-panel invariant and test narrow layouts. See docs/educational-artifacts.md.

**Pi compatibility (§28):** agent projections accept the Pi runtime. The retained
unmounted enrollment editor also recognizes it; runtime selection remains an
installation concern in the mounted product. No Pi dependency enters the SPA.

**Composer activity (2026-09-07):** `ComposerAgentActivity` lives inside the
shared `PromptInput` header, so channels, DMs and threads expand their composer
border around thinking/publishing status. Idle removes the header; drafts remain
mounted. The design-system preview exercises idle, thinking, multiple agents
and saving knowledge without sending real messages.

**Primary Ada (§30):** `systemRole`, not the display name, drives the primary
sidebar entry and tinted DM/panel surface. `ada-identity.tsx` owns the mark and
welcome. Ask Ada reuses the user-agent DM and one auxiliary slot; context is
removable, session-scoped through `ada-message-context.ts`, and sent only with
the user's question. Teacher visibility is explicitly disclosed. No channel
message is sent just by opening Ada.

The message-row Ask Ada action uses the same `AdaMark` as primary navigation,
with an accessible name and hover title; its menu entry keeps a text label.

The channel-header artifact collection button is hidden when empty; otherwise
it shows only the files icon and count, with an accessible label and hover title.

`/c/:communityId/memory` mounts the authorized memory list/detail workspace.
`memory-api.ts` validates sources/records/jobs; views reuse focus refresh and
existing semantic tokens. Knowledge, activity, learner history, originals and
teacher review have distinct states. Students receive only their own learner
records from the server; filtering in React is never the security boundary.
Source downloads carry bearer headers, never credentials in URLs. Keep actual
evidence versions when following source links. Preserve the single detail surface
and Back behavior on narrow screens.
