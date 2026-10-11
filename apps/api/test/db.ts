import type { Express } from 'express';
import { describe } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createContainer, type Container } from '../src/container.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { testDatabaseUrl as resolveTestDatabaseUrl } from './test-database.js';

const testDatabaseUrl = resolveTestDatabaseUrl();
if (testDatabaseUrl) process.env['DATABASE_URL'] = testDatabaseUrl;

/** Suites that need Postgres are skipped (not failed) when TEST_DATABASE_URL is not set. */
export const describeWithDb = testDatabaseUrl ? describe : describe.skip;

export interface TestApp extends Container {
  app: Express;
  close(): Promise<void>;
}

/** The real app wired to the test database; the environment is read at call time. */
export function createTestApp(): TestApp {
  const config = loadConfig();
  const silent = { error: () => {} };
  const container = createContainer(config, silent);
  return { ...container, app: createApp(container, config), close: () => container.prisma.$disconnect() };
}

export async function resetDb(prisma: PrismaClient): Promise<void> {
  await prisma.widget.deleteMany();
}
