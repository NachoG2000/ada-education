# First recruiting mention rejected by a stale runner

The user reported that mentioning an outside-channel bot added it but did not produce a response until a later message.

## Evidence and cause

Local development output showed each existing agent log “server sent an invalid hosted runner frame”, exit with 4403, then restart and connect. The same session later showed successful replies after restart. The web/server had reloaded the new structured `kind: mention` schema, but `npm run dev` started a non-watching installation host whose child runners retained the previous schema. The first mention was dispatched after atomic membership insertion, then rejected by a stale runner. No user credentials were inspected or logged for this investigation.

## Fix and verification

Use the installed tsx 4.23.12 supported watch mode, with explicit runner/protocol source includes because child worker imports are outside the host dependency graph. `node node_modules/tsx/dist/cli.mjs watch --help` verified the `--include` and `--clear-screen` options. The official https://tsx.is/watch-mode fetch timed out; installed CLI help is the verified source.

`npm run check:agents -w @ada/server` passed with a new full-stack regression: create an agent-free channel, send exactly one structured recruiting mention, and wait for a reply through the real websocket, runner and fake provider. It checks that no second prompt is needed and no invalid frame is logged. Existing lifecycle, concurrency, restart, isolation and deletion checks also passed. This expands prior REST-only checks, which verified agent selection but not actual execution.

Restarted the local development session with the new command, preserving data and credentials. No historical prompt was replayed and no test message was sent to the user's community. This fixes development schema drift; durable offline delivery remains outside the current architecture.
