#!/usr/bin/env bash
# Build command of the `api` Vercel service: compile the shared contracts and the API, then
# apply database migrations on production deployments. Preview deployments never migrate (they
# could share the production database). Before the Neon integration is connected there is no
# database URL yet: skip with a note instead of failing.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build -w @youscan/shared
npm run build -w @youscan/api

if [ "${VERCEL_ENV:-}" != "production" ]; then
  echo "vercel-build-api: ${VERCEL_ENV:-local} deployment, skipping migrations"
elif [ -z "${DIRECT_URL:-}${DATABASE_URL_UNPOOLED:-}${DATABASE_URL:-}" ]; then
  echo "vercel-build-api: no database URL configured yet, skipping migrations"
else
  npm run db:migrate
fi
