import { readFile } from 'node:fs/promises';
import type { ImportTarget } from '@youscan/shared';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { IngestionService } from '../../src/ingestion/ingestion.service.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createTestApp, describeWithDb, resetDb, type TestApp } from '../db.js';
import { dataFile } from '../helpers.js';

const MANIFEST = dataFile('seed-manifest.json');

const validTarget: ImportTarget = {
  widgetType: 'STACKED_BAR',
  title: 'Sentiment',
  mapping: { shape: 'wide', category: 'Brand', values: ['Positive', 'Neutral', 'Negative'] },
};

describeWithDb('IngestionService (Postgres)', () => {
  let test: TestApp;
  let prisma: PrismaClient;
  let ingestion: IngestionService;

  beforeAll(() => {
    test = createTestApp();
    ({ prisma, ingestion } = test);
  });
  afterAll(() => test.close());
  beforeEach(() => resetDb(prisma));

  const csv = async () => ({ name: 'stacked-bar.csv', content: await readFile(dataFile('stacked-bar.csv')) });

  it('seeds the initial dashboard from the provided files, in manifest order', async () => {
    const result = await ingestion.seed(MANIFEST);

    expect(result.widgets.map((w) => w.status)).toEqual(['created', 'created', 'created']);
    // Dashboard order, as served by the API.
    const listed = await test.repository.list();
    expect(listed.map((w) => [w.type, w.title])).toEqual([
      ['LINE', 'Results by campaign'],
      ['PIE', 'Share of results by campaign'],
      ['STACKED_BAR', 'Sentiment by brand'],
    ]);
  });

  it('does not duplicate widgets or overwrite edits when the seed runs again', async () => {
    await ingestion.seed(MANIFEST);
    const pie = await prisma.widget.findUniqueOrThrow({ where: { sourceKey: 'initial-dashboard#pie' } });
    const edited = { slices: [{ name: 'Edited', value: 1 }] };
    await prisma.widget.update({ where: { id: pie.id }, data: { data: edited } });

    const again = await ingestion.seed(MANIFEST);

    expect(again.widgets.map((w) => w.status)).toEqual(['skipped', 'skipped', 'skipped']);
    expect(await prisma.widget.count()).toBe(3);
    expect((await prisma.widget.findUniqueOrThrow({ where: { id: pie.id } })).data).toEqual(edited);
  });

  it('restores file data in place only when replace is requested explicitly', async () => {
    await ingestion.seed(MANIFEST);
    const pie = await prisma.widget.findUniqueOrThrow({ where: { sourceKey: 'initial-dashboard#pie' } });
    await prisma.widget.update({ where: { id: pie.id }, data: { data: { slices: [{ name: 'Edited', value: 1 }] } } });

    const result = await ingestion.seed(MANIFEST, 'replace');

    expect(result.widgets.map((w) => w.status)).toEqual(['replaced', 'replaced', 'replaced']);
    const restored = await prisma.widget.findUniqueOrThrow({ where: { id: pie.id } });
    // Replaced in place: same row, same creation time, so the same place on the dashboard.
    expect(restored.createdAt).toEqual(pie.createdAt);
    expect(restored.data).toMatchObject({ slices: expect.arrayContaining([{ name: 'A', value: 1895 }]) });
  });

  it('appends imported widgets after existing ones', async () => {
    await ingestion.seed(MANIFEST);
    const { widgets } = await ingestion.importFile(await csv(), [validTarget]);
    const created = await prisma.widget.findUniqueOrThrow({ where: { id: widgets[0]!.id } });
    expect((await test.repository.list()).at(-1)?.id).toBe(created.id);
    expect(created.sourceKey).toBeNull();
  });

  it('saves nothing when any target of the import is invalid', async () => {
    const broken: ImportTarget = { ...validTarget, title: 'Broken', mapping: { shape: 'wide', category: 'Brand', values: ['Nope'] } };

    await expect(ingestion.importFile(await csv(), [validTarget, broken])).rejects.toThrow(/"Nope" not found/);
    expect(await prisma.widget.count()).toBe(0);
  });

  it('rolls back earlier inserts when a later write fails in the database', async () => {
    const repository = test.repository;
    const payload = { type: 'TEXT', data: { text: 'x' } } as const;

    // The second insert violates the unique sourceKey index after the first one succeeded.
    await expect(
      repository.saveMany(
        [
          { title: 'first', payload, sourceKey: 'dup' },
          { title: 'second', payload, sourceKey: 'dup' },
        ],
        'skip',
      ),
    ).rejects.toThrow();
    expect(await prisma.widget.count()).toBe(0);
  });
});
