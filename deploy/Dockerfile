# Ada's server service: UI + API + WS in one container (deploy/README.md).
# Runs TypeScript from source with the monorepo layout intact (repoRoot in
# apps/server/src/db.ts is derived from the source tree; see design D-005).
FROM node:24-slim

WORKDIR /app

# Manifests first so the dependency layer caches across source changes.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/protocol/package.json packages/protocol/
COPY packages/runner/package.json packages/runner/
RUN npm ci --no-audit --no-fund

COPY . .

# Vite inlines this at BUILD time: without it the bundle ships the synthetic
# demo and no runtime variable can bring the real client back. "/" = the SPA
# talks to the origin that served it, which is this same service.
ENV VITE_ADA_SERVER=/
RUN npm run build

# The volume holds everything that must survive a redeploy: the SQLite file
# and the course folder (raw material uploads land there).
ENV PORT=8080 ADA_DB=/data/ada.db ADA_COURSE=/data/course
VOLUME /data
EXPOSE 8080

ENTRYPOINT ["/app/deploy/entrypoint-server.sh"]
