import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createContainer } from './container.js';

/**
 * The API as a Vercel Function: an Express app is a `(req, res)` handler. Created once per
 * function instance and reused across requests; the root `api/index.mjs` re-exports it.
 */
const config = loadConfig();
export default createApp(createContainer(config), config);
