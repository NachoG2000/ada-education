# Buzz-parity implementation notes — 2026-08-24

## Scope and source state

This session implemented the first `DECISIONS.md` §21 workspace on branch
`fix/buzz-parity-ui`. The visible reference is the local Buzz clone at
`/Users/ignaciogarcia/Desktop/Personal/buzz`, pinned to commit
`0720f5380ce8a6c050afac159f8462c06cd51ab5`; the source-backed component and
route inventory remains `research/2026-08-23-buzz-ui-map.md`. Buzz supplied
observable layout and interaction facts only. No Buzz Rust, Tauri, Nostr,
relay, repository, runtime or provider-credential code was copied.

## Primary documentation consulted

- Base UI, [Composition](https://base-ui.com/react/handbook/composition), original page verified 2026-08-24. Base UI parts compose a custom React element through the `render` prop. This directly determined the fix for tooltip/dropdown triggers: pass Ada's Button as `render={button}` instead of rendering one button inside another.
- shadcn/ui, [Command](https://ui.shadcn.com/docs/components/aria/command), original page verified 2026-08-24. The documented hierarchy requires `Command` as the state root around `CommandInput` and `CommandList`; omitting that root produced a real `subscribe` runtime failure in the first browser pass. The generated `CommandDialog` adapter now preserves that hierarchy.
- shadcn/ui, [CLI](https://ui.shadcn.com/docs/cli), original page verified 2026-08-24. Workspace primitives were installed/generated through the project-aware CLI rather than copied as unrelated one-off components.
- AI Elements, [Prompt Input](https://elements.ai-sdk.dev/components/prompt-input), original page verified 2026-08-24. The official component supplies Enter/Shift+Enter behavior, attachment selection/drop, file limits, status-aware submit and compound toolbar hooks. Ada composes its Markdown, mention, emoji and upload behavior around that contract.
- Hono, [Body Limit middleware](https://hono.dev/docs/middleware/builtin/body-limit), original page verified 2026-08-24. The server uses the middleware for an early request cap and still checks the parsed file's actual byte length against Ada's exact 10 MiB attachment rule.

## Implementation learnings

1. Generated UI code still needs integration-level browser validation. Both observed failures were composition defects invisible to TypeScript: a missing Command root and nested interactive tooltip triggers. The supported library APIs fixed both without local event workarounds.
2. Server authorization and visible capabilities must be the same rule expressed twice. The first responsive pass showed teacher-only plus/invite/token/edit controls to a student even though REST correctly rejected them. The UI now hides Course/Work creation, invites, community-agent edits and runner rotation from students while preserving Private-channel and personal-agent ownership.
3. Ungated local development still benefits from viewer filtering. The web now includes the selected person as `authorId` on snapshot and attachment GETs; gated deployments continue deriving the viewer only from the bearer token.
4. A continuous chrome gradient plus one inset content surface is enough to reproduce Buzz's spatial model. Adding Ada's previous three-panel Card File shell inside it would have produced two competing depth systems, so Card File styling remains only on inline citations/publications.
5. Seed idempotence has two independent responsibilities: stable configured rows and preservation of live/dynamic state. `check:workspace` explicitly opens a legacy v1 database twice and re-seeds after rotating an agent token and adding a dynamic channel/membership.
6. A read marker is a state transition, not a route-entry side effect. The first connected browser pass revealed that writing a read marker unconditionally caused a `channel.read` event to retrigger the effect. The shell now writes only while the viewer-specific channel snapshot is unread.
7. Invite tokens must follow hash navigation within an already-open tab. Memoizing `#join?token=…` only at hook mount made a newly opened link stale after sign-out; parsing it on each App hash-driven render keeps claim, sign-out and invite entry coherent without adding a router.
8. Membership rows and visibility are distinct. The example `#teachers` channel had only Martin and Ada as members but inherited the new `open` migration default, which correctly made its name and messages readable to all course members under the new semantics. The seed now declares it `private`, seed upserts persist configured visibility, and the gated check asserts that a new student's snapshot contains neither the channel nor its messages.
9. Privacy changes need a message for the audience that loses access. Filtering only the post-mutation `channel.updated` event prevents leakage but leaves the old private data in that browser's memory. The final WS design compares the pre- and post-mutation audience and sends a targeted `channel.deleted` redaction to each viewer who lost visibility; focused two-client checks assert one redaction and zero private update payloads.
10. Snapshot and event adapters must express the same message lifecycle. Reconnect originally used the legacy adapter and lost tombstones, reactions and attachments that live events carried. The viewer snapshot now uses the v2 adapter, and the workspace check verifies both a rich message and a deleted tombstone after hydration.
11. Optimistic chat is a data contract, not just a spinner. The client now keeps a pending record keyed by `clientId`, renders it immediately, reconciles the authoritative row by that ID, and preserves a failed row with an explicit retry action. The server's `(author_id, client_id)` uniqueness makes the retry idempotent.

## Current boundaries

- Connected mode owns real mutations. Demo mode stays a labelled read-only visual preview and does not maintain a second synthetic CRUD implementation.
- Dedicated Modules, My study and Card File routes are retired, but the server/runner module, feedback, report and card pipeline remains unchanged.
- The seeded example agent name and plural `fromCard` semantics remain open decisions; neither was changed here.
