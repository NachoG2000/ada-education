#!/bin/sh
# First boot: copy the agent folders from the image's example course onto this
# service's volume. Never echoes the environment (provider access lives here).
set -eu

: "${ADA_SERVER:?set ADA_SERVER to the Ada server's URL (https://... or the private domain)}"
: "${ADA_AGENT_TOKEN:?set ADA_AGENT_TOKEN to the same value the server was seeded with}"

AGENT_DIR="${ADA_AGENT_CWD:?ADA_AGENT_CWD must be set}"
COURSE_DIR="$(dirname "$(dirname "$AGENT_DIR")")"
if [ ! -d "$AGENT_DIR" ]; then
  echo "first boot: copying the agent folders into $COURSE_DIR/agents"
  mkdir -p "$COURSE_DIR"
  cp -R /app/data/neural-networks-2026/agents "$COURSE_DIR/agents"
fi
mkdir -p "$COURSE_DIR/raw"

# The fresh-folder commit path needs a committer identity (cli.ts commitRun).
git config --global user.name "Ada Runner" || true
git config --global user.email "runner@ada.local" || true

exec /app/node_modules/.bin/tsx packages/runner/src/cli.ts
