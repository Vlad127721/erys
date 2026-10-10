import express, { type Express } from 'express';
import type { AppConfig } from './config.js';
import type { Container } from './container.js';
import { errorHandler, notFoundHandler } from './http/error-handler.js';
import { healthRouter } from './http/health.routes.js';
import { importRouter } from './http/import.routes.js';
import { widgetsRouter } from './http/widgets.routes.js';

/** The HTTP API under /api. Used by the local server (main.ts), the Vercel function and tests. */
export function createApp(container: Container, config: Pick<AppConfig, 'MAX_UPLOAD_SIZE_BYTES'>): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  const api = express.Router();
  api.use(healthRouter(container.prisma));
  api.use(widgetsRouter(container.widgets));
  api.use(importRouter(container.ingestion, config.MAX_UPLOAD_SIZE_BYTES));
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler(container.logger));
  return app;
}
