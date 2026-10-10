import { execFileSync } from 'node:child_process';
import { testDatabaseUrl } from './test-database.js';

/** Applies migrations to the test database once per run. */
export default function setup(): void {
  const url = testDatabaseUrl();
  if (!url) return;
  // prisma.config.ts prefers DIRECT_URL, so override both or migrations could hit the app database.
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: 'pipe',
  });
}
