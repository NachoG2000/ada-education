# Primary Ada and contextual conversations · 2026-09-07

Source: the user's request and attached Slackbot screenshot in this task.
Original image: `/var/folders/_w/8s6st_qd45s0xpg3486_32dh0000gn/T/TemporaryItems/NSIRD_screencaptureui_8XQltw/Screenshot 2026-09-07 at 9.31.31 PM.png`.
The image was inspected directly: centered assistant identity, conversational
welcome, suggested tasks, a differentiated dark ground, and a bottom composer.
It is visual inspiration, not evidence of Slack's permissions or product APIs.

The user approved Course tutor → Ada, primary system presence, a differentiated
conversation background, Ask Ada on channel messages, and a right panel that
reads as separate from the shared channel. This extends the existing Operate
surface rather than replacing the application's visual system. Implementation
uses existing React, composer, resizable panel, and avatar primitives.

A stable optional system role supports branding without name-based UI routing.
Migration preserves IDs, rules, credentials, messages and existing wiki paths.
The earliest active Course tutor per community is rebranded; custom-named agents
are preserved. Current UI-created communities always request tutor starters.
Legacy/API-created communities without such a tutor are not silently assigned
a different custom agent.

Ask Ada opens a DM and stages a source preview. It neither posts to the source
channel nor starts a model call. Context is included only on explicit question
submission; close/expand preserves the draft and selected source in session
storage scoped by user/community/DM. Long source text is capped and labeled.
Existing teacher visibility is disclosed pending the user's privacy preference.
No new memory or cross-channel access has been implemented.

Validation: hosted gate passed with protected-primary creation/rename/deletion
checks and fake-provider lifecycle coverage for both Claude and Pi. Migration
checks compare every old agent field after the intended name/role change and
reopen the database. Browser inspection exercised the real source-message action
without sending, verified context survives full-page handoff, and checked the
390 px layout with no horizontal overflow. The first mobile pass exposed a
truncated audience notice; it was moved into a full-width row below the header.
