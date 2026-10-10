import { randomUUID } from 'node:crypto';
import { widgetDataResponseSchema, widgetMetaSchema, WIDGET_TYPES } from '@youscan/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, describeWithDb, resetDb, type TestApp } from '../db.js';
import { dataFile } from '../helpers.js';

describeWithDb('Widgets API', () => {
  let test: TestApp;
  let prisma: PrismaClient;
  const api = () => request(test.app);

  beforeAll(() => {
    test = createTestApp();
    prisma = test.prisma;
  });
  afterAll(() => test.close());
  beforeEach(() => resetDb(prisma));

  const create = async (type: string) => (await api().post('/api/widgets').send({ type }).expect(201)).body;

  it.each(WIDGET_TYPES)('creates a %s widget with valid, persisted data', async (type) => {
    const meta = widgetMetaSchema.parse(await create(type));

    const first = (await api().get(`/api/widgets/${meta.id}/data`).expect(200)).body;
    const second = (await api().get(`/api/widgets/${meta.id}/data`).expect(200)).body;
    expect(widgetDataResponseSchema.parse(first).type).toBe(type);
    // Random data is generated once on creation, not on every read.
    expect(second).toEqual(first);
  });

  it('lists metadata only, in creation order', async () => {
    await create('LINE');
    await create('TEXT');

    const { body } = await api().get('/api/widgets').expect(200);
    expect(body.map((w: { type: string }) => w.type)).toEqual(['LINE', 'TEXT']);
    expect(body[0]).not.toHaveProperty('data');
  });

  it('saves text edits', async () => {
    const { id } = await create('TEXT');

    await api().put(`/api/widgets/${id}/text`).send({ text: 'Hello' }).expect(200);

    const { body } = await api().get(`/api/widgets/${id}/data`).expect(200);
    expect(body.data).toEqual({ text: 'Hello' });
  });

  it('creates text widgets with random plain-text data', async () => {
    const { id } = await create('TEXT');
    const { body } = await api().get(`/api/widgets/${id}/data`).expect(200);
    expect(body.data.text).toMatch(/^\{A: \d+, B: \d+, C: \d+, D: \d+, E: \d+\}$/);
  });

  it('refuses to edit text of a chart widget', async () => {
    const { id } = await create('PIE');
    await api().put(`/api/widgets/${id}/text`).send({ text: 'Hello' }).expect(422);
  });

  it('deletes widgets', async () => {
    const { id } = await create('BAR');
    await api().delete(`/api/widgets/${id}`).expect(204);
    await api().get(`/api/widgets/${id}/data`).expect(404);
    await api().delete(`/api/widgets/${id}`).expect(404);
  });

  it.each([
    ['unknown type', 'post', '/api/widgets', { type: 'DONUT' }, 400],
    ['extra fields', 'post', '/api/widgets', { type: 'TEXT', data: {} }, 400],
    ['blank title', 'post', '/api/widgets', { type: 'TEXT', title: '  ' }, 400],
    ['malformed id', 'get', '/api/widgets/123/data', undefined, 400],
    ['unknown id', 'get', `/api/widgets/${randomUUID()}/data`, undefined, 404],
    ['missing text', 'put', `/api/widgets/${randomUUID()}/text`, {}, 400],
    ['non-string text', 'put', `/api/widgets/${randomUUID()}/text`, { text: 1 }, 400],
    ['too long text', 'put', `/api/widgets/${randomUUID()}/text`, { text: 'x'.repeat(10_001) }, 400],
  ] as const)('rejects %s', async (_case, method, url, body, status) => {
    await api()[method](url).send(body).expect(status);
  });

  it('fails only the widget whose stored data is corrupted', async () => {
    const healthy = await create('LINE');
    const broken = await create('PIE');
    await prisma.widget.update({ where: { id: broken.id }, data: { data: { slices: 'oops' } } });

    await api().get('/api/widgets').expect(200);
    await api().get(`/api/widgets/${healthy.id}/data`).expect(200);
    const { body } = await api().get(`/api/widgets/${broken.id}/data`).expect(500);
    expect(body.message).toBe('Widget data is corrupted');
  });

  it('imports an uploaded file through the same pipeline', async () => {
    const targets = [
      { widgetType: 'PIE', title: 'Pie', sheet: 'pie chart data', mapping: { shape: 'wide', category: 'Campaign', values: ['Result'] } },
    ];
    const { body } = await api()
      .post('/api/import')
      .attach('file', dataFile('line-and-pie.xlsx'))
      .field('targets', JSON.stringify(targets))
      .expect(201);

    const data = (await api().get(`/api/widgets/${body.widgets[0].id}/data`).expect(200)).body;
    expect(data.data.slices).toHaveLength(5);
  });

  it.each([
    ['no file', undefined, '[]', 400],
    ['unsupported extension', dataFile('seed-manifest.json'), '[{"widgetType":"PIE","title":"x","mapping":{"shape":"wide","category":"a","values":["b"]}}]', 415],
    ['invalid targets JSON', dataFile('stacked-bar.csv'), '{', 400],
    ['wrong column', dataFile('stacked-bar.csv'), '[{"widgetType":"BAR","title":"x","mapping":{"shape":"wide","category":"Brand","values":["Nope"]}}]', 400],
  ] as const)('rejects import with %s', async (_case, file, targets, status) => {
    const req = api().post('/api/import').field('targets', targets);
    await (file ? req.attach('file', file) : req).expect(status);
    expect(await prisma.widget.count()).toBe(0);
  });
});
