#!/usr/bin/env bash
# Vercel build: compile everything, then apply database migrations on production deployments.
# Preview deployments never migrate (they could share the production database). Before the Neon
# integration is connected there is no database URL yet: skip with a note instead of failing.
set -euo pipefail

npm run build

if [ "${VERCEL_ENV:-}" != "production" ]; then
  echo "vercel-build: ${VERCEL_ENV:-local} deployment, skipping migrations"
elif [ -z "${DIRECT_URL:-}${DATABASE_URL_UNPOOLED:-}${DATABASE_URL:-}" ]; then
  echo "vercel-build: no database URL configured yet, skipping migrations"
else
  npm run db:migrate
fi
