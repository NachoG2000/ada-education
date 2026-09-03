#!/bin/sh
# First boot on an empty volume: copy the example course, seed the DB once.
# Restarts skip both — seeding is row-idempotent but re-resolves the seed's
# relative timestamps ("2d" from now), so it must not run again (design D-005).
set -eu

COURSE_SRC="${ADA_COURSE_SRC:-/app/data/neural-networks-2026}"
if [ ! -d "${ADA_COURSE:?ADA_COURSE must be set}" ]; then
  echo "first boot: copying the course into ${ADA_COURSE}"
  mkdir -p "$(dirname "$ADA_COURSE")"
  cp -R "$COURSE_SRC" "$ADA_COURSE"
fi

if [ ! -f "${ADA_DB:?ADA_DB must be set}" ]; then
  echo "first boot: seeding ${ADA_DB}"
  /app/node_modules/.bin/tsx apps/server/src/seed.ts
fi

exec /app/node_modules/.bin/tsx apps/server/src/index.ts
