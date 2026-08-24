#!/bin/bash
# Container-level verification of the deploy shape (AC-8, AC-9): builds both
# images, boots a gated server on a fresh volume, asserts first-boot-once and
# restart stability, then proves the runner container ingests material across
# the network with its own volume and commits the run. Needs a docker daemon.
set -euo pipefail

PORT=18081
NET=ada-docker-check
SRV=ada-docker-check-server
RUN=ada-docker-check-runner
VOL=ada-docker-check-data
RVOL=ada-docker-check-runner-data

cleanup() {
  docker rm -f "$SRV" "$RUN" >/dev/null 2>&1 || true
  docker volume rm -f "$VOL" "$RVOL" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
cleanup
trap cleanup EXIT

fail() { echo "FAIL $1" >&2; exit 1; }
ok() { echo "ok  $1"; }

docker build -q -f deploy/Dockerfile -t ada-server:docker-check . >/dev/null
docker build -q -f deploy/Dockerfile.runner -t ada-runner:docker-check . >/dev/null
ok "both images build"

docker network create "$NET" >/dev/null
docker run -d --name "$SRV" --network "$NET" -v "$VOL":/data -p "$PORT":8080 \
  -e ADA_REQUIRE_MEMBERSHIP=1 -e ADA_OWNER_TOKEN=dc-owner -e ADA_AGENT_TOKEN=dc-agent \
  ada-server:docker-check >/dev/null

for i in $(seq 1 30); do curl -sf "http://localhost:$PORT/health" >/dev/null && break; sleep 1; done
curl -sf "http://localhost:$PORT/health" | grep -q '"ok":true' || fail "health"
ok "first boot serves /health"
docker logs "$SRV" 2>&1 | grep -q "first boot: seeding" || fail "first-boot seed"
ok "first boot seeded"
curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/community" | grep -q 401 || fail "gating"
ok "gated by default env"
curl -sf "http://localhost:$PORT/" | grep -qi "<!doctype html>" || fail "SPA served"
ok "SPA served same-origin"
# The bundle must carry the CONNECTED client, not the synthetic demo: Vite
# inlines VITE_ADA_SERVER at build time and drops the unused branch, so a
# missing build variable would silently ship the demo (deploy/Dockerfile).
docker run --rm --entrypoint sh "ada-server:docker-check" -c \
  'grep -q "Connecting to the course" /app/apps/web/dist/assets/index-*.js' || fail "image bundles the demo instead of the connected client"
ok "image bundles the connected client"

TT=$(curl -sf -X POST "http://localhost:$PORT/api/claim" -H 'content-type: application/json' -d '{"token":"dc-owner"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['personToken'])")
M1=$(curl -sf "http://localhost:$PORT/api/community" -H "authorization: Bearer $TT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['messages'][0]['at'], len(d['messages']))")
docker restart "$SRV" >/dev/null
for i in $(seq 1 30); do curl -sf "http://localhost:$PORT/health" >/dev/null && break; sleep 1; done
docker logs "$SRV" 2>&1 | grep -c "first boot: seeding" | grep -qx 1 || fail "restart re-seeded"
M2=$(curl -sf "http://localhost:$PORT/api/community" -H "authorization: Bearer $TT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['messages'][0]['at'], len(d['messages']))")
[ "$M1" = "$M2" ] || fail "restart changed seeded data"
ok "restart: no re-seed, timestamps and person token stable"

docker run -d --name "$RUN" --network "$NET" -v "$RVOL":/data \
  -e ADA_SERVER="http://$SRV:8080" -e ADA_AGENT_TOKEN=dc-agent -e ADA_RUNTIME=scripted \
  ada-runner:docker-check >/dev/null
for i in $(seq 1 30); do
  P=$(curl -sf "http://localhost:$PORT/api/community" -H "authorization: Bearer $TT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(next((m['presence'] for m in d['members'] if m['id']=='ada'),''))")
  [ "$P" = "online" ] && break; sleep 1
done
[ "$P" = "online" ] || fail "runner container online"
ok "runner container connected with the rotated token"

MAT='# Attention\n\n## Attention as a weighted lookup\n\nQueries, keys and values; softmax over scores weighs the values. A worked 3-token example makes the lookup visible.\n\n## Why softmax instead of a plain average\n\nA plain average ignores the query; the softmax sharpens or blends depending on the score spread, scaled by the key dimension.\n\n## Why attention parallelizes\n\nEvery row of scores comes from the same matrices in one multiplication; recurrence walks the sequence step by step.\n'
python3 - "$TT" "$PORT" << 'PY'
import json, sys, time, urllib.request
token, port = sys.argv[1], sys.argv[2]
base = f"http://localhost:{port}"
material = "# Attention\n\n## Attention as a weighted lookup\n\nQueries, keys and values; softmax over scores weighs the values. A worked 3-token example makes the lookup visible.\n\n## Why softmax instead of a plain average\n\nA plain average ignores the query; the softmax sharpens or blends depending on the score spread, scaled by the key dimension.\n\n## Why attention parallelizes\n\nEvery row of scores comes from the same matrices in one multiplication; recurrence walks the sequence step by step.\n"
req = urllib.request.Request(base + "/api/modules/04-attention/materials", method="POST",
    headers={"content-type": "application/json", "authorization": f"Bearer {token}"},
    data=json.dumps({"name": "attention.md", "kind": "markdown", "text": material, "authorId": "martin"}).encode())
urllib.request.urlopen(req)
for _ in range(40):
    time.sleep(1)
    r = urllib.request.Request(base + "/api/community", headers={"authorization": f"Bearer {token}"})
    snap = json.load(urllib.request.urlopen(r))
    m = next((x for x in snap["modules"] if x["id"] == "04-attention"), None)
    if m and m["status"] == "ready" and len(m["cardIds"]) >= 3:
        break
else:
    raise SystemExit("TIMEOUT: remote ingest")
PY
ok "container-to-container ingest published cards"
docker exec "$RUN" test -f /data/course/raw/martin/modules/04-attention/attention.md || fail "material sync"
ok "material synced onto the runner's own volume"
docker exec "$RUN" git -C /data/course/agents/ada log --oneline | grep -q "04-attention" || fail "runner git commit"
ok "runner committed the run in the agent folder"

echo
echo "Docker deploy OK"
