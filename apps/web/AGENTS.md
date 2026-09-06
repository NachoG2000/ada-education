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
