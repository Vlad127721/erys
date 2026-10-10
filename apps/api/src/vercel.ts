import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createContainer } from './container.js';

/**
 * Entrypoint of the `api` Vercel service (vercel.json → services.api.entrypoint = dist/vercel.js):
 * an Express app is a `(req, res)` handler, created once per function instance and reused across
 * requests. Vercel routes /api/* here with the path unchanged, matching the /api prefix in app.ts.
 */
const config = loadConfig();
export default createApp(createContainer(config), config);
