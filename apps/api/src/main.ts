import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createContainer } from './container.js';

/** Local server. On Vercel the same app runs as a function (see vercel.ts). */
const config = loadConfig();
const container = createContainer(config);
const server = createApp(container, config).listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}/api`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => void container.prisma.$disconnect());
  });
}
