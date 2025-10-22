#!/usr/bin/env bash
# Relaxed error handling to allow diagnostic flow to continue even if some steps fail
set -uo pipefail

# Usage:
# API_BASE=http://localhost:8080 \ 
# AUTH_HEADER='Authorization: Bearer <TOKEN>' \ 
# ./scripts/check_v2_api.sh

BASE=${API_BASE:-http://localhost:8080}
AUTH_HEADER=${AUTH_HEADER:-}

# Detect docker CLI
if command -v docker >/dev/null 2>&1; then
  DOCKER_BIN=$(command -v docker)
else
  echo "ERROR: docker CLI not found in PATH. Please ensure Docker Desktop CLI is available." >&2
  DOCKER_BIN=""
fi

# Detect compose command
if docker compose version >/dev/null 2>&1; then
  DC_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC_CMD="docker-compose"
else
  DC_CMD=""
fi

DC=${DC:-"$DC_CMD"}

echo "Using API base: ${BASE}"
if [ -n "$AUTH_HEADER" ]; then
  echo "Using AUTH_HEADER (hidden)"
fi

echo "Docker CLI: ${DOCKER_BIN:-not found}"
docker --version 2>/dev/null || true
echo "Compose command: ${DC:-not found}"

if [ -n "$DC" ]; then
  echo "Starting frontend and backend (detached)..."
  $DC up -d frontend backend || echo "WARN: compose up failed (continuing)"
else
  echo "WARN: docker compose not available; skipping compose up"
fi

echo "\n== docker ps =="
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' || true

if [ -n "$DC" ]; then
  echo "\n== compose ps =="
  $DC ps --service-ports || true
fi

echo "\nWaiting for API to respond at ${BASE}/api/v2/levels/ (timeout 60s)"
for i in {1..60}; do
  if curl -sSf "${BASE}/api/v2/levels/" >/dev/null 2>&1; then
    echo "API is responding"
    break
  fi
  echo -n "."
  sleep 1
done
echo

OUT_LEVELS=/tmp/quizapp_levels.json
OUT_SEGMENTS=/tmp/quizapp_segments.json
OUT_SESSION=/tmp/quizapp_session_post.json

echo "\nFetching /api/v2/levels/ -> ${OUT_LEVELS}"
if [ -n "$AUTH_HEADER" ]; then
  curl -sS -H "$AUTH_HEADER" "${BASE}/api/v2/levels/" -o "$OUT_LEVELS" || true
else
  curl -sS "${BASE}/api/v2/levels/" -o "$OUT_LEVELS" || true
fi

echo "--- levels.json ---"
if command -v jq >/dev/null 2>&1; then
  jq '.' "$OUT_LEVELS" || cat "$OUT_LEVELS"
else
  cat "$OUT_LEVELS"
fi

LEVEL_ID="$(jq -r '.results[0].level_id // .[0].level_id // empty' "$OUT_LEVELS" 2>/dev/null || echo '')"
echo "Resolved LEVEL_ID=${LEVEL_ID}"

if [ -n "$LEVEL_ID" ]; then
  echo "Fetching /api/v2/segments/?level_id=${LEVEL_ID} -> ${OUT_SEGMENTS}"
  if [ -n "$AUTH_HEADER" ]; then
    curl -sS -H "$AUTH_HEADER" "${BASE}/api/v2/segments/?level_id=${LEVEL_ID}" -o "$OUT_SEGMENTS" || true
  else
    curl -sS "${BASE}/api/v2/segments/?level_id=${LEVEL_ID}" -o "$OUT_SEGMENTS" || true
  fi

  echo "--- segments.json ---"
  if command -v jq >/dev/null 2>&1; then
    jq '.' "$OUT_SEGMENTS" || cat "$OUT_SEGMENTS"
  else
    cat "$OUT_SEGMENTS"
  fi

  SEG_ID="$(jq -r '.results[0].segment_id // .[0].segment_id // empty' "$OUT_SEGMENTS" 2>/dev/null || echo '')"
  echo "Resolved SEG_ID=${SEG_ID}"
else
  echo "No LEVEL_ID found in ${OUT_LEVELS}; skipping segments fetch"
  SEG_ID=""
fi

if [ -n "$SEG_ID" ]; then
  echo "Attempting POST /api/v2/quiz-sessions/ with segment=${SEG_ID} -> ${OUT_SESSION}"
  if [ -n "$AUTH_HEADER" ]; then
    curl -sS -X POST "${BASE}/api/v2/quiz-sessions/" -H "Content-Type: application/json" -H "$AUTH_HEADER" -d "{\"segment\":\"${SEG_ID}\"}" -o "$OUT_SESSION" || true
  else
    curl -sS -X POST "${BASE}/api/v2/quiz-sessions/" -H "Content-Type: application/json" -d "{\"segment\":\"${SEG_ID}\"}" -o "$OUT_SESSION" || true
  fi
  echo "--- session_post.json ---"
  if command -v jq >/dev/null 2>&1; then
    jq '.' "$OUT_SESSION" || cat "$OUT_SESSION"
  else
    cat "$OUT_SESSION"
  fi
else
  echo "No SEG_ID available; not attempting POST"
fi

echo "\nDone. Files saved to:"
echo "  $OUT_LEVELS"
echo "  $OUT_SEGMENTS"
echo "  $OUT_SESSION"

echo "If authentication is required, run with:"
echo "  AUTH_HEADER='Authorization: Bearer <TOKEN>' ./scripts/check_v2_api.sh"

exit 0
