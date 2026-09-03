# Independent code, security and data-integrity review

Date: 2026-08-24  
Reviewer: independent Luna agent (`ada_ui_audit`)  
Scope: AC-2 through AC-8 and AC-19

## Findings and resolution

The first read-only pass found nine actionable gaps. All were repaired before
completion:

1. Membership removal, open-to-private transitions, agent assignment removal
   and channel deletion now send one targeted `channel.deleted` redaction to
   viewers who lose visibility, without sending them the private update.
2. Reconnect snapshots use the v2 message adapter and retain client IDs,
   edit/delete tombstones, normalized reactions and attachment metadata.
3. Raw material download resolves the module channel and returns a
   privacy-preserving 404 to viewers who cannot read it.
4. Attachment upload requires active membership in a writable channel.
5. Thread creation, legacy message/card writes and typing use shared
   membership/lifecycle checks; archived channels reject writes.
6. Agent REST responses project `channelIds` through the viewer's readable
   channels.
7. Invite consumption uses one immediate transaction and a conditional
   single-use update.
8. Material upload and report reconciliation are atomic; material file bytes
   are removed on rollback and hooks run only after commit.
9. The focused workspace suite gained API, reconnect and two-client WS cases
   for every privacy/lifecycle gap above.

## Review verification

The reviewer ran server/runner/web typechecks, workspace, gated, smoke and e2e
checks, lint, the production dependency audit and `git diff --check`. The root
agent then reran the entire verification matrix over the combined repair tree;
all commands passed. The final `check:workspace` output includes exact
redaction-event counts and reconnect lifecycle assertions.

Residual findings: none.
