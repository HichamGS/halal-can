#!/usr/bin/env bash
# Maghreb Connect - 502/OOM debugging sequence.
# Usage: ./scripts/debug-502.sh   (from repo root, with .env present)
set -u
COMPOSE="docker compose --env-file .env"

echo "== [1/6] Stop everything and clear old state =="
$COMPOSE down --remove-orphans

echo "== [2/6] Rebuild backend + nginx images =="
$COMPOSE build backend nginx

echo "== [3/6] Start only the essential chain (db, redis, backend, nginx) =="
$COMPOSE up -d db redis backend nginx

echo "== [4/6] Wait 10s, then curl the backend DIRECTLY (bypasses nginx) =="
sleep 10
$COMPOSE exec -T backend curl -fsS -o /dev/null \
  -w "direct backend :8000 -> HTTP %{http_code}\n" "http://127.0.0.1:8000/api/v1/places/?page_size=1" \
  || echo "!! backend not answering directly -> read its logs (step 6)"

echo "== [5/6] curl THROUGH nginx =="
curl -sS -o /dev/null -w "via nginx :80 -> HTTP %{http_code} (/api/v1/places)\n" "http://localhost/api/v1/places/?page_size=1"
curl -sS -o /dev/null -w "via nginx :80 -> HTTP %{http_code} (/api/v1/communities)\n" "http://localhost/api/v1/communities/"

echo "== [6/6] If you saw 502 above, dump the diagnostics =="
echo "--- backend/nginx status ---";    $COMPOSE ps backend nginx
echo "--- backend logs (last 50) ---";  $COMPOSE logs --tail 50 backend
echo "--- nginx error log (last 30) ---"; $COMPOSE logs --tail 30 nginx | grep -i "error\|upstream" || true
echo "--- DNS resolution inside nginx container ---"
$COMPOSE exec -T nginx sh -c 'getent hosts backend || nslookup backend' || echo "!! nginx cannot resolve 'backend'"
