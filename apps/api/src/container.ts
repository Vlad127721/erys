import { PrismaPg } from '@prisma/adapter-pg';
import type { AppConfig } from './config.js';
import { PrismaClient } from './generated/prisma/client.js';
import type { Logger } from './http/error-handler.js';
import { IngestionService } from './ingestion/ingestion.service.js';
import { ParserRegistry } from './ingestion/parsers/parser-registry.js';
import { RandomDataService } from './widgets/random-data.service.js';
import { WidgetsRepository } from './widgets/widgets.repository.js';
import { WidgetsService } from './widgets/widgets.service.js';

export interface Container {
  prisma: PrismaClient;
  repository: WidgetsRepository;
  widgets: WidgetsService;
  ingestion: IngestionService;
  logger: Logger;
}

/**
 * Wires the application by hand: database → repository → services. Shared by the HTTP server,
 * the Vercel function, the seed command and the tests.
 */
export function createContainer(config: Pick<AppConfig, 'DATABASE_URL'>, logger: Logger = console): Container {
  // A small pool per process: on Vercel every function instance opens its own connections, and
  // DATABASE_URL points at Neon's pooler there.
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.DATABASE_URL, max: 3 }) });
  const repository = new WidgetsRepository(prisma);
  return {
    prisma,
    repository,
    widgets: new WidgetsService(repository, new RandomDataService(), logger),
    ingestion: new IngestionService(repository, new ParserRegistry()),
    logger,
  };
}
