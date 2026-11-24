#!/usr/bin/env bash
# Seeds the synthetic demo users from scripts/seed-risk-demo-data.mts
# (demo-risk-*) into the running demo database, for the Risk and Tax browser
# E2E specs. Needs the stack started with docker/docker-compose.e2e.yml so
# Postgres is reachable on 127.0.0.1:5433. Disposable demo database only.
set -euo pipefail

cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
source .env.demo
set +a

export ALLOW_RISK_DEMO_SEED=yes
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5433/${POSTGRES_DB}"
unset DIRECT_URL

npx tsx scripts/seed-risk-demo-data.mts
