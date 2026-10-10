import type { WidgetPayload } from '@youscan/shared';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { WidgetsRepository } from '../../src/widgets/widgets.repository.js';
import { createTestApp, describeWithDb, resetDb, type TestApp } from '../db.js';

const text = (value: string) => ({ type: 'TEXT', data: { text: value } }) as const;

describeWithDb('WidgetsRepository create and list (Postgres)', () => {
  let test: TestApp;
  let prisma: PrismaClient;
  let repository: WidgetsRepository;

  beforeAll(() => {
    test = createTestApp();
    ({ prisma, repository } = test);
  });
  afterAll(() => test.close());
  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetDb(prisma);
  });

  it('persists a valid payload and returns the metadata of the created row', async () => {
    const meta = await repository.create({ title: 'Note', payload: text('hello') });

    const row = await prisma.widget.findUniqueOrThrow({ where: { id: meta.id } });
    expect(meta).toEqual({
      id: row.id,
      type: 'TEXT',
      title: 'Note',
      updatedAt: row.updatedAt.toISOString(),
    });
    expect(row.data).toEqual({ text: 'hello' });
    expect(row.sourceKey).toBeNull();
  });

  it('does not query the metadata again after inserting', async () => {
    const findUnique = vi.spyOn(prisma.widget, 'findUnique');
    await repository.create({ title: 'Note', payload: text('hello') });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects an invalid payload before writing', async () => {
    // Well-typed, but a negative slice fails the schema.
    const invalid: WidgetPayload = { type: 'PIE', data: { slices: [{ name: 'A', value: -1 }] } };
    await expect(repository.create({ title: 'Pie', payload: invalid })).rejects.toThrow(ZodError);
    expect(await prisma.widget.count()).toBe(0);
  });

  const titles = async () => (await repository.list()).map((w) => w.title);

  it('lists new widgets last, in creation order, also after deletions', async () => {
    await repository.create({ title: 'a', payload: text('a') });
    const b = await repository.create({ title: 'b', payload: text('b') });
    await repository.create({ title: 'c', payload: text('c') });
    await repository.delete(b.id);
    await repository.create({ title: 'd', payload: text('d') });

    expect(await titles()).toEqual(['a', 'c', 'd']);
  });

  it('lists new widgets after imported ones', async () => {
    await repository.saveMany([{ title: 'seeded', payload: text('s'), sourceKey: 'seed#1' }], 'skip');
    await repository.create({ title: 'new', payload: text('n') });

    expect(await titles()).toEqual(['seeded', 'new']);
  });
});
