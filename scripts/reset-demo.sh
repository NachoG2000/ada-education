#!/usr/bin/env bash
# Puts the demo back to a fresh course, between takes or after a bad run.
#
#   ./scripts/reset-demo.sh          reset, then stop and tell you what to run
#   ./scripts/reset-demo.sh --dev    reset, then start `npm run dev`
#   ./scripts/reset-demo.sh --force  don't ask before discarding course changes
#
# What it does: stops the server/runner/vite, deletes the local SQLite DB and
# the runner's card-id map, throws away everything the runner and the teacher
# wrote inside the course folder during the run, and reseeds from
# data/<course>/community.json.
#
# It DISCARDS uncommitted changes under the course folder (the cards the runner
# published into agents/*/wiki/ and the material dropped into raw/). Commit
# anything you want to keep before running this.

set -euo pipefail
cd "$(dirname "$0")/.."

COURSE="${ADA_COURSE:-data/neural-networks-2026}"
DB="${ADA_DB:-apps/server/data/ada.db}"
START_DEV=false
FORCE=false

for arg in "$@"; do
  case "$arg" in
    --dev) START_DEV=true ;;
    --force | -f | -y) FORCE=true ;;
    -h | --help)
      sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "reset-demo: unknown option $arg (try --help)" >&2
      exit 2
      ;;
  esac
done

if [ ! -d "$COURSE" ]; then
  echo "reset-demo: no course folder at $COURSE" >&2
  exit 1
fi

# ---- 1. What is about to be thrown away ------------------------------------
dirty="$(git status --porcelain --ignored=no -- "$COURSE")"
if [ -n "$dirty" ] && [ "$FORCE" = false ]; then
  echo "These changes under $COURSE will be discarded:"
  echo "$dirty" | sed 's/^/  /'
  printf 'Continue? [y/N] '
  read -r reply
  case "$reply" in
    y | Y | yes) ;;
    *)
      echo "reset-demo: nothing was touched."
      exit 1
      ;;
  esac
fi

# ---- 2. Stop whatever is running -------------------------------------------
pkill -f "tsx.*apps/server/src/index.ts" 2>/dev/null || true
pkill -f "runner/src/cli.ts" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# ---- 3. Forget the run -----------------------------------------------------
rm -f "$DB" "$DB-wal" "$DB-shm"
rm -rf "$COURSE"/agents/*/.ada          # the runner's card-id map (gitignored)
git checkout -- "$COURSE"               # cards and materials back to HEAD
git clean -fdq -- "$COURSE"             # and anything new the run left behind

# ---- 4. Seed again ---------------------------------------------------------
npm run seed

cat <<'EOF'

Server-side state is fresh. One thing lives in the browser, not here — the
identity you picked, the last channel and the panel layout. Paste this in the
console (or use "Switch person" in the sidebar footer for the identity alone):

  ["ada:me","ada:channel","ada:modules:selected","ada:layout:channel"].forEach(k=>localStorage.removeItem(k));location.reload()

EOF

if [ "$START_DEV" = true ]; then
  echo "Starting the stack (web + server + Ada's runner, scripted runtime)…"
  exec npm run dev
fi

echo "Now run:  npm run dev        (or ADA_RUNTIME=claude npm run dev for the real runtime)"
