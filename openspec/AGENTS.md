# openspec/ — specifications and change history

`README.md` identifies current specifications and the status of older plans.
`specs/` holds the current requirements synchronized from completed changes.
`changes/` holds pending implementation artifacts and `changes/archive/`
preserves completed changes with their metadata and evidence.

Use the OpenSpec CLI to create changes and inspect status/instructions.
Merge deltas into main specs and verify their scenarios before archiving a
completed change. Do not mark historical unchecked tasks complete merely
because later code follows a different design. Product scope and architecture
remain governed by `DECISIONS.md`.
