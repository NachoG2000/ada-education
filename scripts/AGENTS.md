# scripts/ — repository checks

`docs-check.mjs` checks documentation contracts for the current hosted
workspace and preserved implementation history. Run it through
`npm run check:docs`; the root `npm run check` includes it in CI.

Keep checks read-only and dependency-free where practical. When a feature
changes scope, update the applicable current-state assertions and preserve
historical checks against their historical documents. Do not assert obsolete
UI or architecture claims merely to keep an old check passing.

`reset-demo.sh` is a retained fixture-only utility from the earlier demo.
It stops matching development processes and discards local fixture/database
state. It is not the hosted onboarding or reset path and is not part of the
normal setup/check commands. Preserve it as history; never use it to prepare
automated checks or reset the user's running workspace.

`dev.mjs` starts web/server/agent host with one installation token, created
once in private ignored state. It forwards shutdown to concurrently, which
stops all three processes. It must never print credentials or seed/reset
the user's database.
