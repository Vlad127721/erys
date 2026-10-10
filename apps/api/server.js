// Vercel entrypoint for the "api" service (framework "express"). It lives in the repository so
// Vercel can detect the service at import time; the app itself is compiled by tsc into dist/
// during the service build (scripts/vercel-build-api.sh). Locally, use `npm run dev:api`.
export { default } from './dist/vercel.js';
