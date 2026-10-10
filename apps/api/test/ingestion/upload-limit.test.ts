import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, describeWithDb, resetDb, type TestApp } from '../db.js';

const targets = JSON.stringify([
  { widgetType: 'BAR', title: 'Sizes', mapping: { shape: 'wide', category: 'Brand', values: ['Value'] } },
]);

/** A valid CSV of at least `bytes` bytes. */
function csvOfSize(bytes: number): Buffer {
  const rows = ['Brand,Value'];
  let length = rows[0]!.length;
  for (let i = 0; length < bytes; i++) {
    const row = `B${i},${i}`;
    rows.push(row);
    length += row.length + 1;
  }
  return Buffer.from(rows.join('\n'));
}

describeWithDb('POST /api/import upload size limit', () => {
  let test: TestApp | undefined;
  let prisma: PrismaClient;

  async function start(limit?: string): Promise<TestApp> {
    if (limit !== undefined) vi.stubEnv('MAX_UPLOAD_SIZE_BYTES', limit);
    test = createTestApp();
    prisma = test.prisma;
    await resetDb(prisma);
    return test;
  }
  const upload = (content: Buffer) =>
    request(test!.app).post('/api/import').attach('file', content, 'data.csv').field('targets', targets);

  afterEach(async () => {
    await test?.close();
    test = undefined;
    vi.unstubAllEnvs();
  });

  it('rejects files over the default 5 MiB with 413, saving nothing', async () => {
    await start();
    const { body } = await upload(csvOfSize(5 * 1024 * 1024 + 1024)).expect(413);
    expect(body).toMatchObject({ statusCode: 413, error: 'Payload Too Large' });
    expect(await prisma.widget.count()).toBe(0);
  });

  it('applies MAX_UPLOAD_SIZE_BYTES from the environment', async () => {
    await start('2048');
    await upload(csvOfSize(1000)).expect(201);
    await upload(csvOfSize(3000)).expect(413);
    expect(await prisma.widget.count()).toBe(1);
  });

  it('keeps other upload errors as 400, not 413', async () => {
    await start('2048');
    await request(test!.app)
      .post('/api/import')
      .attach('file', csvOfSize(100), 'a.csv')
      .attach('file', csvOfSize(100), 'b.csv')
      .field('targets', targets)
      .expect(400);
  });
});
