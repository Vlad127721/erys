import pg from 'pg';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { createTestApp, describeWithDb, type TestApp } from './db.js';

describeWithDb('GET /api/health', () => {
  let test: TestApp;

  beforeAll(() => {
    test = createTestApp();
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => test.close());

  it('is ok when the database answers', async () => {
    const { body } = await request(test.app).get('/api/health').expect(200);
    expect(body).toEqual({ status: 'ok' });
  });

  it('answers 503 when the database is unreachable', async () => {
    vi.spyOn(test.prisma, '$queryRaw').mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'));

    const { body } = await request(test.app).get('/api/health').expect(503);

    expect(body).toEqual({ message: 'Database is unavailable', error: 'Service Unavailable', statusCode: 503 });
  });

  // Neon suspends idle databases and poolers close idle connections. The pg pool must replace a
  // connection the server dropped instead of failing the next request.
  it('keeps answering after the database drops its connections', async () => {
    await request(test.app).get('/api/widgets').expect(200);

    // A separate connection terminates every connection the app's pool holds.
    const admin = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
    await admin.connect();
    try {
      const { rowCount } = await admin.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()',
      );
      expect(rowCount).toBeGreaterThan(0);
    } finally {
      await admin.end();
    }

    await request(test.app).get('/api/widgets').expect(200);
    await request(test.app).get('/api/health').expect(200);
  });
});
