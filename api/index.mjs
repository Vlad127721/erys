// Vercel Function: the whole API. All /api/* requests are rewritten here (vercel.json); the
// Express app routes them by their original path. Built by `npm run build` into apps/api/dist.
export { default } from '../apps/api/dist/vercel.js';
