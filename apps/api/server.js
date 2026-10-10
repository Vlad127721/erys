// Vercel entrypoint for the "api" service (framework "express"). It lives in the repository so
// Vercel can detect the service at import time; the app itself is compiled by tsc into dist/
// during the service build (scripts/vercel-build-api.sh), and Vercel bundles it from here.
// The service sets `outputDirectory: "."`: otherwise, after a build command, Vercel looks for an
// Express entry file in dist/ (dist/app.js) and ships dist/ as is, without this file and without
// package.json "type": "module". Locally, use `npm run dev:api`.
export { default } from './dist/vercel.js';
