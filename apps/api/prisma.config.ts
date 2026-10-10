import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Migrations need a direct (non-pooled) connection; the app itself can use a pooler.
  // DATABASE_URL_UNPOOLED is what Vercel's Neon integration provides.
  datasource: {
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL'] ?? '',
  },
});
