#!/bin/sh
# Smoke test for the demo environment. Signs up a fresh user and checks that
# every Iteration 3 route answers 200 with the shared envelope and no error.
# Usage: ./scripts/demo-smoke.sh [base-url]   (default http://localhost:3333)
set -eu

BASE="${1:-http://localhost:3333}"
FAILED=0

echo "Waiting for $BASE/api/v1/health"
i=0
until curl -fsS "$BASE/api/v1/health" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "FAIL: API not healthy after 5 minutes"
    exit 1
  fi
  sleep 5
done
echo "OK   /api/v1/health"

TOKEN=$(curl -fsS -X POST "$BASE/api/v1/user" |
  sed -n 's/.*"authToken":"\([^"]*\)".*/\1/p')

if [ -z "$TOKEN" ]; then
  echo "FAIL: could not sign up a smoke-test user"
  exit 1
fi
echo "OK   signed up a smoke-test user"

check() {
  BODY=$(curl -sS -w '\n%{http_code}' -H "Authorization: Bearer $TOKEN" "$BASE$1")
  CODE=$(printf '%s' "$BODY" | tail -n 1)

  if [ "$CODE" = "200" ] && printf '%s' "$BODY" | grep -q '"error":null'; then
    echo "OK   $1"
  else
    echo "FAIL $1 (HTTP $CODE)"
    FAILED=1
  fi
}

check /api/v1/dashboard/overview
check /api/v1/risk/score
check /api/v1/risk/concentration
check /api/v1/tax/realized-gains
check /api/v1/tax/lots
check '/api/v1/charts/series?range=max'
check '/api/v1/charts/drawdown?range=max'

if [ "$FAILED" -ne 0 ]; then
  echo "Smoke test failed"
  exit 1
fi

echo "Smoke test passed"
