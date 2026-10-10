import { existsSync } from 'node:fs';

/**
 * Returns the integration-test database URL, or undefined when tests should skip the
 * database. Integration tests delete all data in it, so it refuses the app's own database:
 * a misconfigured .env must not wipe development data.
 */
export function testDatabaseUrl(): string | undefined {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const testUrl = process.env['TEST_DATABASE_URL'];
  const appUrl = process.env['DATABASE_URL'];
  if (testUrl && appUrl && databaseIdentity(testUrl) === databaseIdentity(appUrl)) {
    throw new Error('TEST_DATABASE_URL points to the same database as DATABASE_URL; tests delete all data in it.');
  }
  return testUrl;
}

/** host:port/database, ignoring credentials and options. */
function databaseIdentity(url: string): string {
  const { hostname, port, pathname } = new URL(url);
  return `${hostname}:${port || '5432'}${pathname}`;
}
