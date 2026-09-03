#!/bin/sh
# Compatibility entrypoint. The hosted-service milestone runs subscription
# agents locally from the UI-generated command; deploy/check-docker.sh still
# exercises the older seeded-course scripted fixture in this image.
# Never echo the environment (provider access lives here).
set -eu

: "${ADA_SERVER:?set ADA_SERVER to the Ada server URL (https://... or the private domain)}"
: "${ADA_AGENT_TOKEN:?set ADA_AGENT_TOKEN to the same value the server was seeded with}"

AGENT_DIR="${ADA_AGENT_CWD:?ADA_AGENT_CWD must be set}"

if [ "${ADA_RUNTIME:-claude}" = "scripted" ]; then
  COURSE_DIR="$(dirname "$(dirname "$AGENT_DIR")")"
  if [ ! -d "$AGENT_DIR" ]; then
    echo "first boot: copying the fixture agent folders into $COURSE_DIR/agents"
    mkdir -p "$COURSE_DIR"
    cp -R /app/data/neural-networks-2026/agents "$COURSE_DIR/agents"
  fi
  mkdir -p "$COURSE_DIR/raw"
fi

# The fresh-folder commit path needs a committer identity (cli.ts commitRun).
git config --global user.name "Ada Runner" || true
git config --global user.email "runner@ada.local" || true

if [ "${ADA_RUNTIME:-claude}" = "scripted" ]; then
  exec /app/node_modules/.bin/tsx packages/runner/src/legacy-fixture-cli.ts
fi

: "${ADA_COMMUNITY_ID:?set ADA_COMMUNITY_ID for the hosted runner}"
: "${ADA_AGENT_ID:?set ADA_AGENT_ID for the hosted runner}"
exec /app/node_modules/.bin/tsx packages/runner/src/cli.ts
