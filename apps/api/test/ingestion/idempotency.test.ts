import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, describeWithDb, resetDb, type TestApp } from '../db.js';

const csv = Buffer.from('Brand,Value\nA,40\nB,150\n');
const targets = (title = 'Sizes') =>
  JSON.stringify([{ widgetType: 'BAR', title, mapping: { shape: 'wide', category: 'Brand', values: ['Value'] } }]);

describeWithDb('POST /api/import with Idempotency-Key', () => {
  let test: TestApp;
  let prisma: PrismaClient;

  beforeAll(() => {
    test = createTestApp();
    prisma = test.prisma;
  });
  afterAll(() => test.close());
  beforeEach(() => resetDb(prisma));

  const upload = (key: string | undefined, title?: string, content = csv) => {
    const req = request(test.app).post('/api/import').attach('file', content, 'data.csv').field('targets', targets(title));
    return key === undefined ? req : req.set('Idempotency-Key', key);
  };

  it('replays the first response for a repeated request, importing once', async () => {
    const first = await upload('key-1').expect(201);
    expect(first.headers['idempotent-replayed']).toBeUndefined();

    const repeat = await upload('key-1').expect(201);
    expect(repeat.headers['idempotent-replayed']).toBe('true');
    expect(repeat.body).toEqual(first.body);
    expect(await prisma.widget.count()).toBe(1);
  });

  it('imports once when the same request arrives concurrently', async () => {
    const responses = await Promise.all([upload('key-1'), upload('key-1'), upload('key-1')]);

    expect(responses.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(new Set(responses.map((r) => r.body.widgets[0].id)).size).toBe(1);
    expect(responses.filter((r) => r.headers['idempotent-replayed'] === 'true')).toHaveLength(2);
    expect(await prisma.widget.count()).toBe(1);
  });

  it.each([
    ['different targets', () => upload('key-1', 'Other title')],
    ['different file content', () => upload('key-1', undefined, Buffer.from('Brand,Value\nA,1\n'))],
  ])('rejects a key reused with %s (422), importing nothing', async (_case, reuse) => {
    await upload('key-1').expect(201);

    const { body } = await reuse().expect(422);
    expect(body).toMatchObject({ statusCode: 422, message: 'Idempotency-Key has already been used for a different request' });
    expect(await prisma.widget.count()).toBe(1);
  });

  it('stores nothing for a failed import, so the key can be retried', async () => {
    const broken = JSON.stringify([
      { widgetType: 'BAR', title: 'x', mapping: { shape: 'wide', category: 'Brand', values: ['Nope'] } },
    ]);
    await request(test.app)
      .post('/api/import')
      .set('Idempotency-Key', 'key-1')
      .attach('file', csv, 'data.csv')
      .field('targets', broken)
      .expect(400);

    await upload('key-1').expect(201);
    expect(await prisma.widget.count()).toBe(1);
  });

  it('keys are independent; without a key every request imports', async () => {
    await upload('key-1').expect(201);
    await upload('key-2').expect(201);
    await upload(undefined).expect(201);
    await upload(undefined).expect(201);
    expect(await prisma.widget.count()).toBe(4);
  });

  it.each([
    ['empty', ''],
    ['too long', 'k'.repeat(256)],
    ['with a space', 'my key'],
  ])('rejects an invalid key (%s) with 400', async (_case, key) => {
    const { body } = await upload(key).expect(400);
    expect(body.message).toContain('Idempotency-Key must be 1 to 255 visible ASCII characters');
    expect(await prisma.widget.count()).toBe(0);
  });
});
